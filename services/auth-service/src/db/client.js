// =============================================================================
// Knex (PostgreSQL) singleton client
//
// A single connection pool is created on first import and reused for the
// lifetime of the process. This pattern avoids exhausting DB connections when
// modules are hot-reloaded in development.
// =============================================================================

import knex from 'knex';
import logger from '../utils/logger.js';

/** @type {import('knex').Knex | null} */
let _db = null;

/**
 * Returns the singleton Knex instance, creating it on first call.
 * @returns {import('knex').Knex}
 */
function createClient() {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const isProduction = process.env.NODE_ENV === 'production';

  _db = knex({
    client: 'pg',
    connection: isProduction
      ? { connectionString, ssl: { rejectUnauthorized: false } }
      : connectionString,
    pool: {
      min: 2,
      max: 10,
      // Destroy idle connections after 30 s to avoid stale connections
      idleTimeoutMillis: 30_000,
      // Fail fast if a connection cannot be acquired within 10 s
      acquireTimeoutMillis: 10_000,
    },
    // Log queries in development when KNEX_DEBUG=true
    debug: process.env.KNEX_DEBUG === 'true',
    asyncStackTraces: process.env.NODE_ENV !== 'production',
  });

  // Verify connectivity at startup
  _db.raw('SELECT 1')
    .then(() => logger.info('PostgreSQL connection pool established'))
    .catch((err) => {
      logger.error({ err }, 'Failed to connect to PostgreSQL');
      // Don't crash here — let health checks surface the problem
    });

  return _db;
}

const db = createClient();

export default db;
