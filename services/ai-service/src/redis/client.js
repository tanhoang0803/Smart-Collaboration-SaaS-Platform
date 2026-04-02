// =============================================================================
// IORedis singleton + AI-service-specific Redis helpers
//
// Key naming conventions:
//   ai:suggest:<sha256>   — cached suggestion result (TTL 600s)
//   ai:draft:<sha256>     — cached draft result (not currently used)
//   ai:review:<sha256>    — cached review result (not currently used)
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
// AI suggestion cache helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached AI suggestion by cache key.
 * Returns the parsed object, or null if not found / expired.
 *
 * @param {string} key  Cache key (e.g. "ai:suggest:<sha256>")
 * @returns {Promise<object | null>}
 */
export async function getCachedSuggestion(key) {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    // Non-fatal — cache miss is safe to swallow; we fall through to the AI call
    logger.warn({ err, key }, 'Redis cache GET error — treating as cache miss');
    return null;
  }
}

/**
 * Store an AI suggestion result in Redis with the given TTL.
 *
 * @param {string} key          Cache key
 * @param {object} data         The suggestion object to serialise
 * @param {number} [ttl=600]    Time-to-live in seconds (default: 10 minutes)
 */
export async function cacheSuggestion(key, data, ttl = 600) {
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
    logger.debug({ key, ttl }, 'AI suggestion cached');
  } catch (err) {
    // Non-fatal — failing to write cache should not block the response
    logger.warn({ err, key }, 'Redis cache SET error — result not cached');
  }
}
