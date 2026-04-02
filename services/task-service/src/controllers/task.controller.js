import * as taskService from '../services/task.service.js';
import { success } from '../utils/response.js';

export async function list(req, res, next) {
  try {
    const { status, priority, assigneeId, page, limit } = req.query;
    const result = await taskService.listTasks(req.user.tenantId, {
      status,
      priority,
      assigneeId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    success(res, result.tasks, 200, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const task = await taskService.getTask(req.user.tenantId, req.params.id);
    success(res, task);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const task = await taskService.createTask(
      req.user.tenantId,
      req.user.id,
      req.body,
    );

    res.locals.auditPayload = {
      action: 'task.create',
      resourceType: 'task',
      resourceId: task.id,
      diff: { after: task },
    };

    success(res, task, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { before, after } = await taskService.updateTask(
      req.user.tenantId,
      req.params.id,
      req.body,
    );

    res.locals.auditPayload = {
      action: 'task.update',
      resourceType: 'task',
      resourceId: req.params.id,
      diff: { before, after },
    };

    success(res, after);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const task = await taskService.deleteTask(req.user.tenantId, req.params.id);

    res.locals.auditPayload = {
      action: 'task.delete',
      resourceType: 'task',
      resourceId: req.params.id,
      diff: { before: task },
    };

    success(res, { deleted: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
}

export async function acceptSuggestion(req, res, next) {
  try {
    const task = await taskService.acceptAiSuggestion(
      req.user.tenantId,
      req.params.id,
    );

    res.locals.auditPayload = {
      action: 'task.accept_ai_suggestion',
      resourceType: 'task',
      resourceId: req.params.id,
      diff: { after: task },
    };

    success(res, task);
  } catch (err) {
    next(err);
  }
}
