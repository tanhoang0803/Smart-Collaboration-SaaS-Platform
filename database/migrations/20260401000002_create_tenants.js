// =============================================================================
// Migration: Create tenants table
// =============================================================================
// The tenant is the root entity of the multi-tenant model. Every other table
// carries a tenant_id foreign key that references this table.
// =============================================================================

/**
 * @param {import('knex').Knex} knex
 */
export const up = async (knex) => {
  await knex.schema.createTable('tenants', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));

    table.string('name', 255).notNullable();

    // URL-safe unique identifier, used in X-Tenant-ID header and subdomains
    table.string('slug', 100).notNullable().unique();

    table
      .string('plan', 50)
      .notNullable()
      .defaultTo('free')
      .comment("One of: 'free', 'pro', 'enterprise'");

    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  // Enforce plan values at the DB level — defence against raw SQL inserts
  await knex.raw(`
    ALTER TABLE tenants
    ADD CONSTRAINT tenants_plan_check
    CHECK (plan IN ('free', 'pro', 'enterprise'))
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
export const down = async (knex) => {
  await knex.schema.dropTableIfExists('tenants');
};
