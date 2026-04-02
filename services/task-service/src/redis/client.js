import Redis from 'ioredis';
import logger from '../utils/logger.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected (task-service)'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));

await redis.connect();

// ---------------------------------------------------------------------------
// Pub/Sub publisher (dedicated connection — cannot share with subscriber)
// ---------------------------------------------------------------------------
const publisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
await publisher.connect();

/**
 * Publish a task event to Redis pub/sub.
 * @param {string} event  e.g. 'task.created'
 * @param {object} payload
 */
export async function publishTaskEvent(event, payload) {
  await publisher.publish('task-events', JSON.stringify({ event, payload }));
}

export default redis;
