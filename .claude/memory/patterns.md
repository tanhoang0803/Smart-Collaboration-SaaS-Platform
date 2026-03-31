# Code Patterns — Reuse These Exactly

## Express Route Structure (every route follows this)
```js
// routes/tasks.js
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { TaskController } from '../controllers/task.controller.js'
import { auditLog } from '../middleware/audit-log.js'

const router = Router()

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  due_date: z.string().datetime().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
})

router.post(
  '/',
  authenticate,
  authorize('member', 'admin'),
  validate(createTaskSchema),
  auditLog('task.create'),
  TaskController.create
)

export default router
```

## AppError class (throw this, never raw Error)
```js
// utils/AppError.js
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
  }
}
```

## Service layer pattern (business logic here, never in controllers)
```js
// services/task.service.js
import { AppError } from '../utils/AppError.js'
import { db } from '../db/client.js'

export const TaskService = {
  async create(tenantId, userId, data) {
    // Always scope to tenant
    const [task] = await db('tasks')
      .where({ tenant_id: tenantId })
      .insert({ ...data, tenant_id: tenantId, created_by: userId })
      .returning('*')
    return task
  },

  async findById(tenantId, taskId) {
    const task = await db('tasks')
      .where({ id: taskId, tenant_id: tenantId })  // tenant scope ALWAYS
      .first()
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND')
    return task
  },
}
```

## Standard API response helpers
```js
// utils/response.js
export const ok = (res, data, meta = {}) =>
  res.json({ success: true, data, meta })

export const created = (res, data) =>
  res.status(201).json({ success: true, data })

export const noContent = (res) =>
  res.status(204).send()
```

## Global error handler (register last in Express)
```js
// middleware/error-handler.js
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'

export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    })
  }
  logger.error({ err }, 'Unexpected error')
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  })
}
```

## Dockerfile pattern (every service)
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS dev
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS prod
COPY . .
USER node
CMD ["node", "src/index.js"]
```
