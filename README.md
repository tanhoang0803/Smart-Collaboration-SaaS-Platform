# Smart Collaboration SaaS Platform

> A production-grade, multi-tenant SaaS platform demonstrating end-to-end engineering mastery: frontend, backend microservices, AI integration, third-party connectors, DevOps, and security.

---

## What This Is

A team collaboration tool where **AI actively assists** the workflow — suggesting task deadlines, drafting Slack messages, summarizing GitHub PRs — while keeping humans in control of every decision.

Built to showcase **senior-architect thinking**: not just "it works" but deliberate choices around scalability, security, observability, and maintainability.

---

## Architecture Overview

```
                          ┌─────────────────────────────────┐
                          │         React + Redux SPA        │
                          │    (Vite, WebSocket, Axios)      │
                          └────────────────┬────────────────┘
                                           │ HTTPS / WSS
                          ┌────────────────▼────────────────┐
                          │          Nginx (TLS)             │
                          └────────────────┬────────────────┘
                                           │
                          ┌────────────────▼────────────────┐
                          │         API Gateway              │
                          │   (JWT auth, tenant routing,     │
                          │    rate limiting, proxy)         │
                          └──┬──────┬──────┬──────┬─────────┘
                             │      │      │      │
              ┌──────────────▼┐ ┌───▼───┐ ┌▼──────────┐ ┌▼──────────────┐
              │ Auth Service  │ │ Task  │ │Integration│ │  AI Service   │
              │ JWT, OAuth2,  │ │Service│ │  Service  │ │  OpenAI /     │
              │ RBAC          │ │ CRUD  │ │Slack,GH,  │ │  HuggingFace  │
              └───────────────┘ └───┬───┘ │Trello,Cal │ └───────────────┘
                                    │     └───────────┘
                          ┌─────────▼───────────────────────┐
                          │   PostgreSQL (multi-tenant)      │
                          │   Redis (cache, pub/sub, BL)     │
                          └─────────────────────────────────┘
```

---

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Frontend       | React 18, Redux Toolkit, React Query, Socket.io |
| API Gateway    | Node.js, Express                    |
| Microservices  | Node.js, Express (per service)      |
| Database       | PostgreSQL 16, Redis 7              |
| AI             | OpenAI GPT-4o, HuggingFace Inference API |
| Auth           | JWT (RS256), OAuth2, RBAC           |
| Infra          | Docker, Docker Compose              |
| CI/CD          | GitHub Actions                      |
| Hosting        | Vercel (FE), Render / Fly.io (BE), Supabase / Neon (DB) |
| Monitoring     | Prometheus, Grafana, ELK Stack      |

---

## Build Status

| Service | Port | Status |
|---|---|---|
| `api-gateway` | 8080 | ✅ JWT validation, rate-limit, tenant resolver, proxy |
| `auth-service` | 3001 | ✅ JWT RS256, refresh rotation, OAuth2 (GitHub/Google), RBAC |
| `task-service` | 3002 | ✅ CRUD, AI suggestion fire-and-forget, Redis pub/sub, audit log |
| `integration-service` | 3003 | ✅ Slack/GitHub/Trello/Google Calendar connectors, webhooks, OAuth |
| `ai-service` | 3004 | ✅ OpenAI/HuggingFace adapters, suggest/draft/review endpoints |

**Frontend (`frontend/`):**
- React 18 + TypeScript + Vite
- Redux Toolkit (auth, tasks, AI, integrations slices)
- React Query for server-state + optimistic updates
- Socket.io-client for real-time task events
- Pages: Login, Register, Dashboard, Tasks, Task Detail, Integrations
- Human-in-the-loop AI suggestion accept/dismiss UI

**Infrastructure:**
- `docker-compose.yml` + `docker-compose.prod.yml`
- Nginx reverse proxy, Prometheus, Grafana
- GitHub Actions CI (lint → test → build images) + CD (deploy to Render/Vercel)
- Database migrations (Knex), seed data, canonical schema

---

## Services

| Service | Port | Responsibility |
|---|---|---|
| `api-gateway` | 8080 | JWT validation, tenant routing, rate limiting |
| `auth-service` | 3001 | Register/login, token issue/refresh, OAuth2 |
| `task-service` | 3002 | Task CRUD, AI suggestions, audit log |
| `integration-service` | 3003 | Slack, GitHub, Trello, Google Calendar |
| `ai-service` | 3004 | Prompt execution, suggestion generation |
| `frontend` | 3000 | React SPA |
| `postgres` | 5432 | Primary database |
| `redis` | 6379 | Cache + pub/sub |

---

## AI-Assist Flow

```
1. User creates a task
2. Task Service calls AI Service (async)
3. AI Service sends prompt to OpenAI → receives suggestion (deadline, dependencies, draft content)
4. Task Service attaches suggestion to task response
5. Frontend shows suggestion inline — user accepts / edits / rejects
6. Only the human-confirmed version is saved
```

Human-in-the-loop by design. AI is an assistant, not an automation.

---

## Third-Party Integrations

- **Slack** — post task notifications and AI-drafted messages to channels
- **GitHub** — sync PRs and issues into tasks; AI generates PR review summaries
- **Trello** — bi-directional card sync via webhooks
- **Google Calendar** — auto-create calendar events from task due dates

---

## Quick Start (Local Dev)

### Prerequisites

- Docker Desktop
- Node.js 20+
- A `.env` file (copy from `.env.example`)

```bash
# Clone
git clone <repo-url>
cd Smart_Collaboration_SaaS_Platform

# Configure environment
cp .env.example .env
# Edit .env — add your OpenAI, Slack, GitHub API keys

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec task-service npm run migrate

# Seed development data
docker-compose exec task-service npm run seed
```

### Access

| URL | Service |
|---|---|
| http://localhost:3000 | Frontend |
| http://localhost:8080 | API Gateway |
| http://localhost:3001/healthz | Grafana |
| http://localhost:9090 | Prometheus |
| http://localhost:5601 | Kibana |

---

## Project Structure

```
├── frontend/               React SPA
├── services/
│   ├── api-gateway/        Request routing and auth
│   ├── auth-service/       Identity and access management
│   ├── task-service/       Core task management
│   ├── integration-service/Third-party connectors
│   └── ai-service/         AI prompt execution
├── database/               Migrations and seeds
├── infra/                  Nginx, Prometheus, Grafana, ELK config
├── docs/                   Architecture decisions, API spec, diagrams
├── .github/workflows/      CI/CD pipelines
└── docker-compose.yml      Local dev orchestration
```

---

## CI/CD Pipeline

```
Push / PR → Lint → Unit Tests → Integration Tests (Testcontainers)
         → Coverage Gate (>80%) → Docker Build → Push to GHCR
         → [main only] Deploy frontend to Vercel
                       Deploy services to Render / Fly.io
```

---

## Security Highlights

- JWT RS256 with refresh token rotation and blacklisting
- RBAC enforced at gateway and service level
- OAuth2 PKCE for third-party integrations
- All secrets in environment variables — never in code
- Parameterised SQL queries throughout
- HTTPS enforced via Nginx with HSTS
- Rate limiting per IP and per token
- Full audit log for every mutation

---

## Monitoring

- **Prometheus + Grafana** — golden signals: latency p95, error rate, RPS, saturation
- **ELK Stack** — structured JSON logs, full-text search, retention policies
- **Alerting** — error rate > 5% triggers notification; service downtime pages on-call
- **Health checks** — `/healthz` endpoint on every service, checked by Docker and load balancer

---

## Key Engineering Trade-offs

| Decision | Choice | Reasoning |
|---|---|---|
| Architecture | Microservices | Independent deploys, isolated failures |
| Tenancy model | Row-level isolation | Simpler migrations than schema-per-tenant |
| Auth tokens | JWT RS256 | Stateless verification without DB round-trip |
| AI adapter | Interface + adapters | Swap providers without service changes |
| Testing | Jest + Testcontainers | Real DB tests — no mock drift |
| Real-time | WebSocket + Redis pub/sub | Scales horizontally across service instances |

---

## Scalability Path

| Phase | Approach |
|---|---|
| 1 - Now | Single region, managed PaaS (Render / Fly.io), vertical scale |
| 2 - Growth | Horizontal scaling, Kubernetes, PostgreSQL read replicas |
| 3 - Scale | Multi-region, CDN edge caching, connection pooling (PgBouncer) |
| 4 - Enterprise | Kafka event streaming, CQRS, schema-per-tenant |

---

## Documentation

- `docs/architecture.md` — Architecture Decision Records (ADRs)
- `docs/api-spec.yaml` — OpenAPI 3.0 specification
- `docs/diagrams/` — System context, container, sequence, ERD diagrams
- `docs/runbooks/` — Incident response and operational runbooks
- `CLAUDE.md` — AI-assisted development reference (conventions, mindmap, security checklist)

---

## Why This Project

This single codebase demonstrates:

- **Frontend engineering** — SPA architecture, state management, real-time UI
- **Backend engineering** — REST APIs, microservices, database design
- **AI integration** — prompt engineering, human-in-the-loop design, adapter pattern
- **DevOps** — Dockerisation, CI/CD, infrastructure-as-code mindset
- **Security** — auth, authorization, secrets management, OWASP awareness
- **Observability** — metrics, logging, alerting, incident readiness
- **Architectural thinking** — documented trade-offs, scalability planning, ADRs
