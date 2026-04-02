// =============================================================================
// Migration: Create integrations table
// =============================================================================
// Stores per-tenant third-party integration credentials. OAuth tokens are
// encrypted at rest with AES-256-GCM before being written to this table.
// The stored format is: "<hex-nonce>:<hex-ciphertext>" (see crypto util).
//
// The (tenant_id, provider) unique constraint means a tenant can have at
// most one active integration per provider. To add a second Slack workspace,
// a future migration would relax this constraint.
// =============================================================================

/**
 * @param {import('knex').Knex} knex
 */
export const up = async (knex) => {
  await knex.schema.createTable('integrations', (table) => {
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

    table
      .string('provider', 50)
      .notNullable()
      .comment("One of: 'slack', 'github', 'trello', 'google_calendar'");

    // AES-256-GCM encrypted tokens stored as "nonce:ciphertext" hex strings
    table.text('access_token_enc').nullable();
    table.text('refresh_token_enc').nullable();

    // Provider-specific configuration (webhook URLs, channel IDs, repo names…)
    table.jsonb('config').notNullable().defaultTo('{}');

    table.timestamp('last_synced_at', { useTz: true }).nullable();

    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    // One active integration per provider per tenant
    table.unique(['tenant_id', 'provider'], {
      indexName: 'integrations_tenant_id_provider_unique',
    });
  });

  // Provider check constraint
  await knex.raw(`
    ALTER TABLE integrations
    ADD CONSTRAINT integrations_provider_check
    CHECK (provider IN ('slack', 'github', 'trello', 'google_calendar'))
  `);

  await knex.schema.table('integrations', (table) => {
    table.index('tenant_id', 'integrations_tenant_id_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
export const down = async (knex) => {
  await knex.schema.dropTableIfExists('integrations');
};
