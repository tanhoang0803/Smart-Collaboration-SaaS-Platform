'use strict';

// =============================================================================
// Knex Configuration — CommonJS (.cjs) for CLI compatibility
// =============================================================================
// The project uses ES Modules ("type": "module" in package.json) but the
// Knex CLI requires a CommonJS config file. The .cjs extension tells Node.js
// to treat this specific file as CommonJS regardless of the package setting.
//
// Usage:
//   npx knex migrate:latest --knexfile knexfile.cjs
//   npx knex migrate:rollback --knexfile knexfile.cjs
//   npx knex seed:run --knexfile knexfile.cjs
// =============================================================================

const path = require('path');

/** @type {import('knex').Knex.Config} */
const base = {
  client: 'postgresql',
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    loadExtensions: ['.js'],
    // Knex uses a migrations table to track which files have been run.
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    loadExtensions: ['.js'],
  },
};

/** @type {Record<string, import('knex').Knex.Config>} */
const config = {
  // --------------------------------------------------------------------------
  // Development
  // --------------------------------------------------------------------------
  development: {
    ...base,
    connection:
      process.env.DATABASE_URL ||
      'postgresql://user:pass@localhost:5432/smartcollab',
    pool: {
      min: 2,
      max: 10,
    },
    // Log every query in development for debugging
    debug: process.env.KNEX_DEBUG === 'true',
  },

  // --------------------------------------------------------------------------
  // Test
  // --------------------------------------------------------------------------
  test: {
    ...base,
    connection:
      process.env.DATABASE_URL_TEST ||
      'postgresql://user:pass@localhost:5432/smartcollab_test',
    pool: {
      min: 1,
      max: 5,
    },
  },

  // --------------------------------------------------------------------------
  // Production
  // --------------------------------------------------------------------------
  production: {
    ...base,
    connection: {
      connectionString: process.env.DATABASE_URL,
      // Required by most managed PostgreSQL providers (Render, Railway, etc.)
      // that present TLS certificates signed by their own CA.
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 2,
      max: 20,
    },
  },
};

module.exports = config;
