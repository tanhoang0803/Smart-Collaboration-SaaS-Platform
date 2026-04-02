// =============================================================================
// Migration: Create users table
// =============================================================================
// Supports both password-based and OAuth2 authentication. The password_hash
// column is nullable to allow pure-OAuth users to exist without a local
// credential. The (tenant_id, email) unique constraint ensures email
// uniqueness within a tenant while allowing the same email across tenants.
// =============================================================================

/**
 * @param {import('knex').Knex} knex
 */
export const up = async (knex) => {
  await knex.schema.createTable('users', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));

    table
      .uuid('tenant_id')
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');

    table.string('email', 255).notNullable();

    // Nullable: OAuth-only users never set a password
    table.string('password_hash', 255).nullable();

    table
      .string('role', 50)
      .notNullable()
      .defaultTo('member')
      .comment("One of: 'admin', 'member', 'viewer'");

    // OAuth2 fields — both nullable; populated only for SSO users
    table.string('oauth_provider', 50).nullable();
    table.string('oauth_provider_id', 255).nullable();

    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    // A user's email must be unique within their tenant
    table.unique(['tenant_id', 'email'], { indexName: 'users_tenant_id_email_unique' });
  });

  // Role check constraint
  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'member', 'viewer'))
  `);

  // Index for efficient tenant-scoped user lookups
  await knex.schema.table('users', (table) => {
    table.index('tenant_id', 'users_tenant_id_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
export const down = async (knex) => {
  await knex.schema.dropTableIfExists('users');
};
