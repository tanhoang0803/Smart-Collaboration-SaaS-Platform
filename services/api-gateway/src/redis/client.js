// =============================================================================
// IORedis singleton for the API gateway
//
// Key naming conventions used by the gateway:
//   blacklist:<jti>      — revoked access token JTIs (set by auth-service on logout)
//   rl:unauth:<ip>       — unauthenticated rate-limit counter (managed by rate-limit-redis)
//   rl:auth:<jti>        — authenticated rate-limit counter (managed by rate-limit-redis)
//
// The gateway is read-only with respect to the blacklist — it only checks
// whether a JTI exists. The auth-service writes to blacklist:<jti> on logout.
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
    // Retry strategy — exponential backoff, up to 30 attempts
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 30) {
        logger.error('Redis: max reconnection attempts reached');
        return null; // stop retrying
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis: reconnecting...');
      return delay;
    },
    keepAlive: 10_000,
    connectTimeout: 10_000,
    // lazyConnect: false — connect immediately on startup so health checks work
    lazyConnect: false,
  });

  _redis.on('connect', () => logger.info('Redis connection established'));
  _redis.on('ready', () => logger.info('Redis client ready'));
  _redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  _redis.on('close', () => logger.warn('Redis connection closed'));
  _redis.on('reconnecting', () => logger.warn('Redis reconnecting'));

  return _redis;
}

export const redis = createRedisClient();
