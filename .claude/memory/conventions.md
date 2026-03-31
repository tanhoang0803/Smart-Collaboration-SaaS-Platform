# Project Conventions — Always Active

## Identity
- Sole contributor: TanQHoang (hoangquoctan.1996@gmail.com)
- Never suggest code authored by another identity.

## Code Style
- Runtime: Node.js 20, ES Modules (`"type": "module"` in package.json)
- Async: always `async/await` — no `.then()` chains
- Errors: throw `new AppError(message, statusCode, errorCode)` — never raw `new Error()`
- Logging: `pino` with structured JSON — never `console.log` in service code
- Validation: `zod` schema on every route input (body, params, query)
- SQL: parameterised queries via Knex.js — never string-interpolated SQL
- TypeScript: strict mode, no `any` — if needed use `unknown` then narrow

## Naming
- Files: `kebab-case.js`
- Variables/functions: `camelCase`
- Classes/Types: `PascalCase`
- DB columns: `snake_case`
- Env vars: `SCREAMING_SNAKE_CASE`
- Constants: `SCREAMING_SNAKE_CASE`

## API Response Envelope (always use this shape)
```json
{ "success": true,  "data": {},   "meta": {} }
{ "success": false, "error": { "code": "TASK_NOT_FOUND", "message": "..." } }
```

## Commit Format (Conventional Commits — strict)
```
feat(scope): short description
fix(scope): short description
docs(scope): short description
chore(scope): short description
test(scope): short description
refactor(scope): short description
```

## Multi-tenancy Rule
- EVERY database query MUST include `WHERE tenant_id = ?`
- Never query across tenants — enforce at service layer, not just gateway

## Security Non-negotiables
- Secrets only in env vars — never hardcoded, never in comments
- Every new route: auth middleware + RBAC check + zod validation
- Audit log entry for every state-mutating operation (POST/PATCH/DELETE)
