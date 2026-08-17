// -----------------------------------------------------------------------------
// Entry point of the Gladys <-> Nginx Proxy Manager integration.
//
// This integration INSTALLS AND RUNS Nginx Proxy Manager itself: the manifest
// declares the official `jc21/nginx-proxy-manager` image as a sub-container
// (the docker-compose equivalent, translated to the Gladys sandbox), with its
// two data volumes and its three ports. Gladys creates and supervises the
// container (`start: "auto"`), assigns the host ports, and shows an "Open"
// link for the admin portal (browsable port).
//
// The code here is therefore thin: make sure the sub-container is up, wait for
// its API to answer, and report the status in the Configuration screen. No
// device is created — proxy hosts are managed in the NPM web UI.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { getNpmHealth, waitForNpm, formatVersion } from './src/npmApi.js';

const gladys = new GladysIntegration();

const CONTAINER_NAME = 'npm';

// When NPM is unreachable, retry the whole initialization at this pace until
// it comes up (image still pulling, slow first boot, container restarting...).
const RETRY_DELAY_MS = 60_000;
let initializing = false;
let retryTimer = null;

// --- Discovery: Gladys asks for the list of devices --------------------------
// This integration manages no device: answer the scan with an empty list so
// the UI does not wait for anything.
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> no device to publish (container-only integration)');
  await gladys.publishDiscoveredDevices([]);
});

// --- Manifest action: "Check Nginx Proxy Manager" button ---------------------
gladys.onAction('test_connection', async () => {
  logger.info('Action test_connection -> live request to the NPM API');
  const health = await getNpmHealth();
  const version = formatVersion(health);
  return {
    en: `Nginx Proxy Manager v${version} is up and running.`,
    fr: `Nginx Proxy Manager v${version} est démarré et fonctionne.`,
  };
});

// --- Connection lifecycle ----------------------------------------------------
// The SDK itself logs the WebSocket lifecycle (connections, disconnections,
// reconnection attempts) under the `gladys-sdk` name: no need to log it again
// here, this handler only runs the integration's own (re)initialization.
gladys.on('connected', async () => {
  await initialize();
});

// Make sure the NPM sub-container runs, wait for its API and report the
// application-level status shown in the Configuration screen. Distinct from
// the container state machine: this integration can be RUNNING while NPM is
// still initializing its database.
async function initialize() {
  if (initializing) {
    return;
  }
  initializing = true;
  clearTimeout(retryTimer);
  try {
    await ensureContainerRunning();
    const health = await waitForNpm();
    logger.info(`Nginx Proxy Manager v${formatVersion(health)} is ready`);
    await gladys.setConnectionStatus(true);
  } catch (err) {
    logger.error('NPM initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Nginx Proxy Manager is not responding, check the npm container logs.',
        fr: 'Nginx Proxy Manager ne répond pas, consultez les logs du conteneur npm.',
      })
      .catch(() => {});
    logger.info(`Retrying the NPM initialization in ${RETRY_DELAY_MS / 1000}s`);
    retryTimer = setTimeout(() => initialize(), RETRY_DELAY_MS);
  } finally {
    initializing = false;
  }
}

// The manifest declares `start: "auto"`, so the supervisor normally starts the
// sub-container before this one. Still nudge it if it is stopped (e.g. after a
// manual stop from the supervision screen).
async function ensureContainerRunning() {
  const containers = await gladys.getContainers();
  const npm = containers.find((container) => container.name === CONTAINER_NAME);
  if (!npm) {
    throw new Error(`Sub-container "${CONTAINER_NAME}" not found`);
  }
  // Full inventory in the logs: status, desired state and assigned host
  // ports are the first things to look at when NPM is unreachable.
  logger.info(`Sub-container "${CONTAINER_NAME}": ${JSON.stringify(npm)}`);
  if (npm.status !== 'running') {
    logger.info(`Sub-container "${CONTAINER_NAME}" is ${npm.status}: starting it`);
    await gladys.startContainer(CONTAINER_NAME);
  }
}

// --- Graceful shutdown -------------------------------------------------------
// The SDK disconnects cleanly and exits with code 0 when the supervisor stops
// the container (SIGTERM/SIGINT). The NPM sub-container stays under the
// supervisor's responsibility: nothing to stop here.
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Nginx Proxy Manager integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
