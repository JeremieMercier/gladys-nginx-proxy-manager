// -----------------------------------------------------------------------------
// Device registry.
//
// Two device types live here:
//   - server.js    : ONE fixed monitoring device (host counts, certificates)
//   - proxyHost.js : one device PER proxy host discovered on the NPM API
//
// Because the proxy host list is dynamic, discovery takes the freshly fetched
// host list as input, and dispatch parses the external_id instead of walking a
// static blueprint list.
// -----------------------------------------------------------------------------

import { server } from './server.js';
import { buildProxyHostDevice, parseProxyHostId } from './proxyHost.js';

export { server };
export * from './proxyHost.js';

/**
 * Build the discovery payload for Gladys: the server device plus one device
 * per proxy host returned by the NPM API.
 * @param {object} gladys
 * @param {{ poll_frequency: number }} config
 * @param {Array<object>} proxyHosts fresh /api/nginx/proxy-hosts response
 */
export function buildDiscoveredDevices(gladys, config, proxyHosts = []) {
  return [
    server.buildDevice(gladys, config),
    ...proxyHosts.map((host) => buildProxyHostDevice(gladys, config, host)),
  ];
}

/**
 * Identify which device type owns a given external_id.
 * @param {object} gladys
 * @param {string} externalId
 * @returns {{ type: 'server' } | { type: 'proxy-host', hostId: number } | null}
 */
export function resolveDevice(gladys, externalId) {
  if (externalId === server.deviceExternalId(gladys)) {
    return { type: 'server' };
  }
  const hostId = parseProxyHostId(externalId);
  if (hostId !== null) {
    return { type: 'proxy-host', hostId };
  }
  return null;
}
