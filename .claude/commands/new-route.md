Scaffold a new Express route with full middleware chain for the Smart Collaboration SaaS Platform.

The user will provide:
- Service name (e.g. `task-service`)
- Resource name (e.g. `tasks`)
- HTTP method and path (e.g. `POST /tasks`)
- Auth level: `public` | `member` | `admin`
- Request body shape (field names and types)

Generate:

1. **Zod schema** for the request input (body / params / query as needed)
2. **Route handler** following the project pattern:
   ```
   authenticate → authorize(role) → validate(schema) → auditLog(action) → controller
   ```
3. **Controller function** (thin — calls service, returns response)
4. **Service function** (business logic — always scopes to `tenant_id`)
5. **Error cases** handled: not found (404 + error code), validation (422), auth (401/403)
6. **OpenAPI YAML snippet** for `docs/api-spec.yaml`

Rules:
- Response uses `ok()` / `created()` / `noContent()` helpers — never raw `res.json()`
- Service function always receives `(tenantId, userId, data)` — never reads from req directly
- `tenant_id` always sourced from `req.tenantId` (set by authenticate middleware from JWT)
- Throw `AppError` with correct HTTP status and SCREAMING_SNAKE_CASE error code
- No logic in the controller — only call service + respond
