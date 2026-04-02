// =============================================================================
// Migration: Create tasks table
// =============================================================================
// Core work-item entity. Every row is scoped to a tenant via tenant_id.
// The ai_suggestion JSONB column stores the raw AI response so the schema
// can evolve without a migration as the AI output shape changes.
// =============================================================================

/**
 * @param {import('knex').Knex} knex
 */
export const up = async (knex) => {
  await knex.schema.createTable('tasks', (table) => {
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

    table.string('title', 500).notNullable();

    table.text('description').nullable();

    table
      .string('status', 50)
      .notNullable()
      .defaultTo('todo')
      .comment("One of: 'todo', 'in_progress', 'done', 'cancelled'");

    table
      .string('priority', 50)
      .notNullable()
      .defaultTo('medium')
      .comment("One of: 'low', 'medium', 'high', 'urgent'");

    table.timestamp('due_date', { useTz: true }).nullable();

    // Nullable: task can be unassigned
    table
      .uuid('assignee_id')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');

    // NOT NULL: we always know who created the task
    table
      .uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');

    // Schema-flexible AI response (deadline suggestion, dependency graph, etc.)
    table.jsonb('ai_suggestion').nullable();

    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  // Status and priority check constraints
  await knex.raw(`
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled'))
  `);

  await knex.raw(`
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
  `);

  // Indexes for the most common query patterns
  await knex.schema.table('tasks', (table) => {
    table.index('tenant_id', 'tasks_tenant_id_idx');
    table.index('assignee_id', 'tasks_assignee_id_idx');
    table.index('status', 'tasks_status_idx');
    table.index('created_by', 'tasks_created_by_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
export const down = async (knex) => {
  await knex.schema.dropTableIfExists('tasks');
};
