import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { auditLog } from '../middleware/audit-log.js';
import * as ctrl from '../controllers/task.controller.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial().extend({
  aiSuggestion: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.use(authenticate);

router.get('/', validate(listQuerySchema, 'query'), ctrl.list);
router.get('/:id', ctrl.getOne);

router.post(
  '/',
  authorize('member', 'admin'),
  auditLog,
  validate(createSchema),
  ctrl.create,
);

router.patch(
  '/:id',
  authorize('member', 'admin'),
  auditLog,
  validate(updateSchema),
  ctrl.update,
);

router.delete(
  '/:id',
  authorize('admin'),
  auditLog,
  ctrl.remove,
);

router.post(
  '/:id/accept-suggestion',
  authorize('member', 'admin'),
  auditLog,
  ctrl.acceptSuggestion,
);

export default router;
