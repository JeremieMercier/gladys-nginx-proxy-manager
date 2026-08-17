import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, isConfigComplete, DEFAULT_CONFIG } from '../src/config.js';

test('normalizeConfig applies the defaults on an empty config', () => {
  const config = normalizeConfig();
  assert.equal(config.npm_url, DEFAULT_CONFIG.npm_url);
  assert.equal(config.poll_frequency, DEFAULT_CONFIG.poll_frequency);
});

test('normalizeConfig strips trailing slashes from the URL', () => {
  const config = normalizeConfig({ npm_url: 'http://192.168.1.10:81///' });
  assert.equal(config.npm_url, 'http://192.168.1.10:81');
});

test('normalizeConfig trims the URL and email', () => {
  const config = normalizeConfig({
    npm_url: ' http://npm.local:81 ',
    email: ' admin@example.com ',
  });
  assert.equal(config.npm_url, 'http://npm.local:81');
  assert.equal(config.email, 'admin@example.com');
});

test('normalizeConfig forces poll_frequency to a number', () => {
  const config = normalizeConfig({ poll_frequency: '120' });
  assert.equal(config.poll_frequency, 120);
});

test('isConfigComplete requires URL, email and password', () => {
  assert.equal(isConfigComplete(normalizeConfig()), false);
  assert.equal(isConfigComplete(normalizeConfig({ npm_url: 'http://npm:81' })), false);
  assert.equal(
    isConfigComplete(
      normalizeConfig({ npm_url: 'http://npm:81', email: 'a@b.c', password: 'secret' }),
    ),
    true,
  );
});
