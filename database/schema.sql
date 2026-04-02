-- =============================================================================
-- Smart Collaboration SaaS Platform — Canonical Schema Reference
-- =============================================================================
-- This file is a human-readable reference document. It is NOT executed
-- directly. The authoritative schema is managed by Knex migrations in
-- the database/migrations/ directory.
--
-- To apply the schema, run:
--   npx knex migrate:latest --knexfile database/knexfile.cjs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Prerequisites
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
-- Root entity of the multi-tenant model. Every other table carries a
-- tenant_id FK that references this table.
-- ---------------------------------------------------------------------------
CREATE TABLE tenants (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(255) NOT NULL,
    slug       VARCHAR(100) NOT NULL UNIQUE,           -- URL-safe identifier
    plan       VARCHAR(50)  NOT NULL DEFAULT 'free'
                   CONSTRAINT tenants_plan_check
                   CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- Supports password-based and OAuth2 (GitHub, Google) authentication.
-- password_hash is nullable to allow pure-OAuth users.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID        NOT NULL
                         REFERENCES tenants(id) ON DELETE CASCADE,
    email            VARCHAR(255) NOT NULL,
    password_hash    VARCHAR(255),                      -- NULL for OAuth users
    role             VARCHAR(50)  NOT NULL DEFAULT 'member'
                         CONSTRAINT users_role_check
                         CHECK (role IN ('admin', 'member', 'viewer')),
    oauth_provider    VARCHAR(50),                      -- 'github' | 'google'
    oauth_provider_id VARCHAR(255),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_tenant_id_email_unique UNIQUE (tenant_id, email)
);

CREATE INDEX users_tenant_id_idx ON users (tenant_id);


-- ---------------------------------------------------------------------------
-- refresh_tokens
-- ---------------------------------------------------------------------------
-- Single-use refresh tokens for JWT rotation. The token_hash column stores
-- the SHA-256 hex digest of the actual opaque token. The raw token is never
-- persisted.
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL
                   REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,             -- SHA-256 hex (64 chars)
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX refresh_tokens_user_id_idx   ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_token_hash_idx ON refresh_tokens (token_hash);


-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
-- Core work-item entity. Tenant-scoped via tenant_id.
-- ai_suggestion stores raw AI response as JSONB for schema flexibility.
-- ---------------------------------------------------------------------------
CREATE TABLE tasks (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID         NOT NULL
                      REFERENCES tenants(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL,
    description   TEXT,
    status        VARCHAR(50)  NOT NULL DEFAULT 'todo'
                      CONSTRAINT tasks_status_check
                      CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
    priority      VARCHAR(50)  NOT NULL DEFAULT 'medium'
                      CONSTRAINT tasks_priority_check
                      CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date      TIMESTAMPTZ,
    assignee_id   UUID
                      REFERENCES users(id) ON DELETE SET NULL,
    created_by    UUID         NOT NULL
                      REFERENCES users(id) ON DELETE RESTRICT,
    ai_suggestion JSONB,                                -- nullable, schema-flexible
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX tasks_tenant_id_idx   ON tasks (tenant_id);
CREATE INDEX tasks_assignee_id_idx ON tasks (assignee_id);
CREATE INDEX tasks_status_idx      ON tasks (status);
CREATE INDEX tasks_created_by_idx  ON tasks (created_by);


-- ---------------------------------------------------------------------------
-- integrations
-- ---------------------------------------------------------------------------
-- Per-tenant third-party integration credentials. OAuth tokens are encrypted
-- at rest with AES-256-GCM. Stored format: "<hex-nonce>:<hex-ciphertext>".
-- ---------------------------------------------------------------------------
CREATE TABLE integrations (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID        NOT NULL
                          REFERENCES tenants(id) ON DELETE CASCADE,
    provider          VARCHAR(50) NOT NULL
                          CONSTRAINT integrations_provider_check
                          CHECK (provider IN ('slack', 'github', 'trello', 'google_calendar')),
    access_token_enc  TEXT,                             -- AES-256-GCM encrypted
    refresh_token_enc TEXT,                             -- AES-256-GCM encrypted
    config            JSONB       NOT NULL DEFAULT '{}',
    last_synced_at    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT integrations_tenant_id_provider_unique UNIQUE (tenant_id, provider)
);

CREATE INDEX integrations_tenant_id_idx ON integrations (tenant_id);


-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
-- Append-only mutation log. Never UPDATE or DELETE rows in normal operation.
-- Retention policy (e.g. 1-year TTL) handled by a scheduled job.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID        NOT NULL
                      REFERENCES tenants(id) ON DELETE CASCADE,
    user_id       UUID
                      REFERENCES users(id) ON DELETE SET NULL, -- NULL = system event
    action        VARCHAR(100) NOT NULL,                -- e.g. 'task.created'
    resource_type VARCHAR(100) NOT NULL,                -- e.g. 'task', 'user'
    resource_id   UUID,                                 -- NULL for login events
    diff          JSONB,                                -- { before: {}, after: {} }
    ip_addr       VARCHAR(45),                          -- IPv4 or IPv6
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_tenant_id_idx  ON audit_logs (tenant_id);
CREATE INDEX audit_logs_user_id_idx    ON audit_logs (user_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at);
