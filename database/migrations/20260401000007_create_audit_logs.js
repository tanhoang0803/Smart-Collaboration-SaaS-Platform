// =============================================================================
// Migration: Create audit_logs table
// =============================================================================
// Append-only record of every mutation in the system. Rows are never updated
// or deleted in normal operation (only via scheduled retention policy).
//
// The `diff` JSONB column stores before/after state for mutation events:
//   { "before": { "status": "todo" }, "after": { "status": "done" } }
//
// The `user_id` is nullable to cover system-generated events (e.g., cron jobs,
// integration webhooks) where there is no authenticated user.
// =============================================================================

/**
 * @param {import('knex').Knex} knex
 */
export const up = async (knex) => {
  await knex.schema.createTable('audit_logs', (table) => {
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

    // Nullable: some events are system-generated with no authenticated actor
    table
      .uuid('user_id')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');

    // Dot-namespaced action names, e.g. 'task.created', 'user.login',
    // 'integration.slack.connected'
    table.string('action', 100).notNullable();

    // The type of the affected resource, e.g. 'task', 'user', 'integration'
    table.string('resource_type', 100).notNullable();

    // The UUID of the affected resource; nullable for login/logout events
    table.uuid('resource_id').nullable();

    // Before/after diff for mutation events; null for creation/deletion
    table.jsonb('diff').nullable();

    // IPv4 or IPv6 address of the request originator (max 45 chars for IPv6)
    table.string('ip_addr', 45).nullable();

    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.table('audit_logs', (table) => {
    // Most queries filter by tenant first
    table.index('tenant_id', 'audit_logs_tenant_id_idx');
    // User activity timeline
    table.index('user_id', 'audit_logs_user_id_idx');
    // Time-range queries for retention / reporting
    table.index('created_at', 'audit_logs_created_at_idx');
  });
};

/**
 * Drop in reverse FK dependency order.
 * audit_logs has the fewest dependents, so it can be dropped last here
 * (no other tables reference audit_logs).
 *
 * @param {import('knex').Knex} knex
 */
export const down = async (knex) => {
  await knex.schema.dropTableIfExists('audit_logs');
};
