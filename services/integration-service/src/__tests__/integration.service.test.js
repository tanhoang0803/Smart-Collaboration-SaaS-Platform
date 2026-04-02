// =============================================================================
// Unit tests — integration-service
// =============================================================================

import { describe, it, expect, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.unstable_mockModule('../db/client.js', () => ({
  default: Object.assign(
    (_table) => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      select: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    }),
    { fn: { now: jest.fn(() => new Date()) } },
  ),
}));

jest.unstable_mockModule('../redis/client.js', () => ({ default: {} }));

jest.unstable_mockModule('../utils/metrics.js', () => ({
  register: { contentType: 'text/plain', metrics: jest.fn() },
  httpRequestDuration: { startTimer: jest.fn(() => jest.fn()) },
  webhookReceivedTotal: { inc: jest.fn() },
  syncTotal: { inc: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Tests: AppError
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('has correct shape', async () => {
    const { AppError } = await import('../utils/AppError.js');
    const err = new AppError('not found', 404, 'INTEGRATION_NOT_FOUND');
    expect(err.message).toBe('not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('INTEGRATION_NOT_FOUND');
    expect(err instanceof Error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: validate middleware
// ---------------------------------------------------------------------------

describe('validate middleware', () => {
  it('passes valid body and strips unknown fields', async () => {
    const { validate } = await import('../middleware/validate.js');
    const { z } = await import('zod');

    const schema = z.object({ provider: z.string() });
    const req = { body: { provider: 'slack', extra: 'stripped' } };
    const next = jest.fn();

    validate(schema)(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ provider: 'slack' });
  });

  it('calls next with VALIDATION_ERROR for invalid body', async () => {
    const { validate } = await import('../middleware/validate.js');
    const { z } = await import('zod');

    const schema = z.object({ provider: z.enum(['slack', 'github']) });
    const req = { body: { provider: 'unknown' } };
    const next = jest.fn();

    validate(schema)(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Tests: authenticate middleware
// ---------------------------------------------------------------------------

describe('authenticate middleware', () => {
  it('returns 401 when gateway headers missing', async () => {
    const { authenticate } = await import('../middleware/authenticate.js');
    const req = { headers: {} };
    const next = jest.fn();

    authenticate(req, {}, next);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
    expect(next.mock.calls[0][0].code).toBe('UNAUTHENTICATED');
  });

  it('sets req.user when headers present', async () => {
    const { authenticate } = await import('../middleware/authenticate.js');
    const req = { headers: { 'x-user-id': 'u1', 'x-tenant-id': 't1', 'x-user-role': 'admin' } };
    const next = jest.fn();

    authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'u1', tenantId: 't1', role: 'admin' });
  });
});

// ---------------------------------------------------------------------------
// Tests: authorize middleware
// ---------------------------------------------------------------------------

describe('authorize middleware', () => {
  it('blocks viewer from admin route', async () => {
    const { authorize } = await import('../middleware/authenticate.js');
    const req = { user: { role: 'viewer' } };
    const next = jest.fn();

    authorize('admin')(req, {}, next);

    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('allows admin on admin route', async () => {
    const { authorize } = await import('../middleware/authenticate.js');
    const req = { user: { role: 'admin' } };
    const next = jest.fn();

    authorize('admin')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});

// ---------------------------------------------------------------------------
// Tests: error-handler middleware
// ---------------------------------------------------------------------------

describe('errorHandler middleware', () => {
  it('returns AppError status and code', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');
    const { AppError } = await import('../utils/AppError.js');

    const err = new AppError('not found', 404, 'INTEGRATION_NOT_FOUND');
    const req = { url: '/api/v1/integrations/slack', method: 'GET' };
    let statusCode, body;
    const res = {
      status: (c) => { statusCode = c; return res; },
      json: (b) => { body = b; return res; },
    };

    errorHandler(err, req, res, () => {});
    expect(statusCode).toBe(404);
    expect(body.error.code).toBe('INTEGRATION_NOT_FOUND');
  });

  it('returns 500 for unknown errors', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');
    const err = new Error('unexpected');
    const req = { url: '/api/v1/integrations', method: 'GET' };
    let statusCode;
    const res = { status: (c) => { statusCode = c; return res; }, json: () => res };

    errorHandler(err, req, res, () => {});
    expect(statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifyGitHubWebhook middleware
// ---------------------------------------------------------------------------

describe('verifyGitHubWebhook middleware', () => {
  it('returns 401 when signature is missing', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    const { verifyGitHubWebhook } = await import('../middleware/webhook-verify.js');
    const req = { headers: {}, body: Buffer.from('{}') };
    const next = jest.fn();

    verifyGitHubWebhook(req, {}, next);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('calls next() when signature is valid', async () => {
    const secret = 'test-secret-valid';
    process.env.GITHUB_WEBHOOK_SECRET = secret;

    const { createHmac } = await import('crypto');
    const body = Buffer.from(JSON.stringify({ action: 'opened' }));
    const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

    const { verifyGitHubWebhook } = await import('../middleware/webhook-verify.js');
    const req = { headers: { 'x-hub-signature-256': sig }, body };
    const next = jest.fn();

    verifyGitHubWebhook(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ action: 'opened' });
  });
});

// ---------------------------------------------------------------------------
// Tests: GitHub connector — processWebhookPayload
// ---------------------------------------------------------------------------

describe('github connector — processWebhookPayload', () => {
  it('converts PR opened event to task data', async () => {
    const { processWebhookPayload } = await import('../connectors/github.js');

    const payload = {
      action: 'opened',
      pull_request: {
        number: 42,
        title: 'Add feature X',
        body: 'Description here',
        merged: false,
        html_url: 'https://github.com/org/repo/pull/42',
        user: { login: 'dev1' },
      },
      repository: { full_name: 'org/repo' },
    };

    const result = processWebhookPayload(payload, 'pull_request');

    expect(result).not.toBeNull();
    expect(result.action).toBe('opened');
    expect(result.taskData.title).toBe('[PR] Add feature X');
    expect(result.taskData.status).toBe('in_progress');
    expect(result.taskData.externalRef.type).toBe('pull_request');
  });

  it('returns null for unsupported event types', async () => {
    const { processWebhookPayload } = await import('../connectors/github.js');
    const result = processWebhookPayload({}, 'push');
    expect(result).toBeNull();
  });

  it('converts issues opened event to task data', async () => {
    const { processWebhookPayload } = await import('../connectors/github.js');

    const payload = {
      action: 'opened',
      issue: {
        number: 10,
        title: 'Bug in auth',
        body: 'Steps to reproduce...',
        html_url: 'https://github.com/org/repo/issues/10',
        user: { login: 'reporter' },
        labels: [{ name: 'urgent', color: 'red' }],
      },
      repository: { full_name: 'org/repo' },
    };

    const result = processWebhookPayload(payload, 'issues');

    expect(result).not.toBeNull();
    expect(result.taskData.priority).toBe('urgent');
    expect(result.taskData.status).toBe('todo');
  });
});

// ---------------------------------------------------------------------------
// Tests: Trello connector — processWebhookPayload
// ---------------------------------------------------------------------------

describe('trello connector — processWebhookPayload', () => {
  it('converts card move to status update', async () => {
    const { processWebhookPayload } = await import('../connectors/trello.js');

    const payload = {
      action: {
        type: 'updateCard',
        data: {
          card: { id: 'card-1', name: 'My Task' },
          listAfter: { name: 'Done' },
        },
      },
    };

    const result = processWebhookPayload(payload);
    expect(result.action).toBe('move');
    expect(result.taskData.status).toBe('done');
  });

  it('returns null for irrelevant actions', async () => {
    const { processWebhookPayload } = await import('../connectors/trello.js');
    const result = processWebhookPayload({ action: { type: 'addMemberToCard', data: {} } });
    expect(result).toBeNull();
  });
});
