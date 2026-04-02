// =============================================================================
// AI routes — /api/v1/ai
//
// All routes validated with Zod before reaching the controller.
// No auth middleware — the API Gateway forwards X-User-ID and X-Tenant-ID
// after JWT verification; this service trusts those headers.
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as controller from '../controllers/ai.controller.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

/**
 * POST /suggest
 * Provide task context; receive deadline, dependencies, and improved description.
 */
const suggestSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .min(1, 'title must not be empty')
    .max(500, 'title must be 500 characters or fewer'),
  description: z.string().max(5000, 'description must be 5000 characters or fewer').optional(),
  existingTasks: z
    .array(
      z.object({
        title: z.string().min(1),
        status: z.string().min(1),
      }),
    )
    .optional()
    .default([]),
});

/**
 * POST /draft
 * Generate a Slack message or PR description for a task.
 */
const draftSchema = z.object({
  type: z.enum(['slack_message', 'pr_description'], {
    errorMap: () => ({ message: 'type must be "slack_message" or "pr_description"' }),
  }),
  context: z.object({
    taskTitle: z
      .string({ required_error: 'context.taskTitle is required' })
      .min(1, 'context.taskTitle must not be empty'),
    taskDescription: z.string().optional(),
    assignee: z.string().optional(),
    status: z.string().optional(),
  }),
});

/**
 * POST /review
 * Generate a structured code review for a pull request.
 */
const reviewSchema = z.object({
  prTitle: z
    .string({ required_error: 'prTitle is required' })
    .min(1, 'prTitle must not be empty'),
  prDescription: z.string().optional(),
  diff: z
    .string()
    .max(10_000, 'diff must be 10 000 characters or fewer — truncate before sending')
    .optional(),
  changedFiles: z.array(z.string()).optional().default([]),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

/**
 * POST /api/v1/ai/suggest
 * Body: { title, description?, existingTasks? }
 * Returns: { success: true, data: { deadline, dependencies, draft_description } }
 */
router.post('/suggest', validate(suggestSchema), controller.suggest);

/**
 * POST /api/v1/ai/draft
 * Body: { type: 'slack_message'|'pr_description', context: { taskTitle, ... } }
 * Returns: { success: true, data: { text } }
 */
router.post('/draft', validate(draftSchema), controller.draft);

/**
 * POST /api/v1/ai/review
 * Body: { prTitle, prDescription?, diff?, changedFiles? }
 * Returns: { success: true, data: { review } }
 */
router.post('/review', validate(reviewSchema), controller.review);

export default router;
