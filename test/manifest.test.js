// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

// Actions registered in index.js (gladys.onAction calls).
const REGISTERED_ACTIONS = ['test_connection'];

test('every manifest action has a registered handler', () => {
  const handled = new Set(REGISTERED_ACTIONS);
  for (const action of manifest.actions ?? []) {
    assert.ok(handled.has(action.key), `manifest action "${action.key}" has no handler`);
  }
});

test('declaring catalog categories requires Gladys >= 4.86.0', () => {
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  const minVersion = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.\d+/);
  assert.ok(minVersion, 'gladys_version must declare a minimum version');
  const [, major, minor] = minVersion.map(Number);
  assert.ok(
    major > 4 || (major === 4 && minor >= 86),
    `categories requires gladys_version >= 4.86.0, got "${manifest.gladys_version}"`,
  );
});

test('the npm sub-container matches what the code supervises', () => {
  // index.js health-checks http://npm:81 and (re)starts the container named
  // "npm": the manifest must declare exactly that.
  assert.equal(manifest.containers.length, 1);
  const [npm] = manifest.containers;
  assert.equal(npm.name, 'npm');
  assert.match(npm.docker_image, /^jc21\/nginx-proxy-manager:/);
  assert.equal(npm.start, 'auto', 'the supervisor must start NPM before the integration');
  const adminPort = npm.ports.find((port) => port.container_port === 81);
  assert.ok(adminPort, 'the admin UI port (81) must be published');
  assert.notEqual(adminPort.browsable, false, 'the admin port must show an "Open" link');
});

test('the npm sub-container persists its data', () => {
  // The docker-compose of NPM mounts ./data:/data and
  // ./letsencrypt:/etc/letsencrypt — same persistence here, host side managed
  // by the Gladys supervisor.
  const [npm] = manifest.containers;
  assert.ok(npm.volumes.includes('/data'), 'NPM stores its database under /data');
  assert.ok(
    npm.volumes.includes('/etc/letsencrypt'),
    'NPM stores its certificates under /etc/letsencrypt',
  );
});

test('every {{port:<name>}} placeholder references a declared port name', () => {
  const declaredNames = new Set(
    (manifest.containers ?? []).flatMap((container) =>
      (container.ports ?? []).map((port) => port.name).filter(Boolean),
    ),
  );
  const texts = manifest.config_schema
    .filter((field) => field.type === 'section')
    .flatMap((section) => Object.values(section.description ?? {}));
  for (const text of texts) {
    for (const [, name] of text.matchAll(/\{\{port:([a-z0-9_]+)\}\}/g)) {
      assert.ok(
        declaredNames.has(name),
        `placeholder {{port:${name}}} references no declared port`,
      );
    }
  }
});

test('section fields are purely presentational', () => {
  const sections = manifest.config_schema.filter((f) => f.type === 'section');
  assert.ok(sections.length > 0);
  for (const section of sections) {
    // A section stores NO value: declaring `required`, `default` or
    // `placeholder` on it rejects the manifest.
    assert.equal(section.required, undefined, `section "${section.key}" must not be required`);
    assert.equal(section.default, undefined, `section "${section.key}" must not have a default`);
    assert.equal(
      section.placeholder,
      undefined,
      `section "${section.key}" must not have a placeholder`,
    );
    assert.ok(section.label?.en, `section "${section.key}" needs an English label`);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//, 'section links must be https');
    }
  }
});
