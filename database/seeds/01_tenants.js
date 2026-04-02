// =============================================================================
// Seed: Tenants
// =============================================================================
// Creates two development tenants with deterministic UUIDs so other seed
// files can safely reference them by ID.
// =============================================================================

/** @param {import('knex').Knex} knex */
export const seed = async (knex) => {
  const tenants = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'pro',
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Beta Inc',
      slug: 'beta',
      plan: 'free',
      created_at: new Date('2026-01-15T00:00:00Z'),
      updated_at: new Date('2026-01-15T00:00:00Z'),
    },
  ];

  // onConflict().ignore() makes seeds idempotent — safe to re-run
  await knex('tenants').insert(tenants).onConflict('id').ignore();
};
