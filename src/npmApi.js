// -----------------------------------------------------------------------------
// Driver for the Nginx Proxy Manager (NPM) REST API.
//
// This is where we talk to the outside world: the NPM admin API, the same one
// its web UI uses (http://<host>:81/api by default).
//
// Authentication: POST /api/tokens with the admin email/password returns a JWT
// (`{ token, expires }`). Every other call sends it as a Bearer token. The
// client caches the token and transparently re-authenticates when it expires
// or when the API answers 401.
//
// Endpoints used:
//   - GET  /api/                                  -> { status, version }
//   - GET  /api/nginx/proxy-hosts                 -> proxy host list
//   - GET  /api/nginx/proxy-hosts/{id}            -> one proxy host
//   - POST /api/nginx/proxy-hosts/{id}/enable     -> enable a proxy host
//   - POST /api/nginx/proxy-hosts/{id}/disable    -> disable a proxy host
//   - GET  /api/reports/hosts                     -> { proxy, redirection, stream, dead }
//   - GET  /api/nginx/certificates               -> certificate list
//
// Node 20+ provides `fetch` natively: no dependency needed.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'npm-api' });

const REQUEST_TIMEOUT_MS = 10_000;
// Re-authenticate a bit before the announced expiry to avoid racing it.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export class NpmApi {
  /**
   * @param {{ npm_url: string, email: string, password: string }} config
   */
  constructor({ npm_url, email, password }) {
    this.baseUrl = String(npm_url ?? '').replace(/\/+$/, '');
    this.email = email;
    this.password = password;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Authenticate against /api/tokens and cache the JWT.
   */
  async login() {
    logger.debug(`Authenticating on ${this.baseUrl}/api/tokens`);
    const response = await fetch(`${this.baseUrl}/api/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: this.email, secret: this.password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`NPM authentication failed (HTTP ${response.status})`);
    }
    const body = await response.json();
    if (!body.token) {
      throw new Error('NPM authentication failed (no token in response)');
    }
    this.token = body.token;
    const expires = Date.parse(body.expires ?? '');
    this.tokenExpiresAt = Number.isNaN(expires) ? Date.now() + 3_600_000 : expires;
  }

  /**
   * Authenticated request against the NPM API, with one automatic re-login on
   * an expired/rejected token.
   * @param {string} path e.g. '/api/nginx/proxy-hosts'
   * @param {{ method?: string }} [options]
   * @param {boolean} [retryOnAuthFailure]
   */
  async request(path, { method = 'GET' } = {}, retryOnAuthFailure = true) {
    if (!this.token || Date.now() >= this.tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS) {
      await this.login();
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 401 && retryOnAuthFailure) {
      logger.debug('Token rejected (401), re-authenticating once');
      this.token = null;
      return this.request(path, { method }, false);
    }
    if (!response.ok) {
      throw new Error(`NPM API ${method} ${path} failed (HTTP ${response.status})`);
    }
    return response.json();
  }

  /**
   * API health/version info (also proves the URL points at an NPM instance).
   * @returns {Promise<{ status: string, version: { major: number, minor: number, revision: number } }>}
   */
  async getVersion() {
    const response = await fetch(`${this.baseUrl}/api/`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`NPM API not reachable (HTTP ${response.status})`);
    }
    return response.json();
  }

  /**
   * All the proxy hosts configured on the instance.
   * @returns {Promise<Array<object>>}
   */
  async getProxyHosts() {
    return this.request('/api/nginx/proxy-hosts');
  }

  /**
   * One proxy host by id.
   * @param {number} id
   */
  async getProxyHost(id) {
    return this.request(`/api/nginx/proxy-hosts/${id}`);
  }

  /**
   * Enable or disable a proxy host.
   * @param {number} id
   * @param {boolean} enabled
   */
  async setProxyHostEnabled(id, enabled) {
    return this.request(`/api/nginx/proxy-hosts/${id}/${enabled ? 'enable' : 'disable'}`, {
      method: 'POST',
    });
  }

  /**
   * Host counts, as shown on the NPM dashboard.
   * @returns {Promise<{ proxy: number, redirection: number, stream: number, dead: number }>}
   */
  async getHostCounts() {
    return this.request('/api/reports/hosts');
  }

  /**
   * All the SSL certificates managed by the instance.
   * @returns {Promise<Array<object>>}
   */
  async getCertificates() {
    return this.request('/api/nginx/certificates');
  }
}
