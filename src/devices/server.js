// -----------------------------------------------------------------------------
// Device type: SERVER
// The Nginx Proxy Manager instance itself, exposed as a read-only monitoring
// device: host counts (as on the NPM dashboard), certificate count, and the
// number of days before the next certificate expires.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

const DEVICE_TYPE = 'server';

const logger = createLogger({ name: DEVICE_TYPE });

// One NPM instance per integration instance: the platform id is a constant.
const PLATFORM_DEVICE_ID = 'main';

export const FEATURE = {
  PROXY_HOSTS: 'proxy-hosts',
  REDIRECTION_HOSTS: 'redirection-hosts',
  STREAMS: 'streams',
  DEAD_HOSTS: 'dead-hosts',
  CERTIFICATES: 'certificates',
  CERTIFICATE_EXPIRY: 'certificate-expiry',
};

function counterFeature(ids, key, name) {
  return {
    name,
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
    type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
    min: 0,
    max: 100000,
    read_only: true,
    has_feedback: false,
    keep_history: true,
  };
}

export const server = {
  key: DEVICE_TYPE,

  deviceExternalId(gladys) {
    return gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID).device;
  },

  buildDevice(gladys, config) {
    const ids = gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID);
    return {
      name: 'Nginx Proxy Manager',
      external_id: ids.device,
      // Gladys will call onPoll at this interval (in seconds).
      poll_frequency: config.poll_frequency,
      features: [
        counterFeature(ids, FEATURE.PROXY_HOSTS, 'Proxy hosts'),
        counterFeature(ids, FEATURE.REDIRECTION_HOSTS, 'Redirection hosts'),
        counterFeature(ids, FEATURE.STREAMS, 'Streams'),
        counterFeature(ids, FEATURE.DEAD_HOSTS, '404 hosts'),
        counterFeature(ids, FEATURE.CERTIFICATES, 'SSL certificates'),
        {
          name: 'Next certificate expiry',
          external_id: ids.feature(FEATURE.CERTIFICATE_EXPIRY),
          category: DEVICE_FEATURE_CATEGORIES.DURATION,
          type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
          unit: DEVICE_FEATURE_UNITS.DAYS,
          min: 0,
          max: 10000,
          read_only: true,
          has_feedback: false,
          keep_history: true,
        },
      ],
    };
  },

  // Read the dashboard counters and the certificates, publish everything in
  // one batch. `api` is the authenticated NpmApi client owned by index.js.
  async onPoll(gladys, { api }) {
    const ids = gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID);
    logger.debug('Polling NPM host counts and certificates...');

    const [counts, certificates] = await Promise.all([api.getHostCounts(), api.getCertificates()]);

    const states = [
      {
        device_feature_external_id: ids.feature(FEATURE.PROXY_HOSTS),
        state: Number(counts.proxy ?? 0),
      },
      {
        device_feature_external_id: ids.feature(FEATURE.REDIRECTION_HOSTS),
        state: Number(counts.redirection ?? 0),
      },
      {
        device_feature_external_id: ids.feature(FEATURE.STREAMS),
        state: Number(counts.stream ?? 0),
      },
      {
        device_feature_external_id: ids.feature(FEATURE.DEAD_HOSTS),
        state: Number(counts.dead ?? 0),
      },
      {
        device_feature_external_id: ids.feature(FEATURE.CERTIFICATES),
        state: certificates.length,
      },
    ];

    const daysToExpiry = nextCertificateExpiryInDays(certificates);
    if (daysToExpiry !== null) {
      states.push({
        device_feature_external_id: ids.feature(FEATURE.CERTIFICATE_EXPIRY),
        state: daysToExpiry,
      });
    }

    await gladys.publishStates(states);
  },
};

/**
 * Days (floored, >= 0) before the soonest `expires_on` of the certificate
 * list, or null when there is no certificate to look at.
 * @param {Array<{ expires_on?: string }>} certificates
 * @param {number} [now] injectable for tests
 */
export function nextCertificateExpiryInDays(certificates, now = Date.now()) {
  const expiries = certificates
    .map((cert) => Date.parse(cert.expires_on ?? ''))
    .filter((timestamp) => !Number.isNaN(timestamp));
  if (expiries.length === 0) {
    return null;
  }
  const soonest = Math.min(...expiries);
  return Math.max(0, Math.floor((soonest - now) / 86_400_000));
}
