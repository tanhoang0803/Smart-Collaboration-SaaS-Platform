# Architecture Decisions — Locked

These decisions are final unless explicitly revisited by the user.
Do not suggest alternatives unless asked.

| # | Decision | Rationale |
|---|---|---|
| 1 | Microservices (not monolith) | Independent deploys, fault isolation, team scalability |
| 2 | Row-level multi-tenancy (tenant_id FK) | Simpler migrations vs schema-per-tenant; sufficient for current scale |
| 3 | JWT RS256 (not HS256) | Asymmetric — public key can verify without exposing signing key |
| 4 | Refresh token rotation + blacklist | Single-use refresh tokens; blacklist in Redis on logout |
| 5 | Adapter pattern for AI providers | Swap OpenAI ↔ HuggingFace without changing Task Service |
| 6 | Zod for input validation (not Joi/express-validator) | TypeScript-first, schema inference, composable |
| 7 | Pino for logging (not Winston) | Significantly faster, structured JSON by default |
| 8 | Knex.js for queries (not raw pg / Prisma) | Query builder control without ORM magic; explicit SQL |
| 9 | Redis pub/sub for real-time (not polling) | Scales horizontally; WebSocket server subscribes per connection |
| 10 | Testcontainers for integration tests | Real DB — no mock drift; tests reflect production behaviour |

## Pending Decisions (discuss before implementing)
- [ ] Message queue: Redis pub/sub vs RabbitMQ vs Kafka (depends on event volume)
- [ ] File storage: S3 vs local volume (needed when attachments feature lands)
- [ ] Frontend state: React Query scope — what goes in Redux vs server state only
