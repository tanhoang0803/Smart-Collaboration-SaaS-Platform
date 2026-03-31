# Coding Conventions

Single source of truth for code style, structure, and process in this project.

---

## Language & Runtime

- Node.js 20 (LTS)
- ES Modules only (`"type": "module"` in all `package.json`)
- No CommonJS `require()` — use `import`
- TypeScript is optional per service — if used, `strict: true`, no `any`

---

## Directory Structure per Service

```
src/
├── index.js          ← starts server (process entry point)
├── app.js            ← Express factory — exported for testing, no listen()
├── routes/           ← Router files, one per resource
├── controllers/      ← Thin: validate input (via middleware), call service, send response
├── services/         ← Business logic — all DB calls live here
├── middleware/       ← authenticate, authorize, validate, audit-log, error-handler
├── db/
│   └── client.js     ← Knex singleton
├── utils/
│   ├── AppError.js
│   ├── logger.js     ← Pino instance
│   └── response.js   ← ok(), created(), noContent()
```

---

## Naming

| Thing | Style | Example |
|---|---|---|
| Files | kebab-case | `task-service.js` |
| Functions | camelCase | `findTaskById` |
| Classes | PascalCase | `TaskController` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| DB tables | snake_case plural | `audit_logs` |
| DB columns | snake_case | `tenant_id`, `created_at` |
| Env vars | SCREAMING_SNAKE | `OPENAI_API_KEY` |
| Error codes | SCREAMING_SNAKE | `TASK_NOT_FOUND` |

---

## Error Handling

**Always throw `AppError`, never plain `Error`:**
```js
throw new AppError('Task not found', 404, 'TASK_NOT_FOUND')
```

**Controller pattern — let middleware handle errors:**
```js
// Good: async controller, errors bubble to errorHandler middleware
export const getTask = async (req, res) => {
  const task = await TaskService.findById(req.tenantId, req.params.id)
  ok(res, task)
}
```

**Never swallow errors:**
```js
// Bad
try { ... } catch (e) { console.log(e) }

// Good
try { ... } catch (e) {
  if (e instanceof AppError) throw e
  throw new AppError('DB error', 500, 'INTERNAL_ERROR')
}
```

---

## Logging

Use `pino`. Never `console.log` in service code.

```js
import { logger } from '../utils/logger.js'

logger.info({ taskId, tenantId }, 'Task created')
logger.error({ err, userId }, 'Failed to create task')
```

Log levels:
- `debug` — detailed dev info (disabled in production)
- `info` — meaningful business events (task created, user logged in)
- `warn` — unexpected but recoverable (rate limit approached, retry)
- `error` — failure requiring attention (DB error, external API down)

**Never log:** passwords, tokens, full request bodies containing PII, private keys.

---

## Database

All queries via Knex. Rules:
1. Always include `where({ tenant_id: tenantId })` — no exceptions
2. Use `.returning('*')` on insert/update to get the full row back
3. Wrap multi-step operations in `knex.transaction()`
4. Index strategy: always index `tenant_id`, FK columns, and any filtered column

```js
// Correct
const task = await db('tasks')
  .where({ id: taskId, tenant_id: tenantId })
  .first()

// Wrong — missing tenant scope
const task = await db('tasks').where({ id: taskId }).first()
```

---

## Testing

- Framework: Jest with `--experimental-vm-modules` (ES modules)
- Integration tests: Testcontainers (real DB)
- Unit tests: pure functions only, no mocks for DB
- Coverage gate: 80% lines/branches (enforced in CI)
- Test file: `src/__tests__/<feature>.test.js`

---

## Git Workflow

- Branch naming: `feat/<ticket>-short-description`, `fix/<ticket>-description`
- One PR per logical change — no mega-PRs
- PRs require: passing CI, self-review checklist, screenshot for UI changes
- Merge strategy: squash merge to `main`
- Never force-push `main`
- Commit style: Conventional Commits (see `/commit` command)

---

## Environment Variables

- All required vars documented in `.env.example` with a comment per var
- No default secrets: `process.env.JWT_SECRET || 'dev_secret'` is **forbidden**
- Production secrets: GitHub Secrets → injected at deploy time
- Local dev: `.env` file (gitignored)

---

## Dependencies

- Add a dependency only when it does something you shouldn't build yourself
- Prefer well-maintained, minimal-dependency packages
- Run `npm audit` before every PR merge (CI enforces this)
- Lock versions: `package-lock.json` committed, Dependabot enabled
