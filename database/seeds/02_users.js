// =============================================================================
// Seed: Users
// =============================================================================
// Creates three development users with deterministic UUIDs.
//
// All users share the password: password123
// Hash generated with: bcryptjs, cost factor 10
//   const bcrypt = require('bcryptjs');
//   bcrypt.hashSync('password123', 10);
//
// DO NOT use these credentials in production. Rotate all secrets before
// deploying to any environment with real data.
// =============================================================================

// bcrypt hash of 'password123' with cost factor 10
const PASSWORD_HASH = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

/** @param {import('knex').Knex} knex */
export const seed = async (knex) => {
  const now = new Date('2026-01-01T00:00:00Z');

  const users = [
    // ------------------------------------------------------------------
    // Acme Corp — Admin
    // ------------------------------------------------------------------
    {
      id: '00000000-0000-0000-0001-000000000001',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@acme.example',
      password_hash: PASSWORD_HASH,
      role: 'admin',
      oauth_provider: null,
      oauth_provider_id: null,
      created_at: now,
      updated_at: now,
    },
    // ------------------------------------------------------------------
    // Acme Corp — Member
    // ------------------------------------------------------------------
    {
      id: '00000000-0000-0000-0001-000000000002',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      email: 'member@acme.example',
      password_hash: PASSWORD_HASH,
      role: 'member',
      oauth_provider: null,
      oauth_provider_id: null,
      created_at: now,
      updated_at: now,
    },
    // ------------------------------------------------------------------
    // Beta Inc — Admin
    // ------------------------------------------------------------------
    {
      id: '00000000-0000-0000-0001-000000000003',
      tenant_id: '00000000-0000-0000-0000-000000000002',
      email: 'admin@beta.example',
      password_hash: PASSWORD_HASH,
      role: 'admin',
      oauth_provider: null,
      oauth_provider_id: null,
      created_at: now,
      updated_at: now,
    },
  ];

  await knex('users').insert(users).onConflict('id').ignore();
};
