// =============================================================================
// Task Service — business logic layer
//
// All DB and Redis interactions for task operations live here. Controllers
// are thin: call one method, send the response.
//
// AI suggestion flow:
//   createTask → calls AI Service (fire-and-forget, non-blocking)
//             → stores suggestion in tasks.ai_suggestion JSONB column
// =============================================================================

import axios from 'axios';
import db from '../db/client.js';
import { publishTaskEvent } from '../redis/client.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { taskCreatedTotal } from '../utils/metrics.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:3004';

// ---------------------------------------------------------------------------
// listTasks
// ---------------------------------------------------------------------------

/**
 * @param {string} tenantId
 * @param {{ status?, priority?, assigneeId?, page, limit }} filters
 */
export async function listTasks(tenantId, filters = {}) {
  const { status, priority, assigneeId, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const query = db('tasks')
    .where({ tenant_id: tenantId })
    .orderBy('created_at', 'desc');

  if (status) query.where({ status });
  if (priority) query.where({ priority });
  if (assigneeId) query.where({ assignee_id: assigneeId });

  const [{ count }] = await query.clone().count('id as count');
  const tasks = await query.select('*').limit(limit).offset(offset);

  return {
    tasks: tasks.map(formatTask),
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: Number(count),
      pages: Math.ceil(Number(count) / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// getTask
// ---------------------------------------------------------------------------

/**
 * @param {string} tenantId
 * @param {string} taskId
 */
export async function getTask(tenantId, taskId) {
  const task = await db('tasks')
    .where({ tenant_id: tenantId, id: taskId })
    .first();

  if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
  return formatTask(task);
}

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------

/**
 * @param {string} tenantId
 * @param {string} createdBy
 * @param {object} data
 */
export async function createTask(tenantId, createdBy, data) {
  const [task] = await db('tasks')
    .insert({
      tenant_id: tenantId,
      created_by: createdBy,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'todo',
      priority: data.priority ?? 'medium',
      due_date: data.dueDate ?? null,
      assignee_id: data.assigneeId ?? null,
    })
    .returning('*');

  taskCreatedTotal.inc({ tenant_id: tenantId });

  // Publish event for real-time updates (non-blocking)
  publishTaskEvent('task.created', { tenantId, task: formatTask(task) }).catch(
    (err) => logger.error({ err }, 'Failed to publish task.created event'),
  );

  // Fire-and-forget AI suggestion
  fetchAiSuggestion(task).catch((err) =>
    logger.warn({ err, taskId: task.id }, 'AI suggestion fetch failed'),
  );

  return formatTask(task);
}

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------

/**
 * @param {string} tenantId
 * @param {string} taskId
 * @param {object} data
 * @returns {{ before: object, after: object }}
 */
export async function updateTask(tenantId, taskId, data) {
  const existing = await db('tasks')
    .where({ tenant_id: tenantId, id: taskId })
    .first();

  if (!existing) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');

  const updates = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.status !== undefined) updates.status = data.status;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.dueDate !== undefined) updates.due_date = data.dueDate;
  if (data.assigneeId !== undefined) updates.assignee_id = data.assigneeId;
  if (data.aiSuggestion !== undefined) updates.ai_suggestion = JSON.stringify(data.aiSuggestion);
  updates.updated_at = db.fn.now();

  const [updated] = await db('tasks')
    .where({ tenant_id: tenantId, id: taskId })
    .update(updates)
    .returning('*');

  publishTaskEvent('task.updated', {
    tenantId,
    task: formatTask(updated),
  }).catch((err) => logger.error({ err }, 'Failed to publish task.updated event'));

  return {
    before: formatTask(existing),
    after: formatTask(updated),
  };
}

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------

/**
 * @param {string} tenantId
 * @param {string} taskId
 */
export async function deleteTask(tenantId, taskId) {
  const deleted = await db('tasks')
    .where({ tenant_id: tenantId, id: taskId })
    .delete()
    .returning('*');

  if (!deleted.length) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');

  publishTaskEvent('task.deleted', { tenantId, taskId }).catch((err) =>
    logger.error({ err }, 'Failed to publish task.deleted event'),
  );

  return formatTask(deleted[0]);
}

// ---------------------------------------------------------------------------
// acceptAiSuggestion — user explicitly accepts a suggestion
// ---------------------------------------------------------------------------

/**
 * @param {string} tenantId
 * @param {string} taskId
 */
export async function acceptAiSuggestion(tenantId, taskId) {
  const task = await db('tasks')
    .where({ tenant_id: tenantId, id: taskId })
    .first();

  if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
  if (!task.ai_suggestion) {
    throw new AppError('No AI suggestion to accept', 400, 'NO_AI_SUGGESTION');
  }

  const suggestion = task.ai_suggestion;
  const updates = { updated_at: db.fn.now() };

  if (suggestion.dueDate) updates.due_date = suggestion.dueDate;
  if (suggestion.priority) updates.priority = suggestion.priority;
  if (suggestion.assigneeId) updates.assignee_id = suggestion.assigneeId;

  const [updated] = await db('tasks')
    .where({ tenant_id: tenantId, id: taskId })
    .update(updates)
    .returning('*');

  return formatTask(updated);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatTask(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    assigneeId: row.assignee_id,
    createdBy: row.created_by,
    aiSuggestion: row.ai_suggestion ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchAiSuggestion(task) {
  const response = await axios.post(
    `${AI_SERVICE_URL}/api/v1/ai/suggest`,
    {
      taskId: task.id,
      title: task.title,
      description: task.description,
      tenantId: task.tenant_id,
    },
    { timeout: 10_000 },
  );

  const suggestion = response.data?.data;
  if (!suggestion) return;

  await db('tasks')
    .where({ id: task.id, tenant_id: task.tenant_id })
    .update({ ai_suggestion: JSON.stringify(suggestion), updated_at: db.fn.now() });

  publishTaskEvent('task.ai_suggestion_ready', {
    tenantId: task.tenant_id,
    taskId: task.id,
    suggestion,
  }).catch(() => {});

  logger.info({ taskId: task.id }, 'AI suggestion stored');
}
