// =============================================================================
// Unit tests — task.service.js
//
// Mocks DB and Redis clients to exercise service logic without real external
// dependencies.
// =============================================================================

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Module mocks — declared before any imports of the mocked modules
// ---------------------------------------------------------------------------

const mockInsertChain = {
  where: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

const makeRow = (overrides = {}) => ({
  id: 'task-uuid-1',
  tenant_id: 'tenant-uuid-1',
  title: 'Test task',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  assignee_id: null,
  created_by: 'user-uuid-1',
  ai_suggestion: null,
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

// Knex chainable query builder mock
const makeQueryChain = (result = null, countResult = [{ count: '0' }]) => {
  const chain = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue(countResult),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(result),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(result ? [result] : []),
    then: (resolve) => resolve(result ? [result] : []),
  };
  return chain;
};

let dbCallbackResult = null;
const mockDbInstance = (tableName) => makeQueryChain(dbCallbackResult);
mockDbInstance.fn = { now: jest.fn(() => new Date()) };

jest.unstable_mockModule('../db/client.js', () => ({ default: mockDbInstance }));

jest.unstable_mockModule('../redis/client.js', () => ({
  default: {},
  publishTaskEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../utils/metrics.js', () => ({
  register: { contentType: 'text/plain', metrics: jest.fn() },
  httpRequestDuration: { startTimer: jest.fn(() => jest.fn()) },
  taskCreatedTotal: { inc: jest.fn() },
}));

// axios used inside task.service for AI suggestion (fire-and-forget)
jest.unstable_mockModule('axios', () => ({
  default: { post: jest.fn().mockResolvedValue({ data: { data: null } }) },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('has correct shape', async () => {
    const { AppError } = await import('../utils/AppError.js');
    const err = new AppError('not found', 404, 'TASK_NOT_FOUND');
    expect(err.message).toBe('not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('TASK_NOT_FOUND');
    expect(err instanceof Error).toBe(true);
  });
});

describe('validate middleware', () => {
  it('calls next with VALIDATION_ERROR when body is invalid', async () => {
    const { validate } = await import('../middleware/validate.js');
    const { z } = await import('zod');

    const schema = z.object({ title: z.string().min(1) });
    const middleware = validate(schema);

    const req = { body: { title: '' } };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(422);
  });

  it('passes and mutates req.body with parsed data on success', async () => {
    const { validate } = await import('../middleware/validate.js');
    const { z } = await import('zod');

    const schema = z.object({ title: z.string().min(1) });
    const middleware = validate(schema);

    const req = { body: { title: 'Hello', extra: 'stripped' } };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ title: 'Hello' });
  });
});

describe('authenticate middleware', () => {
  it('returns 401 when gateway headers are missing', async () => {
    const { authenticate } = await import('../middleware/authenticate.js');

    const req = { headers: {} };
    const res = {};
    const next = jest.fn();

    authenticate(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('sets req.user when all headers present', async () => {
    const { authenticate } = await import('../middleware/authenticate.js');

    const req = {
      headers: {
        'x-user-id': 'user-1',
        'x-tenant-id': 'tenant-1',
        'x-user-role': 'admin',
      },
    };
    const res = {};
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'user-1', tenantId: 'tenant-1', role: 'admin' });
  });
});

describe('authorize middleware', () => {
  it('blocks a viewer from a member-only route', async () => {
    const { authorize } = await import('../middleware/authenticate.js');

    const req = { user: { role: 'viewer' } };
    const res = {};
    const next = jest.fn();

    authorize('member', 'admin')(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('allows an admin on an admin-only route', async () => {
    const { authorize } = await import('../middleware/authenticate.js');

    const req = { user: { role: 'admin' } };
    const res = {};
    const next = jest.fn();

    authorize('admin')(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('error-handler middleware', () => {
  it('returns correct status for AppError', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');
    const { AppError } = await import('../utils/AppError.js');

    const err = new AppError('not found', 404, 'TASK_NOT_FOUND');
    const req = { url: '/api/v1/tasks/123', method: 'GET' };
    let statusCode;
    let body;
    const res = {
      status: (c) => { statusCode = c; return res; },
      json: (b) => { body = b; return res; },
    };

    errorHandler(err, req, res, () => {});

    expect(statusCode).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('returns 500 for unknown errors', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');

    const err = new Error('unexpected');
    const req = { url: '/api/v1/tasks', method: 'POST' };
    let statusCode;
    const res = {
      status: (c) => { statusCode = c; return res; },
      json: () => res,
    };

    errorHandler(err, req, res, () => {});

    expect(statusCode).toBe(500);
  });

  it('returns 409 for Postgres duplicate entry error', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');

    const err = new Error('duplicate');
    err.code = '23505';
    const req = { url: '/api/v1/tasks', method: 'POST' };
    let statusCode;
    let body;
    const res = {
      status: (c) => { statusCode = c; return res; },
      json: (b) => { body = b; return res; },
    };

    errorHandler(err, req, res, () => {});

    expect(statusCode).toBe(409);
    expect(body.error.code).toBe('DUPLICATE_ENTRY');
  });
});
