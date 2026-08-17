// -----------------------------------------------------------------------------
// Unit tests of the NPM health-check driver, with a mocked global fetch (no
// real Nginx Proxy Manager container needed).
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getNpmHealth, waitForNpm, formatVersion, NPM_BASE_URL } from '../src/npmApi.js';

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

const HEALTHY = { status: 'OK', version: { major: 2, minor: 12, revision: 3 } };

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

test('getNpmHealth hits the API root through the private DNS alias', async () => {
  responders.push(() => jsonResponse(HEALTHY));
  const health = await getNpmHealth();
  assert.equal(requests[0].url, `${NPM_BASE_URL}/api/`);
  assert.equal(health.version.major, 2);
});

test('getNpmHealth throws with the HTTP status when NPM is down', async () => {
  responders.push(() => jsonResponse({}, 502));
  await assert.rejects(() => getNpmHealth(), /HTTP 502/);
});

test('waitForNpm retries until the API answers', async () => {
  responders.push(() => jsonResponse({}, 502));
  responders.push(() => {
    throw new Error('connection refused');
  });
  responders.push(() => jsonResponse(HEALTHY));
  const health = await waitForNpm({ timeoutMs: 1_000, intervalMs: 10 });
  assert.equal(requests.length, 3);
  assert.equal(health.status, 'OK');
});

test('waitForNpm gives up after the timeout, keeping the last error', async () => {
  for (let i = 0; i < 50; i += 1) {
    responders.push(() => jsonResponse({}, 502));
  }
  await assert.rejects(() => waitForNpm({ timeoutMs: 50, intervalMs: 10 }), /HTTP 502/);
});

test('formatVersion renders the version triple, or unknown', () => {
  assert.equal(formatVersion(HEALTHY), '2.12.3');
  assert.equal(formatVersion({ status: 'OK' }), 'unknown');
  assert.equal(formatVersion(undefined), 'unknown');
});
