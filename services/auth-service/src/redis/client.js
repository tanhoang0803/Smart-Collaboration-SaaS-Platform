// =============================================================================
// IORedis singleton + auth-specific Redis helpers
//
// Key naming conventions:
//   auth:blacklist:<jti>           — blacklisted access token JTIs
//   auth:login:lockout:<email>     — failed login attempt counter
//   auth:oauth:state:<state>       — CSRF state for OAuth flows
// =============================================================================

import Redis from 'ioredis';
import logger from '../utils/logger.js';

/** @type {Redis | null} */
let _redis = null;

function createRedisClient() {
  if (_redis) return _redis;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  _redis = new Redis(redisUrl, {
    // Reconnect with exponential backoff — up to 30 retries
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 30) {
        logger.error('Redis: max reconnection attempts reached');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis: reconnecting...');
      return delay;
    },
    // Keep-alive to detect dead connections
    keepAlive: 10_000,
    connectTimeout: 10_000,
    // Lazy connect: don't throw during module load if Redis is unreachable
    lazyConnect: false,
  });

  _redis.on('connect', () => logger.info('Redis connection established'));
  _redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  _redis.on('close', () => logger.warn('Redis connection closed'));

  return _redis;
}

export const redis = createRedisClient();

// ---------------------------------------------------------------------------
// Token blacklist — used on logout and refresh rotation
// ---------------------------------------------------------------------------

/**
 * Add a JTI to the token blacklist.
 * TTL should match the remaining validity of the access token.
 *
 * @param {string} jti         JWT ID (UUID v4)
 * @param {number} ttlSeconds  Time-to-live in seconds
 */
export async function blacklistToken(jti, ttlSeconds) {
  // Ensure at least 1 second TTL to avoid immediate expiry
  const ttl = Math.max(Math.ceil(ttlSeconds), 1);
  await redis.set(`auth:blacklist:${jti}`, '1', 'EX', ttl);
}

/**
 * Check whether a JTI has been blacklisted.
 *
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
export async function isTokenBlacklisted(jti) {
  const result = await redis.exists(`auth:blacklist:${jti}`);
  return result === 1;
}

// ---------------------------------------------------------------------------
// OAuth2 state parameter (CSRF protection)
// ---------------------------------------------------------------------------

/**
 * Persist an OAuth state value with a short TTL.
 *
 * @param {string} state          Cryptographically random string
 * @param {object} data           Any additional data to bind to the state
 * @param {number} [ttlSeconds]   Default 10 minutes
 */
export async function setOAuthState(state, data, ttlSeconds = 600) {
  await redis.set(
    `auth:oauth:state:${state}`,
    JSON.stringify(data),
    'EX',
    ttlSeconds,
  );
}

/**
 * Retrieve an OAuth state value. Returns null if expired or not found.
 *
 * @param {string} state
 * @returns {Promise<object | null>}
 */
export async function getOAuthState(state) {
  const raw = await redis.get(`auth:oauth:state:${state}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Delete an OAuth state value after it has been consumed.
 *
 * @param {string} state
 */
export async function deleteOAuthState(state) {
  await redis.del(`auth:oauth:state:${state}`);
}

// ---------------------------------------------------------------------------
// Login rate-limiting (brute-force protection)
// ---------------------------------------------------------------------------

const LOCKOUT_KEY_PREFIX = 'auth:login:lockout:';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Increment failed login counter. Returns the new count.
 * Sets TTL on first increment.
 *
 * @param {string} email
 * @returns {Promise<number>} current attempt count
 */
export async function incrementLoginFailures(email) {
  const key = `${LOCKOUT_KEY_PREFIX}${email.toLowerCase()}`;
  const count = await redis.incr(key);
  if (count === 1) {
    // Set TTL on first failure — subsequent failures extend nothing
    await redis.expire(key, LOCKOUT_TTL_SECONDS);
  }
  return count;
}

/**
 * Check whether an email is currently locked out.
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function isLoginLocked(email) {
  const key = `${LOCKOUT_KEY_PREFIX}${email.toLowerCase()}`;
  const count = await redis.get(key);
  return count !== null && parseInt(count, 10) >= MAX_FAILED_ATTEMPTS;
}

/**
 * Clear the failed login counter after a successful login.
 *
 * @param {string} email
 */
export async function clearLoginFailures(email) {
  await redis.del(`${LOCKOUT_KEY_PREFIX}${email.toLowerCase()}`);
}
