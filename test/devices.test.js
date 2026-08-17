// -----------------------------------------------------------------------------
// Unit tests of the device wiring: discovery payloads, external_id routing and
// state publication, against the in-memory fake Gladys (no server needed).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { normalizeConfig } from '../src/config.js';
import { buildDiscoveredDevices, resolveDevice, server } from '../src/devices/index.js';
import {
  buildProxyHostDevice,
  parseProxyHostId,
  publishProxyHostStates,
  setProxyHostValue,
} from '../src/devices/proxyHost.js';
import { nextCertificateExpiryInDays } from '../src/devices/server.js';

const config = normalizeConfig({
  npm_url: 'http://npm:81',
  email: 'a@b.c',
  password: 'secret',
  poll_frequency: 60,
});

const SAMPLE_HOSTS = [
  { id: 3, domain_names: ['gladys.example.com'], enabled: 1 },
  { id: 7, domain_names: ['npm.example.com', 'proxy.example.com'], enabled: 0 },
];

test('discovery publishes the server device plus one device per proxy host', () => {
  const gladys = createFakeGladys();
  const devices = buildDiscoveredDevices(gladys, config, SAMPLE_HOSTS);
  assert.equal(devices.length, 3);
  assert.equal(devices[0].external_id, server.deviceExternalId(gladys));
  assert.equal(devices[1].name, 'gladys.example.com');
  assert.equal(devices[2].name, 'npm.example.com');
  for (const device of devices) {
    assert.equal(device.poll_frequency, 60);
  }
});

test('a proxy host device exposes a single controllable binary switch', () => {
  const gladys = createFakeGladys();
  const device = buildProxyHostDevice(gladys, config, SAMPLE_HOSTS[0]);
  assert.equal(device.features.length, 1);
  const [feature] = device.features;
  assert.equal(feature.category, 'switch');
  assert.equal(feature.type, 'binary');
  assert.equal(feature.read_only, false);
  assert.equal(feature.has_feedback, true);
});

test('resolveDevice routes external ids to the right device type', () => {
  const gladys = createFakeGladys();
  assert.deepEqual(resolveDevice(gladys, server.deviceExternalId(gladys)), { type: 'server' });
  const hostDevice = buildProxyHostDevice(gladys, config, SAMPLE_HOSTS[1]);
  assert.deepEqual(resolveDevice(gladys, hostDevice.external_id), {
    type: 'proxy-host',
    hostId: 7,
  });
  assert.equal(resolveDevice(gladys, 'ext:whatever:unknown:42'), null);
});

test('parseProxyHostId also matches the real ext:<selector>: prefix', () => {
  assert.equal(parseProxyHostId('ext:my-npm:proxy-host:12'), 12);
  assert.equal(parseProxyHostId('proxy-host:12'), 12);
  assert.equal(parseProxyHostId('ext:my-npm:server:main'), null);
});

test('publishProxyHostStates publishes 1/0 from the NPM enabled flag', async () => {
  const gladys = createFakeGladys();
  await publishProxyHostStates(gladys, SAMPLE_HOSTS);
  assert.equal(gladys.published.length, 2);
  assert.equal(gladys.published[0].state, 1);
  assert.equal(gladys.published[1].state, 0);
});

test('setProxyHostValue calls the API then publishes the confirmed state', async () => {
  const gladys = createFakeGladys();
  const calls = [];
  const fakeApi = {
    async setProxyHostEnabled(id, enabled) {
      calls.push({ id, enabled });
    },
    async getProxyHost(id) {
      return { id, enabled: 1 };
    },
  };
  await setProxyHostValue(gladys, fakeApi, 3, 1);
  assert.deepEqual(calls, [{ id: 3, enabled: true }]);
  assert.equal(gladys.published.length, 1);
  assert.equal(gladys.published[0].state, 1);
});

test('server.onPoll publishes the host counts and certificate stats', async () => {
  const gladys = createFakeGladys();
  const now = Date.now();
  const fakeApi = {
    async getHostCounts() {
      return { proxy: 5, redirection: 1, stream: 0, dead: 2 };
    },
    async getCertificates() {
      return [{ expires_on: new Date(now + 30 * 86_400_000).toISOString() }];
    },
  };
  await server.onPoll(gladys, { api: fakeApi });
  const states = Object.fromEntries(gladys.published.map((p) => [p.featureExternalId, p.state]));
  assert.equal(states['server:main:proxy-hosts'], 5);
  assert.equal(states['server:main:redirection-hosts'], 1);
  assert.equal(states['server:main:streams'], 0);
  assert.equal(states['server:main:dead-hosts'], 2);
  assert.equal(states['server:main:certificates'], 1);
  assert.ok(states['server:main:certificate-expiry'] >= 29);
});

test('nextCertificateExpiryInDays picks the soonest expiry, floored at 0', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const certs = [
    { expires_on: '2026-03-01T00:00:00Z' },
    { expires_on: '2026-01-11T00:00:00Z' },
    { expires_on: 'not-a-date' },
  ];
  assert.equal(nextCertificateExpiryInDays(certs, now), 10);
  assert.equal(nextCertificateExpiryInDays([{ expires_on: '2020-01-01T00:00:00Z' }], now), 0);
  assert.equal(nextCertificateExpiryInDays([], now), null);
  assert.equal(nextCertificateExpiryInDays([{ expires_on: 'garbage' }], now), null);
});
