// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. The SDK fetches it for you
// (`gladys.getConfig()`) and notifies you of every change through
// `gladys.onConfigUpdated()`.
//
// This module only provides defaults and normalizes the received object, so the
// rest of the code never has to deal with `undefined`.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest.
export const DEFAULT_CONFIG = {
  npm_url: '', // e.g. http://192.168.1.10:81 — no sensible default, user-provided
  email: '',
  password: '',
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    // Strip the trailing slash(es) so `${npm_url}/api/...` is always valid.
    npm_url: String(raw.npm_url ?? DEFAULT_CONFIG.npm_url)
      .trim()
      .replace(/\/+$/, ''),
    email: String(raw.email ?? DEFAULT_CONFIG.email).trim(),
    password: String(raw.password ?? DEFAULT_CONFIG.password),
  };
}

/**
 * True when the config carries everything needed to reach the NPM API.
 * @param {ReturnType<typeof normalizeConfig>} config
 */
export function isConfigComplete(config) {
  return Boolean(config.npm_url && config.email && config.password);
}
