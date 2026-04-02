import knex from 'knex';
import logger from '../utils/logger.js';

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  acquireConnectionTimeout: 10_000,
});

db.raw('SELECT 1')
  .then(() => logger.info('PostgreSQL connected (task-service)'))
  .catch((err) => {
    logger.error({ err }, 'PostgreSQL connection failed');
    process.exit(1);
  });

export default db;
