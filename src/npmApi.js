// -----------------------------------------------------------------------------
// Health-check driver for the Nginx Proxy Manager (NPM) sub-container.
//
// The manifest declares NPM as a sub-container named `npm`: that name is also
// its DNS alias on the private network of the integration, so the API is
// always reachable at http://npm:81 from this container — no configuration.
//
// Only the unauthenticated health endpoint is used:
//   - GET /api/ -> { status: "OK", version: { major, minor, revision } }
// Managing the proxy hosts themselves stays in the NPM web UI.
//
// Node 20+ provides `fetch` natively: no dependency needed.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'npm-api' });

// Overridable for local runs/tests outside the Gladys network.
export const NPM_BASE_URL = process.env.NPM_BASE_URL ?? 'http://npm:81';

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * API health/version info of the NPM instance.
 * @returns {Promise<{ status: string, version?: { major: number, minor: number, revision: number } }>}
 */
export async function getNpmHealth() {
  const response = await fetch(`${NPM_BASE_URL}/api/`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`NPM API not reachable (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Wait until the NPM container answers on its API — it needs a little while
 * to initialize its database on the first start.
 * @param {{ timeoutMs?: number, intervalMs?: number }} [options]
 * @returns {Promise<{ status: string, version?: object }>} the first healthy answer
 */
export async function waitForNpm({ timeoutMs = 120_000, intervalMs = 3_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  for (;;) {
    try {
      return await getNpmHealth();
    } catch (err) {
      lastError = err;
      if (Date.now() + intervalMs > deadline) {
        break;
      }
      logger.debug(`NPM not ready yet (${err.message}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error(`NPM did not come up within ${timeoutMs / 1000}s: ${lastError?.message}`);
}

/**
 * "2.12.3"-style version string from a health payload, or 'unknown'.
 * @param {{ version?: { major: number, minor: number, revision: number } }} health
 */
export function formatVersion(health) {
  const v = health?.version;
  return v ? `${v.major}.${v.minor}.${v.revision}` : 'unknown';
}
