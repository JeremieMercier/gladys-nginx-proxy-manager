// -----------------------------------------------------------------------------
// Unit tests of the NPM API client, with a mocked global fetch (no real
// Nginx Proxy Manager instance needed).
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NpmApi } from '../src/npmApi.js';

const realFetch = globalThis.fetch;
let requests;
let responders;

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

beforeEach(() => {
  requests = [];
  responders = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    const responder = responders.shift();
    if (!responder) {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    return responder({ url: String(url), options });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function makeApi() {
  return new NpmApi({ npm_url: 'http://npm:81', email: 'a@b.c', password: 'secret' });
}

test('login posts the credentials and caches the token', async () => {
  const api = makeApi();
  responders.push(() =>
    jsonResponse({ token: 'jwt-1', expires: new Date(Date.now() + 3_600_000).toISOString() }),
  );
  await api.login();
  assert.equal(requests[0].url, 'http://npm:81/api/tokens');
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), { identity: 'a@b.c', secret: 'secret' });
  assert.equal(api.token, 'jwt-1');
});

test('request authenticates first, then sends the Bearer token', async () => {
  const api = makeApi();
  responders.push(() =>
    jsonResponse({ token: 'jwt-1', expires: new Date(Date.now() + 3_600_000).toISOString() }),
  );
  responders.push(() => jsonResponse([{ id: 1 }]));
  const hosts = await api.getProxyHosts();
  assert.deepEqual(hosts, [{ id: 1 }]);
  assert.equal(requests[1].url, 'http://npm:81/api/nginx/proxy-hosts');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer jwt-1');
});

test('request re-authenticates once on a 401', async () => {
  const api = makeApi();
  api.token = 'stale';
  api.tokenExpiresAt = Date.now() + 3_600_000;
  responders.push(() => jsonResponse({}, 401));
  responders.push(() =>
    jsonResponse({ token: 'jwt-2', expires: new Date(Date.now() + 3_600_000).toISOString() }),
  );
  responders.push(() => jsonResponse({ proxy: 4, redirection: 0, stream: 0, dead: 1 }));
  const counts = await api.getHostCounts();
  assert.equal(counts.proxy, 4);
  assert.equal(requests.length, 3);
  assert.equal(requests[2].options.headers.Authorization, 'Bearer jwt-2');
});

test('setProxyHostEnabled hits the enable/disable endpoints', async () => {
  const api = makeApi();
  api.token = 'jwt-1';
  api.tokenExpiresAt = Date.now() + 3_600_000;
  responders.push(() => jsonResponse(true));
  responders.push(() => jsonResponse(true));
  await api.setProxyHostEnabled(3, true);
  await api.setProxyHostEnabled(3, false);
  assert.equal(requests[0].url, 'http://npm:81/api/nginx/proxy-hosts/3/enable');
  assert.equal(requests[1].url, 'http://npm:81/api/nginx/proxy-hosts/3/disable');
  assert.equal(requests[0].options.method, 'POST');
});

test('a failed request throws with the HTTP status', async () => {
  const api = makeApi();
  api.token = 'jwt-1';
  api.tokenExpiresAt = Date.now() + 3_600_000;
  responders.push(() => jsonResponse({}, 500));
  await assert.rejects(() => api.getProxyHosts(), /HTTP 500/);
});

test('a failed login throws and does not retry', async () => {
  const api = makeApi();
  responders.push(() => jsonResponse({}, 401));
  await assert.rejects(() => api.login(), /authentication failed/);
  assert.equal(requests.length, 1);
});
