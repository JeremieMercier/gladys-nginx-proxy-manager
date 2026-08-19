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
export const NPM_INTERNAL_URL = process.env.NPM_BASE_URL ?? 'http://npm:81';

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * API health/version info of the NPM instance.
 * @param {string} [baseUrl]
 * @returns {Promise<{ status: string, version?: { major: number, minor: number, revision: number } }>}
 */
export async function getNpmHealth(baseUrl = NPM_INTERNAL_URL) {
  const response = await fetch(`${baseUrl}/api/`, {
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
 * Wait until the NPM container answers on its API, trying every candidate
 * base URL on each round (the private DNS alias first, then the host-published
 * port as a fallback). The first start can be long on modest hardware: NPM
 * runs its database migrations and generates a default certificate before
 * listening.
 * @param {{ candidates?: string[], timeoutMs?: number, intervalMs?: number }} [options]
 * @returns {Promise<{ health: object, baseUrl: string }>} the first healthy answer and the URL that gave it
 */
export async function waitForNpm({
  candidates = [NPM_INTERNAL_URL],
  timeoutMs = 300_000,
  intervalMs = 5_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  const failures = new Map();
  let round = 0;
  for (;;) {
    for (const baseUrl of candidates) {
      try {
        const health = await getNpmHealth(baseUrl);
        return { health, baseUrl };
      } catch (err) {
        failures.set(baseUrl, describeFetchError(err));
      }
    }
    if (Date.now() + intervalMs > deadline) {
      break;
    }
    round += 1;
    // A normal first boot takes ~25s (DB migrations, nginx startup): stay
    // quiet at info level for the first ~30s, then one info line every ~30s
    // with the underlying network error per URL, without flooding.
    const summary = [...failures].map(([url, reason]) => `${url}: ${reason}`).join(' | ');
    if (round % 6 === 0) {
      logger.info(`NPM not ready yet (${summary}), retrying...`);
    } else {
      logger.debug(`NPM not ready yet (${summary}), retrying...`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const summary = [...failures].map(([url, reason]) => `${url}: ${reason}`).join(' | ');
  throw new Error(`NPM did not come up within ${timeoutMs / 1000}s: ${summary}`);
}

/**
 * "2.12.3"-style version string from a health payload, or 'unknown'.
 * @param {{ version?: { major: number, minor: number, revision: number } }} health
 */
export function formatVersion(health) {
  const v = health?.version;
  return v ? `${v.major}.${v.minor}.${v.revision}` : 'unknown';
}
