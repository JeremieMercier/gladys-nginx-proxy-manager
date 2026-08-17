// -----------------------------------------------------------------------------
// Device type: PROXY HOST
// One device per proxy host configured in Nginx Proxy Manager, exposing a
// single binary switch: enabled (traffic forwarded) / disabled (502 page).
//
// Unlike the server device, these devices are DYNAMIC: they are discovered by
// listing /api/nginx/proxy-hosts, and their platform id is the numeric id NPM
// assigns to the host (stable across restarts and renames).
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from '@gladysassistant/integration-sdk';

const DEVICE_TYPE = 'proxy-host';

const logger = createLogger({ name: DEVICE_TYPE });

export const FEATURE = { ENABLED: 'enabled' };

export function proxyHostExternalIds(gladys, hostId) {
  return gladys.externalIds(DEVICE_TYPE, String(hostId));
}

/**
 * Extract the NPM host id from a device external_id, or null when the device
 * is not a proxy host. Used to route onPoll / onSetValue.
 * @param {string} externalId
 * @returns {number|null}
 */
export function parseProxyHostId(externalId) {
  const match = /(?:^|:)proxy-host:(\d+)$/.exec(externalId ?? '');
  return match ? Number(match[1]) : null;
}

/**
 * Discovery payload for one proxy host returned by the NPM API.
 * @param {object} gladys
 * @param {{ poll_frequency: number }} config
 * @param {{ id: number, domain_names?: string[], forward_host?: string, forward_port?: number }} host
 */
export function buildProxyHostDevice(gladys, config, host) {
  const ids = proxyHostExternalIds(gladys, host.id);
  const domain = host.domain_names?.[0] ?? `proxy-host-${host.id}`;
  return {
    name: domain,
    external_id: ids.device,
    poll_frequency: config.poll_frequency,
    features: [
      {
        name: 'Enabled',
        external_id: ids.feature(FEATURE.ENABLED),
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        read_only: false, // actuator: the user can enable/disable the host
        has_feedback: true, // we publish the state confirmed by the API
        keep_history: true,
      },
    ],
  };
}

/**
 * Batch-publish the enabled state of a list of proxy hosts.
 * @param {object} gladys
 * @param {Array<{ id: number, enabled?: number|boolean }>} hosts
 */
export async function publishProxyHostStates(gladys, hosts) {
  if (hosts.length === 0) {
    return;
  }
  await gladys.publishStates(
    hosts.map((host) => ({
      device_feature_external_id: proxyHostExternalIds(gladys, host.id).feature(FEATURE.ENABLED),
      // NPM serializes `enabled` as 0/1; be liberal and accept booleans too.
      state: host.enabled ? 1 : 0,
    })),
  );
}

/**
 * Enable/disable a proxy host then publish the state CONFIRMED by the API
 * (has_feedback: true), not merely the requested one.
 * @param {object} gladys
 * @param {import('../npmApi.js').NpmApi} api
 * @param {number} hostId
 * @param {number} value 1 to enable, 0 to disable
 */
export async function setProxyHostValue(gladys, api, hostId, value) {
  const enable = value === 1;
  logger.info(`Proxy host ${hostId} -> ${enable ? 'enable' : 'disable'}`);
  await api.setProxyHostEnabled(hostId, enable);
  const host = await api.getProxyHost(hostId);
  await publishProxyHostStates(gladys, [host]);
}
