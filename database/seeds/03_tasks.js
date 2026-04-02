// =============================================================================
// Seed: Tasks
// =============================================================================
// Creates three sample tasks for the Acme Corp tenant demonstrating different
// status and priority combinations. Tasks are created by the acme admin and
// assigned to the acme member user.
// =============================================================================

/** @param {import('knex').Knex} knex */
export const seed = async (knex) => {
  const ACME_TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const ACME_ADMIN_ID = '00000000-0000-0000-0001-000000000001';
  const ACME_MEMBER_ID = '00000000-0000-0000-0001-000000000002';

  const tasks = [
    // ------------------------------------------------------------------
    // Task 1 — In progress, high priority
    // ------------------------------------------------------------------
    {
      id: '00000000-0000-0000-0002-000000000001',
      tenant_id: ACME_TENANT_ID,
      title: 'Set up CI/CD pipeline with GitHub Actions',
      description:
        'Configure the .github/workflows/ci.yml pipeline to run lint, ' +
        'unit tests, integration tests, build Docker images, and push to ' +
        'GitHub Container Registry on every pull request.',
      status: 'in_progress',
      priority: 'high',
      due_date: new Date('2026-04-15T17:00:00Z'),
      assignee_id: ACME_MEMBER_ID,
      created_by: ACME_ADMIN_ID,
      ai_suggestion: {
        estimatedHours: 4,
        suggestedDueDate: '2026-04-14T17:00:00Z',
        dependencies: [],
        reasoning:
          'CI pipeline setup is a foundational task. 4 hours is a realistic estimate ' +
          'for a developer familiar with GitHub Actions.',
      },
      created_at: new Date('2026-04-01T09:00:00Z'),
      updated_at: new Date('2026-04-01T11:30:00Z'),
    },

    // ------------------------------------------------------------------
    // Task 2 — Todo, urgent priority
    // ------------------------------------------------------------------
    {
      id: '00000000-0000-0000-0002-000000000002',
      tenant_id: ACME_TENANT_ID,
      title: 'Implement JWT RS256 authentication in auth-service',
      description:
        'Complete the login and token-refresh endpoints using RS256 asymmetric ' +
        'signing. Implement refresh token rotation with single-use enforcement. ' +
        'Add token blacklisting to Redis on logout.',
      status: 'todo',
      priority: 'urgent',
      due_date: new Date('2026-04-10T17:00:00Z'),
      assignee_id: ACME_ADMIN_ID,
      created_by: ACME_ADMIN_ID,
      ai_suggestion: {
        estimatedHours: 8,
        suggestedDueDate: '2026-04-09T17:00:00Z',
        dependencies: [
          'Database migrations must be run first (refresh_tokens table)',
        ],
        reasoning:
          'Authentication is on the critical path for all other services. ' +
          'Recommend completing this before any feature work.',
      },
      created_at: new Date('2026-04-01T09:05:00Z'),
      updated_at: new Date('2026-04-01T09:05:00Z'),
    },

    // ------------------------------------------------------------------
    // Task 3 — Done, medium priority
    // ------------------------------------------------------------------
    {
      id: '00000000-0000-0000-0002-000000000003',
      tenant_id: ACME_TENANT_ID,
      title: 'Write database schema and initial migrations',
      description:
        'Create Knex migration files for all core tables: tenants, users, ' +
        'refresh_tokens, tasks, integrations, and audit_logs. Add appropriate ' +
        'indexes and check constraints.',
      status: 'done',
      priority: 'medium',
      due_date: new Date('2026-04-01T17:00:00Z'),
      assignee_id: ACME_MEMBER_ID,
      created_by: ACME_ADMIN_ID,
      ai_suggestion: null,
      created_at: new Date('2026-03-28T09:00:00Z'),
      updated_at: new Date('2026-04-01T14:00:00Z'),
    },
  ];

  await knex('tasks').insert(tasks).onConflict('id').ignore();
};
