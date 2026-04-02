# CLAUDE.md — Smart Collaboration SaaS Platform

> Engineering reference for AI-assisted development sessions.
> Treat this as the single source of truth for architecture decisions, conventions, and build instructions.

---

## 0. Build Status (as of 2026-04-02)

| Service | Port | Status |
|---|---|---|
| `api-gateway` | 8080 | ✅ JWT validation, rate-limit, tenant resolver, proxy |
| `auth-service` | 3001 | ✅ JWT RS256, refresh rotation, OAuth2 (GitHub/Google), RBAC |
| `task-service` | 3002 | ✅ CRUD, AI suggestion fire-and-forget, Redis pub/sub, audit log |
| `integration-service` | 3003 | ✅ Slack/GitHub/Trello/Google Calendar connectors, webhooks, OAuth |
| `ai-service` | 3004 | ✅ OpenAI/HuggingFace adapters, suggest/draft/review endpoints |

**Frontend (`frontend/`):** React 18 + TypeScript + Vite, Redux Toolkit (auth/tasks/AI/integrations slices), React Query, Socket.io-client, human-in-the-loop AI suggestion UI.

**Infrastructure:** `docker-compose.yml` + `docker-compose.prod.yml`, Nginx, Prometheus, Grafana, GitHub Actions CI/CD (lint → test → build images → deploy to Render/Vercel), Knex migrations + seed data.

---

## 1. Project Identity

| Field       | Value                                                          |
|-------------|----------------------------------------------------------------|
| Name        | Smart Collaboration SaaS Platform                              |
| Type        | Multi-tenant SaaS, Microservices                               |
| Purpose     | Team collaboration with AI-augmented task and content workflows |
| Target      | Portfolio / Interview demonstration of senior-architect thinking |
| Stack level | Full-stack: Frontend → Backend → AI → Infra → DevOps → Security |

---

## 2. Repository Layout

```
/
├── CLAUDE.md                   ← You are here
├── README.md                   ← Human-facing project summary
├── docker-compose.yml          ← Local dev orchestration (all services)
├── docker-compose.prod.yml     ← Production-equivalent compose
├── .github/
│   └── workflows/
│       ├── ci.yml              ← Test + lint on every PR
│       └── deploy.yml          ← Build images, push to registry, deploy
│
├── frontend/                   ← React + Redux SPA
│   ├── src/
│   │   ├── app/                ← Redux store setup
│   │   ├── features/           ← Feature-sliced Redux slices
│   │   │   ├── auth/
│   │   │   ├── tasks/
│   │   │   ├── integrations/
│   │   │   └── ai/
│   │   ├── components/         ← Reusable UI primitives
│   │   ├── pages/              ← Route-level page components
│   │   ├── hooks/              ← Custom React hooks
│   │   ├── services/           ← Axios API client, WebSocket client
│   │   └── utils/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
│
├── services/
│   ├── api-gateway/            ← Express gateway: routing, rate-limit, auth middleware
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── auth-service/           ← JWT issue/refresh, OAuth2 flows, RBAC
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   ├── models/
│   │   │   └── routes/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── task-service/           ← CRUD tasks, AI suggestions, audit log
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── integration-service/    ← Slack, GitHub, Trello, Google Calendar connectors
│   │   ├── src/
│   │   │   ├── connectors/
│   │   │   │   ├── slack.js
│   │   │   │   ├── github.js
│   │   │   │   ├── trello.js
│   │   │   │   └── google-calendar.js
│   │   │   └── routes/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── ai-service/             ← OpenAI / HuggingFace adapter, prompt templates
│       ├── src/
│       │   ├── prompts/
│       │   ├── adapters/
│       │   └── routes/
│       ├── Dockerfile
│       └── package.json
│
├── database/
│   ├── migrations/             ← Flyway / Knex migrations (versioned)
│   ├── seeds/                  ← Dev seed data
│   └── schema.sql              ← Canonical schema reference
│
├── infra/
│   ├── nginx/                  ← Reverse proxy config (HTTPS termination)
│   ├── prometheus/             ← prometheus.yml scrape config
│   ├── grafana/                ← Dashboard JSON exports
│   └── elk/                    ← Logstash pipeline, Kibana saved objects
│
└── docs/
    ├── architecture.md         ← ADRs and design decisions
    ├── api-spec.yaml           ← OpenAPI 3.0 spec
    ├── diagrams/               ← Draw.io / Mermaid source files
    └── runbooks/               ← Ops runbooks for incidents
```

---

## 3. Architecture Mindmap

```
Smart Collaboration SaaS Platform
│
├── CLIENT LAYER
│   ├── React SPA (Vite build)
│   │   ├── Redux Toolkit — global state (auth, tasks, notifications)
│   │   ├── React Query — server-state, caching, optimistic updates
│   │   ├── WebSocket (Socket.io-client) — real-time task updates
│   │   └── Axios — REST calls to API Gateway
│   └── CDN (Vercel / Cloudflare) — static asset delivery
│
├── EDGE / GATEWAY LAYER
│   └── API Gateway (Express)
│       ├── JWT validation middleware (every request)
│       ├── Tenant resolution (x-tenant-id header → DB schema routing)
│       ├── Rate limiting (express-rate-limit + Redis)
│       └── Reverse proxy to downstream services
│
├── SERVICE LAYER (all Dockerised, internal network)
│   ├── Auth Service          :3001
│   │   ├── POST /auth/register
│   │   ├── POST /auth/login   → issues JWT (access + refresh)
│   │   ├── POST /auth/refresh
│   │   ├── OAuth2 callback    → GitHub / Google
│   │   └── RBAC enforcement   (admin | member | viewer)
│   │
│   ├── Task Service          :3002
│   │   ├── CRUD /tasks
│   │   ├── Multi-tenant isolation (tenant_id FK on every row)
│   │   ├── Publishes task.created events → Redis pub/sub
│   │   └── Calls AI Service for suggestions on create
│   │
│   ├── Integration Service   :3003
│   │   ├── Slack webhook → sends task notifications
│   │   ├── GitHub webhook → ingests PRs / issues as tasks
│   │   ├── Trello → bi-directional card sync (polling + webhooks)
│   │   └── Google Calendar → creates events from task deadlines
│   │
│   └── AI Service            :3004
│       ├── POST /ai/suggest   → task deadline & dependency suggestions
│       ├── POST /ai/draft     → Slack message or PR description draft
│       ├── POST /ai/review    → PR review summary
│       └── Adapters: OpenAI GPT-4o, HuggingFace Inference API
│
├── DATA LAYER
│   ├── PostgreSQL (primary)
│   │   ├── Multi-tenant: schema-per-tenant isolation
│   │   ├── Tables: tenants, users, roles, tasks, integrations, audit_logs
│   │   └── Read replica for reporting queries
│   ├── Redis
│   │   ├── Session / token blacklist
│   │   ├── Rate-limit counters
│   │   ├── Pub/Sub for real-time events
│   │   └── Cache for AI suggestions (TTL 10 min)
│   └── S3-compatible storage (attachments, exports)
│
├── INFRA / DEVOPS LAYER
│   ├── Docker + Docker Compose (local parity)
│   ├── GitHub Actions
│   │   ├── CI: lint → test → build → image push
│   │   └── CD: deploy to Render / Railway / Fly.io
│   ├── Nginx (HTTPS termination, routing to Gateway)
│   └── Secrets: GitHub Secrets → injected as env vars at deploy
│
└── OBSERVABILITY LAYER
    ├── Prometheus — scrapes /metrics from each service
    ├── Grafana — dashboards: RPS, latency p95/p99, error rate
    ├── ELK Stack
    │   ├── Logstash — structured JSON log ingestion
    │   ├── Elasticsearch — log storage and full-text search
    │   └── Kibana — log exploration and alerting
    └── Health checks — /healthz on every service
```

---

## 4. Data Model (Core Tables)

```sql
-- Multi-tenancy root
tenants        (id, name, slug, plan, created_at)

-- Identity
users          (id, tenant_id FK, email, password_hash, role, oauth_provider, created_at)
refresh_tokens (id, user_id FK, token_hash, expires_at, revoked)

-- Work items
tasks          (id, tenant_id FK, title, description, status, priority,
                due_date, assignee_id FK, created_by FK,
                ai_suggestion JSONB, created_at, updated_at)

-- Integrations
integrations   (id, tenant_id FK, provider, access_token_enc, refresh_token_enc,
                config JSONB, last_synced_at)

-- Audit
audit_logs     (id, tenant_id FK, user_id FK, action, resource_type,
                resource_id, diff JSONB, ip_addr, created_at)
```

**Design decisions:**
- `tenant_id` on every row — row-level isolation, simpler than schema-per-tenant for this scale.
- `ai_suggestion JSONB` — schema-flexible for evolving AI response shapes.
- `access_token_enc` — tokens encrypted at rest with AES-256-GCM before DB write.

---

## 5. AI-Assist Flow (Sequence)

```
User             Frontend        Task Service      AI Service        OpenAI
  |                  |                |                 |               |
  |-- Create task -->|                |                 |               |
  |                  |-- POST /tasks->|                 |               |
  |                  |                |-- POST /ai/suggest ->|          |
  |                  |                |                 |-- prompt ---->|
  |                  |                |                 |<-- response --|
  |                  |                |<-- suggestion --|               |
  |                  |<-- task + AI --|                 |               |
  |<-- UI shows AI suggestion         |                 |               |
  |                                   |                 |               |
  |-- [Accept / Edit / Reject] ------>|                 |               |
  |                  |-- PATCH /tasks/:id (final) ->    |               |
```

**Human-in-the-loop:** AI output is never auto-applied. User explicitly accepts, edits, or rejects every suggestion before it persists.

---

## 6. API Conventions

- Base path: `/api/v1/`
- Auth header: `Authorization: Bearer <jwt>`
- Tenant header: `X-Tenant-ID: <tenant-slug>`
- Response envelope:
  ```json
  { "success": true, "data": {}, "meta": { "page": 1, "total": 42 } }
  { "success": false, "error": { "code": "TASK_NOT_FOUND", "message": "..." } }
  ```
- Pagination: `?page=1&limit=20` (cursor-based for large datasets)
- Versioning: URL-based (`/v1/`, `/v2/`) — never break existing consumers

---

## 7. Security Checklist

- [ ] JWT RS256 (asymmetric) — public key verifiable without private key exposure
- [ ] Refresh token rotation — single-use, stored as hash in DB
- [ ] Token blacklist in Redis on logout
- [ ] RBAC enforced at gateway + service level (defense in depth)
- [ ] All secrets in environment variables, never committed
- [ ] OAuth2 PKCE flow for third-party integrations
- [ ] HTTPS only — HSTS header, HTTPS redirect in Nginx
- [ ] SQL injection: parameterised queries only (Knex.js)
- [ ] XSS: CSP headers + DOMPurify on user-generated content
- [ ] Rate limiting: 100 req/min per IP (unauthenticated), 500 req/min per token
- [ ] Audit log: every mutation recorded with before/after diff
- [ ] Dependency scanning: `npm audit` in CI, Dependabot enabled

---

## 8. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml (conceptual)
on: [push, pull_request]
jobs:
  test:
    steps:
      - checkout
      - npm ci (parallel for each service)
      - lint (ESLint + Prettier check)
      - unit tests (Jest)
      - integration tests (Jest + Testcontainers for Postgres/Redis)
      - coverage gate (>80%)
  build:
    needs: test
    steps:
      - docker build (each service)
      - push to GitHub Container Registry (ghcr.io)
  deploy:
    needs: build
    if: branch == main
    steps:
      - deploy frontend → Vercel (auto via Vercel GitHub integration)
      - deploy services → Render/Fly.io (via API trigger)
```

---

## 9. Environment Variables Reference

```
# Auth Service
JWT_PRIVATE_KEY=         # RS256 private key (PEM, base64)
JWT_PUBLIC_KEY=          # RS256 public key (PEM, base64)
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379

# AI Service
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
HUGGINGFACE_API_KEY=

# Integrations
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
TRELLO_API_KEY=
TRELLO_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Infra
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://app.yourdomain.com
```

---

## 10. Local Dev Quickstart

```bash
# Prerequisites: Docker Desktop, Node 20+

# 1. Clone and configure
cp .env.example .env          # fill in API keys

# 2. Start all services
docker-compose up -d

# 3. Run migrations
docker-compose exec task-service npm run migrate

# 4. Seed dev data
docker-compose exec task-service npm run seed

# 5. Access services
# Frontend:     http://localhost:3000
# API Gateway:  http://localhost:8080
# Grafana:      http://localhost:3001  (admin/admin)
# Kibana:       http://localhost:5601
# Prometheus:   http://localhost:9090
```

---

## 11. Trade-off Decisions (Interview-Ready)

| Decision | Choice | Why | Trade-off Accepted |
|---|---|---|---|
| Architecture | Microservices | Independent deploys, isolated failures, team scalability | More operational complexity than monolith |
| Database | PostgreSQL | ACID compliance, multi-tenant row isolation, JSON support | Redis needed for cache/pub-sub |
| Auth | JWT RS256 | Stateless, verifiable without DB call | Refresh rotation adds complexity |
| AI integration | Adapter pattern | Swap OpenAI → HuggingFace without service changes | Extra abstraction layer |
| Tenancy | Row-level isolation | Simpler migrations vs schema-per-tenant | Requires rigorous tenant_id discipline |
| Real-time | WebSocket + Redis pub/sub | Low latency, scales horizontally | More infra than long-polling |
| Testing | Jest + Testcontainers | Real DB in tests, no mock drift | Slower CI than pure unit tests |

---

## 12. Coding Standards

- Node.js services: ES Modules (`"type": "module"`)
- Async/await throughout — no raw Promise chains
- Error handling: custom `AppError` class with HTTP status code + error code
- Logging: structured JSON (`pino`) — never `console.log` in production
- No `any` in TypeScript files; strict mode enabled
- Every new route must have: input validation (Zod), auth middleware, error handling
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- PR template: description, test plan, screenshots (UI changes), checklist

---

## 13. Monitoring Strategy

- **Golden signals:** Latency (p95 < 200ms), Error rate (< 1%), RPS, Saturation
- **Alerting rules:**
  - Error rate > 5% for 2 min → PagerDuty
  - DB connection pool > 80% → Slack alert
  - Task service down > 30s → page on-call
- **Dashboards:**
  - Overview: all services health
  - AI Service: token usage, cost, latency
  - Integration Service: webhook success/failure rates
- **Log retention:** 30 days in Elasticsearch, 1 year cold storage S3

---

## 14. Scalability Path

```
Phase 1 (Now):    Single-region, Render/Fly.io, vertical scaling
Phase 2:          Horizontal pod autoscaling (Kubernetes), read replicas
Phase 3:          Multi-region active-passive, CDN edge caching
Phase 4:          Event-driven with Kafka, CQRS for read/write separation
```

---

## 15. Key Diagrams to Build

1. **System Context Diagram** — actors (user, admin) and external systems
2. **Container Diagram** — all Docker containers and their communication
3. **Sequence Diagram** — AI-assist flow (see Section 5)
4. **ERD** — core database schema
5. **CI/CD Pipeline** — GitHub Actions flow
6. **Network Diagram** — Nginx → Gateway → Services → DB topology

Diagrams live in `docs/diagrams/` as Mermaid source (renders in GitHub) and exported PNG.
