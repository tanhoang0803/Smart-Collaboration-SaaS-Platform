// =============================================================================
// Migration: Create refresh_tokens table
// =============================================================================
// Refresh tokens are single-use (rotation on every refresh call). We store
// only the SHA-256 hash of the actual token value — never the raw token —
// so a DB breach cannot be used to impersonate users.
//
// The `revoked` flag allows explicit revocation (logout, suspicious activity)
// without deleting the row, which preserves the audit trail.
// =============================================================================

/**
 * @param {import('knex').Knex} knex
 */
export const up = async (knex) => {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));

    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // SHA-256 hex digest of the opaque token value (64 hex chars)
    table.string('token_hash', 64).notNullable().unique();

    table.timestamp('expires_at', { useTz: true }).notNullable();

    table.boolean('revoked').notNullable().defaultTo(false);

    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.table('refresh_tokens', (table) => {
    // Efficient lookup of all tokens for a given user (e.g., logout all devices)
    table.index('user_id', 'refresh_tokens_user_id_idx');
    // Covered by the UNIQUE constraint but an explicit index for clarity
    table.index('token_hash', 'refresh_tokens_token_hash_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
export const down = async (knex) => {
  await knex.schema.dropTableIfExists('refresh_tokens');
};
