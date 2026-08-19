// -----------------------------------------------------------------------------
// Unit tests of the volume write-access probe, against real temp directories.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkNpmVolumes, describeVolumeResults } from '../src/diagnostics.js';

async function makeVolumeTree() {
  const base = await mkdtemp(join(tmpdir(), 'npm-volumes-'));
  await mkdir(join(base, 'data'), { recursive: true });
  await mkdir(join(base, 'etc', 'letsencrypt'), { recursive: true });
  return base;
}

test('ok=true when every volume folder is writable', async () => {
  const base = await makeVolumeTree();
  try {
    const { ok, results } = await checkNpmVolumes(base);
    assert.equal(ok, true);
    assert.deepEqual(
      results.map((r) => r.status),
      ['writable', 'writable'],
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('ok=false when a volume folder exists but is not writable', async (t) => {
  if (process.getuid?.() === 0) {
    t.skip('running as root: permissions are not enforced');
    return;
  }
  const base = await makeVolumeTree();
  try {
    await chmod(join(base, 'data'), 0o500);
    const { ok, results } = await checkNpmVolumes(base);
    assert.equal(ok, false);
    const dataResult = results.find((r) => r.dir.endsWith('/data'));
    assert.equal(dataResult.status, 'unwritable');
    assert.ok(dataResult.uid !== undefined, 'the probe reports the folder owner');
  } finally {
    await chmod(join(base, 'data'), 0o700);
    await rm(base, { recursive: true, force: true });
  }
});

test('ok=null when the folders do not exist yet', async () => {
  const { ok, results } = await checkNpmVolumes(join(tmpdir(), 'npm-volumes-does-not-exist'));
  assert.equal(ok, null);
  assert.deepEqual(
    results.map((r) => r.status),
    ['missing', 'missing'],
  );
});

test('describeVolumeResults renders one line per folder', () => {
  const lines = describeVolumeResults([
    { dir: '/x/data', status: 'unwritable', uid: 1000, gid: 1000, error: 'EACCES' },
    { dir: '/x/etc/letsencrypt', status: 'missing', error: 'ENOENT' },
  ]);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /unwritable, owner 1000:1000, EACCES/);
  assert.match(lines[1], /missing, ENOENT/);
});
