// =============================================================================
// Migration: Enable PostgreSQL extensions
// =============================================================================
// uuid-ossp provides uuid_generate_v4() used as the default PK generator
// across all tables. Must run before any table creation.
// =============================================================================

/**
 * @param {import('knex').Knex} knex
 */
export const up = async (knex) => {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
};

/**
 * Extensions are shared at the database level. Dropping them here could
 * break other schemas or users, so we intentionally leave them in place.
 *
 * @param {import('knex').Knex} _knex
 */
export const down = async (_knex) => {
  // Intentionally a no-op: extensions are safe to leave installed.
};
