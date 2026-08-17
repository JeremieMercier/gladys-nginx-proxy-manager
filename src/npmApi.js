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
 * "fetch failed" hides the real network error: surface the undici cause
 * (ENOTFOUND = the `npm` DNS alias does not resolve, ECONNREFUSED = the
 * container is up but nothing listens on 81 yet, timeouts...).
 * @param {Error} err
 */
export function describeFetchError(err) {
  const cause = err?.cause;
  if (cause?.code || cause?.message) {
    return `${err.message} (${cause.code ?? cause.message})`;
  }
  return err?.message ?? String(err);
}

/**
 * Wait until the NPM container answers on its API. The first start can be
 * long on modest hardware: NPM runs its database migrations and generates a
 * default certificate before listening.
 * @param {{ timeoutMs?: number, intervalMs?: number }} [options]
 * @returns {Promise<{ status: string, version?: object }>} the first healthy answer
 */
export async function waitForNpm({ timeoutMs = 300_000, intervalMs = 5_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  let attempt = 0;
  for (;;) {
    try {
      return await getNpmHealth();
    } catch (err) {
      lastError = err;
      if (Date.now() + intervalMs > deadline) {
        break;
      }
      attempt += 1;
      // One info line every ~30s so `docker logs` shows progress and the
      // underlying network error, without flooding.
      const message = `NPM not ready yet (${describeFetchError(err)}), retrying...`;
      if (attempt % 6 === 1) {
        logger.info(message);
      } else {
        logger.debug(message);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error(
    `NPM did not come up within ${timeoutMs / 1000}s: ${describeFetchError(lastError)}`,
  );
}

/**
 * "2.12.3"-style version string from a health payload, or 'unknown'.
 * @param {{ version?: { major: number, minor: number, revision: number } }} health
 */
export function formatVersion(health) {
  const v = health?.version;
  return v ? `${v.major}.${v.minor}.${v.revision}` : 'unknown';
}
