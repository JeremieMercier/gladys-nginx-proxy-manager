// -----------------------------------------------------------------------------
// Entry point of the Gladys <-> Nginx Proxy Manager integration.
//
// A deliberately minimal integration: it creates NO device. It stores the NPM
// connection settings, verifies them against the NPM admin API, and offers two
// buttons in the Configuration screen:
//   - "Test the connection": checks the URL/credentials, reports the version;
//   - "NPM portal": displays the configured admin portal URL.
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
// This integration manages no device: answer the scan with an empty list so
// the UI does not wait for anything.
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> no device to publish (portal-only integration)');
  await gladys.publishDiscoveredDevices([]);
});

// --- Manifest action: "Test the connection" button ---------------------------
gladys.onAction('test_connection', async () => {
  logger.info('Action test_connection -> live request to the NPM API');
  if (!api) {
    return NOT_CONFIGURED_MESSAGE;
  }
  const [info, counts] = await Promise.all([api.getVersion(), api.getHostCounts()]);
  const version = info?.version
    ? `${info.version.major}.${info.version.minor}.${info.version.revision}`
    : 'unknown';
  return {
    en: `Connected to Nginx Proxy Manager v${version}: ${counts.proxy} proxy host(s).`,
    fr: `Connecté à Nginx Proxy Manager v${version} : ${counts.proxy} proxy host(s).`,
  };
});

// --- Manifest action: "NPM portal" button ------------------------------------
// The declarative Gladys UI cannot open an arbitrary URL from an integration,
// so the button displays the configured portal address instead.
gladys.onAction('open_portal', async () => {
  logger.info('Action open_portal -> displaying the portal URL');
  if (!config.npm_url) {
    return NOT_CONFIGURED_MESSAGE;
  }
  return {
    en: `NPM admin portal: ${config.npm_url}`,
    fr: `Portail d'administration NPM : ${config.npm_url}`,
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

// (Re)build the API client from the current config, verify the credentials and
// report the application-level connection status shown in the Configuration
// screen. Distinct from the container state machine: the integration can be
// RUNNING and still unable to reach the NPM API.
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
