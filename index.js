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
import { getNpmHealth, waitForNpm, formatVersion, NPM_INTERNAL_URL } from './src/npmApi.js';
import { checkNpmVolumes, describeVolumeResults } from './src/diagnostics.js';

const gladys = new GladysIntegration();

const CONTAINER_NAME = 'npm';
const ADMIN_CONTAINER_PORT = 81;

// When NPM is unreachable, retry the whole initialization at this pace until
// it comes up (image still pulling, slow first boot, container restarting...).
const RETRY_DELAY_MS = 60_000;
let initializing = false;
let retryTimer = null;

// The base URL that last answered: the private DNS alias (http://npm:81)
// or, as a fallback, the admin port published on the host.
let npmBaseUrl = NPM_INTERNAL_URL;

// --- Discovery: Gladys asks for the list of devices --------------------------
// This integration manages no device: answer the scan with an empty list so
// the UI does not wait for anything.
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> no device to publish (container-only integration)');
  await gladys.publishDiscoveredDevices([]);
});

// --- Manifest action: "Check Nginx Proxy Manager" button ---------------------
gladys.onAction('test_connection', async () => {
  logger.info(`Action test_connection -> live request to the NPM API (${npmBaseUrl})`);
  const health = await getNpmHealth(npmBaseUrl);
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
    const container = await ensureContainerRunning();
    const candidates = buildCandidateUrls(container);
    const { health, baseUrl } = await waitForNpm({ candidates });
    npmBaseUrl = baseUrl;
    logger.info(`Nginx Proxy Manager v${formatVersion(health)} is ready at ${baseUrl}`);
    await gladys.setConnectionStatus(true);
  } catch (err) {
    logger.error('NPM initialization failed', err);
    const message = await diagnoseFailure();
    await gladys.setConnectionStatus(false, message).catch(() => {});
    logger.info(`Retrying the NPM initialization in ${RETRY_DELAY_MS / 1000}s`);
    retryTimer = setTimeout(() => initialize(), RETRY_DELAY_MS);
  } finally {
    initializing = false;
  }
}

// When NPM does not come up, probe its volume folders (same uid as the NPM
// processes) to turn the most likely root cause — a volume permissions
// problem — into an explicit Configuration-screen message instead of a
// generic "check the logs".
async function diagnoseFailure() {
  const generic = {
    en: 'Nginx Proxy Manager is not responding, check the npm container logs.',
    fr: 'Nginx Proxy Manager ne répond pas, consultez les logs du conteneur npm.',
  };
  try {
    const { ok, results } = await checkNpmVolumes();
    for (const line of describeVolumeResults(results)) {
      logger.info(`Volume probe: ${line} (integration uid ${process.getuid?.() ?? '?'})`);
    }
    if (ok === false) {
      return {
        en: 'The NPM data folders are not writable (permissions problem on the volumes): see the integration logs for the folder owners, and report this on the integration repository.',
        fr: "Les dossiers de données de NPM ne sont pas accessibles en écriture (problème de permissions sur les volumes) : les logs de l'intégration montrent les propriétaires des dossiers, signalez-le sur le dépôt de l'intégration.",
      };
    }
  } catch (probeErr) {
    logger.warn(`Volume probe failed: ${probeErr.message}`);
  }
  return generic;
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
  return npm;
}

// Ways to reach the NPM API, most direct first: the private DNS alias of the
// sub-container, then — in case that network path fails — its admin port as
// published on the Docker host, whose address is the host of the Gladys API
// URL the supervisor gave us.
function buildCandidateUrls(container) {
  const candidates = [NPM_INTERNAL_URL];
  const adminPort = (container.ports ?? []).find(
    (port) => port.container_port === ADMIN_CONTAINER_PORT,
  );
  const gladysApiUrl = process.env.GLADYS_HOST_API_URL;
  if (adminPort?.host_port && gladysApiUrl) {
    try {
      const { hostname } = new URL(gladysApiUrl);
      candidates.push(`http://${hostname}:${adminPort.host_port}`);
    } catch {
      logger.warn(`Cannot parse GLADYS_HOST_API_URL (${gladysApiUrl}) for the fallback URL`);
    }
  }
  logger.info(`NPM candidate URLs: ${candidates.join(', ')}`);
  return candidates;
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
