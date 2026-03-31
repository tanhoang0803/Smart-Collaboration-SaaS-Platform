# Architecture Decision Records (ADRs)

> Format: Status [ACCEPTED | SUPERSEDED | DEPRECATED], Context, Decision, Consequences.

---

## ADR-001 — Microservices over Monolith

**Status:** ACCEPTED  
**Date:** 2026-03-31

**Context:** Choosing between a monolith (faster to build) and microservices (independently deployable) for the initial architecture.

**Decision:** Microservices from day one — Auth, Task, Integration, AI, and Gateway as separate processes.

**Consequences:**
- (+) Independent deploy and scale per service
- (+) Failure in AI Service does not take down Task Service
- (+) Aligns with interview demonstration of distributed systems thinking
- (-) More Docker/CI complexity upfront
- (-) Inter-service calls add latency vs in-process calls

---

## ADR-002 — Row-level Multi-tenancy

**Status:** ACCEPTED  
**Date:** 2026-03-31

**Context:** Schema-per-tenant gives full isolation but requires dynamic schema routing and complex migrations. Row-level isolation is simpler but requires disciplined query scoping.

**Decision:** Row-level isolation — `tenant_id` FK on every table, enforced in every service query.

**Consequences:**
- (+) Single migration set for all tenants
- (+) Simpler connection pooling (one pool, not N pools)
- (-) Requires strict discipline — every query MUST include `WHERE tenant_id = ?`
- (-) Data leak risk if a query misses tenant scope — mitigated by service-layer enforcement + integration tests

---

## ADR-003 — JWT RS256 with Refresh Token Rotation

**Status:** ACCEPTED  
**Date:** 2026-03-31

**Context:** JWT HS256 is simpler but shares the secret between issuer and verifier. RS256 allows services to verify tokens with the public key only.

**Decision:** RS256 asymmetric JWTs. 15-minute access tokens. 7-day refresh tokens stored as SHA-256 hash in DB, single-use with rotation.

**Consequences:**
- (+) Services verify tokens without DB round-trip
- (+) Compromised refresh token is detected on next use (rotation)
- (-) Key rotation requires distributing new public key to all services
- (-) Slightly more complex implementation than HS256

---

## ADR-004 — Adapter Pattern for AI Providers

**Status:** ACCEPTED  
**Date:** 2026-03-31

**Context:** OpenAI is the primary AI provider. HuggingFace is a fallback/alternative. Tightly coupling to one SDK makes switching painful.

**Decision:** AI Service exposes a provider-agnostic interface. OpenAI and HuggingFace are concrete adapters behind it.

```
AIProvider (interface)
  ├── OpenAIAdapter
  └── HuggingFaceAdapter
```

**Consequences:**
- (+) Switch provider via env var, zero code changes in Task Service
- (+) A/B testing providers is trivial
- (-) Extra abstraction layer to maintain

---

## ADR-005 — Knex.js over Prisma/Raw pg

**Status:** ACCEPTED  
**Date:** 2026-03-31

**Context:** Raw `pg` gives full control but is verbose. Prisma gives type safety but abstracts away SQL in ways that can surprise at scale. Knex is a query builder — explicit SQL, no magic.

**Decision:** Knex.js for all database interactions. Migrations managed by Knex migration system.

**Consequences:**
- (+) SQL is readable and predictable
- (+) Full control over query structure, indexes, CTEs
- (-) No automatic type generation (unlike Prisma) — types maintained manually
- (-) More verbose than Prisma for simple CRUD

---

## ADR-006 — Testcontainers for Integration Tests

**Status:** ACCEPTED  
**Date:** 2026-03-31

**Context:** Mocking PostgreSQL in tests has caused production bugs when mock behaviour diverged from real DB behaviour (constraint enforcement, transaction isolation).

**Decision:** All service-layer tests run against a real PostgreSQL container via Testcontainers. Mocks are only used for external HTTP calls (OpenAI, Slack).

**Consequences:**
- (+) Tests reflect real DB behaviour
- (+) Migration files are tested implicitly
- (-) Slower CI (~10-15s container spin-up per test suite)
- (-) Requires Docker in CI environment (GitHub Actions runner has it)

---

## Pending Decisions

| ID | Question | Due |
|---|---|---|
| ADR-007 | Message queue: Redis pub/sub vs RabbitMQ vs Kafka | When integration service is built |
| ADR-008 | File storage provider | When attachment feature is scoped |
| ADR-009 | Frontend state split: Redux vs React Query boundary | When frontend is scaffolded |
