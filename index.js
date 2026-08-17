// -----------------------------------------------------------------------------
// Entry point of the Gladys <-> Nginx Proxy Manager integration.
//
// Role of this file: wire the SDK to the NPM API client (src/npmApi.js) and the
// device catalog (src/devices/). It holds no business logic: the API calls live
// in src/npmApi.js, the device payloads in src/devices/. This file only:
//   1. instantiates the SDK (connection, auth, reconnection: handled for you);
//   2. registers the event handlers BEFORE connect();
//   3. connects, discovers the proxy hosts and publishes the devices.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, isConfigComplete } from './src/config.js';
import { NpmApi } from './src/npmApi.js';
import {
  buildDiscoveredDevices,
  resolveDevice,
  server,
  publishProxyHostStates,
  setProxyHostValue,
} from './src/devices/index.js';

const gladys = new GladysIntegration();

// Current configuration (hot-reloaded via onConfigUpdated) and the API client
// built from it. `api` is null until the config is complete.
let config = normalizeConfig();
let api = null;

const NOT_CONFIGURED_MESSAGE = {
  en: 'Fill in the Nginx Proxy Manager URL, email and password, then save.',
  fr: "Renseignez l'URL, l'e-mail et le mot de passe de Nginx Proxy Manager, puis enregistrez.",
};

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> discovering proxy hosts');
  await discoverAndPublishDevices();
});

// --- Command: the user acts on a controllable feature ------------------------
gladys.onSetValue(async (device, feature, value) => {
  logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
  requireApi();
  const target = resolveDevice(gladys, device.external_id);
  if (target?.type !== 'proxy-host') {
    // Throw: the SDK sends a success:false acknowledgement to Gladys.
    throw new Error(`No command handler for ${device.external_id}`);
  }
  await setProxyHostValue(gladys, api, target.hostId, value);
});

// --- Polling: Gladys asks to refresh a device --------------------------------
gladys.onPoll(async (device) => {
  requireApi();
  const target = resolveDevice(gladys, device.external_id);
  if (!target) {
    logger.debug(`onPoll ignored (unknown device) for ${device.external_id}`);
    return;
  }
  if (target.type === 'server') {
    await server.onPoll(gladys, { api });
    return;
  }
  const host = await api.getProxyHost(target.hostId);
  await publishProxyHostStates(gladys, [host]);
});

// --- Manifest action: "Test the connection" button ---------------------------
gladys.onAction('test_connection', async () => {
  logger.info('Action test_connection -> live request to the NPM API');
  requireApi();
  const [info, counts] = await Promise.all([api.getVersion(), api.getHostCounts()]);
  const version = info?.version
    ? `${info.version.major}.${info.version.minor}.${info.version.revision}`
    : 'unknown';
  return {
    en: `Connected to Nginx Proxy Manager v${version}: ${counts.proxy} proxy host(s).`,
    fr: `Connecté à Nginx Proxy Manager v${version} : ${counts.proxy} proxy host(s).`,
  };
});

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  config = normalizeConfig(newConfig);
  await initialize();
});

// --- Connection lifecycle ----------------------------------------------------
// The SDK itself logs the WebSocket lifecycle (connections, disconnections,
// reconnection attempts) under the `gladys-sdk` name: no need to log it again
// here, this handler only runs the integration's own (re)initialization.
gladys.on('connected', async () => {
  config = normalizeConfig(await gladys.getConfig().catch(() => ({})));
  await initialize();
});

// (Re)build the API client from the current config, discover the proxy hosts,
// publish the devices and their current states, and report the
// application-level connection status shown in the Configuration screen.
// Distinct from the container state machine: the integration can be RUNNING
// and still unable to reach the NPM API.
async function initialize() {
  if (!isConfigComplete(config)) {
    api = null;
    logger.warn('Configuration incomplete: waiting for the NPM URL and credentials');
    await gladys.setConnectionStatus(false, NOT_CONFIGURED_MESSAGE).catch(() => {});
    return;
  }
  api = new NpmApi(config);
  try {
    // Authenticate now so a bad URL/password is reported immediately.
    await api.login();
    await discoverAndPublishDevices();
    await gladys.setConnectionStatus(true);
  } catch (err) {
    logger.error('NPM initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Cannot reach Nginx Proxy Manager: check the URL and the credentials.',
        fr: "Impossible de joindre Nginx Proxy Manager : vérifiez l'URL et les identifiants.",
      })
      .catch(() => {});
  }
}

// Fetch the proxy host list, publish the devices (idempotent upsert by
// external_id) then their current states, so a fresh install is populated
// without waiting for the first poll.
async function discoverAndPublishDevices() {
  requireApi();
  const proxyHosts = await api.getProxyHosts();
  logger.info(`Discovered ${proxyHosts.length} proxy host(s)`);
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config, proxyHosts));
  await publishProxyHostStates(gladys, proxyHosts);
  await server.onPoll(gladys, { api });
}

function requireApi() {
  if (!api) {
    throw new Error('The integration is not configured yet (missing NPM URL or credentials)');
  }
}

// --- Graceful shutdown -------------------------------------------------------
// The SDK disconnects cleanly and exits with code 0 when the supervisor stops
// the container (SIGTERM/SIGINT).
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Nginx Proxy Manager integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
