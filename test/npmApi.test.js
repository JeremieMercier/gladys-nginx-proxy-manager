// -----------------------------------------------------------------------------
// Unit tests of the NPM health-check driver, with a mocked global fetch (no
// real Nginx Proxy Manager container needed).
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getNpmHealth,
  waitForNpm,
  formatVersion,
  describeFetchError,
  NPM_INTERNAL_URL,
} from '../src/npmApi.js';

const realFetch = globalThis.fetch;
let requests;
let respondersByUrl;

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
  respondersByUrl = new Map();
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    const queue = respondersByUrl.get(String(url));
    const responder = queue?.shift();
    if (!responder) {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    return responder();
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function respond(url, ...responders) {
  const queue = respondersByUrl.get(url) ?? [];
  queue.push(...responders);
  respondersByUrl.set(url, queue);
}

const INTERNAL_API = `${NPM_INTERNAL_URL}/api/`;

test('getNpmHealth hits the API root through the private DNS alias', async () => {
  respond(INTERNAL_API, () => jsonResponse(HEALTHY));
  const health = await getNpmHealth();
  assert.equal(requests[0].url, INTERNAL_API);
  assert.equal(health.version.major, 2);
});

test('getNpmHealth throws with the HTTP status when NPM is down', async () => {
  respond(INTERNAL_API, () => jsonResponse({}, 502));
  await assert.rejects(() => getNpmHealth(), /HTTP 502/);
});

test('waitForNpm retries until the API answers', async () => {
  respond(
    INTERNAL_API,
    () => jsonResponse({}, 502),
    () => {
      throw new Error('connection refused');
    },
    () => jsonResponse(HEALTHY),
  );
  const { health, baseUrl } = await waitForNpm({ timeoutMs: 1_000, intervalMs: 10 });
  assert.equal(requests.length, 3);
  assert.equal(health.status, 'OK');
  assert.equal(baseUrl, NPM_INTERNAL_URL);
});

test('waitForNpm falls back to the host-published port when the alias fails', async () => {
  const fallback = 'http://192.168.1.20:41480';
  respond(INTERNAL_API, () => {
    const err = new Error('fetch failed');
    err.cause = { code: 'ENOTFOUND' };
    throw err;
  });
  respond(`${fallback}/api/`, () => jsonResponse(HEALTHY));
  const { health, baseUrl } = await waitForNpm({
    candidates: [NPM_INTERNAL_URL, fallback],
    timeoutMs: 1_000,
    intervalMs: 10,
  });
  assert.equal(health.status, 'OK');
  assert.equal(baseUrl, fallback);
});

test('waitForNpm gives up after the timeout, reporting every candidate', async () => {
  const fallback = 'http://192.168.1.20:41480';
  for (let i = 0; i < 50; i += 1) {
    respond(INTERNAL_API, () => jsonResponse({}, 502));
    respond(`${fallback}/api/`, () => {
      const err = new Error('fetch failed');
      err.cause = { code: 'ECONNREFUSED' };
      throw err;
    });
  }
  await assert.rejects(
    () => waitForNpm({ candidates: [NPM_INTERNAL_URL, fallback], timeoutMs: 50, intervalMs: 10 }),
    (err) => {
      assert.match(err.message, /HTTP 502/);
      assert.match(err.message, /ECONNREFUSED/);
      return true;
    },
  );
});

test('describeFetchError surfaces the undici cause', () => {
  const err = new Error('fetch failed');
  err.cause = { code: 'ENOTFOUND' };
  assert.equal(describeFetchError(err), 'fetch failed (ENOTFOUND)');
  assert.equal(describeFetchError(new Error('plain')), 'plain');
});

test('formatVersion renders the version triple, or unknown', () => {
  assert.equal(formatVersion(HEALTHY), '2.12.3');
  assert.equal(formatVersion({ status: 'OK' }), 'unknown');
  assert.equal(formatVersion(undefined), 'unknown');
});
