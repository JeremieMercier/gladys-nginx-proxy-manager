// -----------------------------------------------------------------------------
// Self-diagnostics for the npm sub-container volumes.
//
// The sub-container volumes are sub-folders of the integration data folder:
// seen from THIS container, /data/containers/npm/data and
// /data/containers/npm/etc/letsencrypt. The integration process runs under
// the same uid as the NPM processes (1000, the Gladys integration user), so
// probing write access from here predicts exactly whether NPM itself will be
// able to write — and turns a cryptic container crash-loop into an explicit
// permissions message in the Configuration screen.
// -----------------------------------------------------------------------------

import { writeFile, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Overridable for tests and local runs.
export const NPM_VOLUMES_PATH = process.env.NPM_VOLUMES_PATH ?? '/data/containers/npm';

// The volume paths declared in the manifest `containers` field, relative to
// the sub-container data folder.
const VOLUME_SUBFOLDERS = ['data', 'etc/letsencrypt'];

/**
 * Probe every NPM volume folder for write access.
 * @param {string} [basePath]
 * @returns {Promise<{ ok: boolean|null, results: Array<{ dir: string, status: string, uid?: number, gid?: number, error?: string }> }>}
 *   ok=true: all writable; ok=false: at least one exists but is NOT writable
 *   (a permissions problem); ok=null: cannot conclude (folders missing, e.g.
 *   the sub-container was never created).
 */
export async function checkNpmVolumes(basePath = NPM_VOLUMES_PATH) {
  const results = [];
  for (const subfolder of VOLUME_SUBFOLDERS) {
    results.push(await probeDirectory(join(basePath, subfolder)));
  }
  if (results.some((result) => result.status === 'unwritable')) {
    return { ok: false, results };
  }
  if (results.every((result) => result.status === 'writable')) {
    return { ok: true, results };
  }
  return { ok: null, results };
}

async function probeDirectory(dir) {
  let info;
  try {
    info = await stat(dir);
  } catch (err) {
    return { dir, status: 'missing', error: err.code ?? err.message };
  }
  const probeFile = join(dir, `.gladys-write-probe-${process.pid}`);
  try {
    await writeFile(probeFile, 'probe');
    await unlink(probeFile);
    return { dir, status: 'writable', uid: info.uid, gid: info.gid };
  } catch (err) {
    return {
      dir,
      status: 'unwritable',
      uid: info.uid,
      gid: info.gid,
      error: err.code ?? err.message,
    };
  }
}

/**
 * One log-friendly line per probed folder.
 * @param {Awaited<ReturnType<typeof checkNpmVolumes>>['results']} results
 */
export function describeVolumeResults(results) {
  return results.map((result) => {
    const owner = result.uid !== undefined ? `, owner ${result.uid}:${result.gid}` : '';
    const error = result.error ? `, ${result.error}` : '';
    return `${result.dir}: ${result.status}${owner}${error}`;
  });
}
