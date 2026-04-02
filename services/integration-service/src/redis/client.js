import Redis from 'ioredis';
import logger from '../utils/logger.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected (integration-service)'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));

await redis.connect();

export default redis;
