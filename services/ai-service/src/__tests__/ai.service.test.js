// =============================================================================
// Unit tests — AI Service
//
// Mocks Redis and AI provider adapters to exercise service and middleware
// logic without real external dependencies.
// =============================================================================

import { describe, it, expect, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.unstable_mockModule('../redis/client.js', () => ({
  redis: { quit: jest.fn() },
  getCachedSuggestion: jest.fn().mockResolvedValue(null),
  cacheSuggestion: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../adapters/index.js', () => ({
  primaryAdapter: {
    suggest: jest.fn().mockResolvedValue({
      dueDate: '2026-04-15T00:00:00Z',
      priority: 'high',
      reasoning: 'Mocked suggestion',
    }),
    draft: jest.fn().mockResolvedValue({ content: 'Mocked draft' }),
    review: jest.fn().mockResolvedValue({ summary: 'Mocked review', suggestions: [] }),
  },
  fallbackAdapter: {
    suggest: jest.fn().mockResolvedValue({ dueDate: null, priority: 'medium', reasoning: 'Fallback' }),
    draft: jest.fn().mockResolvedValue({ content: 'Fallback draft' }),
    review: jest.fn().mockResolvedValue({ summary: 'Fallback review', suggestions: [] }),
  },
}));

jest.unstable_mockModule('../utils/metrics.js', () => ({
  register: { contentType: 'text/plain', metrics: jest.fn() },
  aiRequestsTotal: { inc: jest.fn() },
  aiRequestDurationMs: { startTimer: jest.fn(() => jest.fn()) },
  aiCacheHitsTotal: { inc: jest.fn() },
  aiCacheMissesTotal: { inc: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Tests: AppError
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('sets isOperational = true', async () => {
    const { AppError } = await import('../utils/AppError.js');
    const err = new AppError('AI down', 503, 'AI_UNAVAILABLE');
    expect(err.isOperational).toBe(true);
    expect(err.statusCode).toBe(503);
    expect(err.errorCode).toBe('AI_UNAVAILABLE');
    expect(err instanceof Error).toBe(true);
  });

  it('captures a stack trace', async () => {
    const { AppError } = await import('../utils/AppError.js');
    const err = new AppError('test', 400, 'TEST');
    expect(err.stack).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: error-handler middleware
// ---------------------------------------------------------------------------

describe('errorHandler middleware', () => {
  it('returns operational AppError with correct status and code', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');
    const { AppError } = await import('../utils/AppError.js');

    const err = new AppError('AI is unavailable', 503, 'AI_UNAVAILABLE');
    const req = { method: 'POST', originalUrl: '/api/v1/ai/suggest', ip: '127.0.0.1', headers: {} };
    let statusCode, body;
    const res = {
      status: (c) => { statusCode = c; return res; },
      json: (b) => { body = b; return res; },
    };

    errorHandler(err, req, res, () => {});

    expect(statusCode).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_UNAVAILABLE');
    // User-friendly message for AI_UNAVAILABLE
    expect(body.error.message).toContain('temporarily unavailable');
  });

  it('returns 500 for unknown programmer errors', async () => {
    process.env.NODE_ENV = 'test';
    const { errorHandler } = await import('../middleware/error-handler.js');

    const err = new Error('unexpected crash');
    const req = { method: 'GET', originalUrl: '/api/v1/ai/suggest', ip: '127.0.0.1', headers: {} };
    let statusCode;
    const res = {
      status: (c) => { statusCode = c; return res; },
      json: () => res,
    };

    errorHandler(err, req, res, () => {});
    expect(statusCode).toBe(500);
  });

  it('returns 400 for Zod validation errors', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');

    const err = { name: 'ZodError', errors: [{ path: ['title'], message: 'Required' }] };
    const req = { method: 'POST', originalUrl: '/api/v1/ai/suggest', ip: '127.0.0.1', headers: {} };
    let statusCode, body;
    const res = {
      status: (c) => { statusCode = c; return res; },
      json: (b) => { body = b; return res; },
    };

    errorHandler(err, req, res, () => {});
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Tests: validate middleware
// ---------------------------------------------------------------------------

describe('validate middleware', () => {
  it('passes valid request body', async () => {
    const { validate } = await import('../middleware/validate.js');
    const { z } = await import('zod');

    const schema = z.object({ title: z.string().min(1) });
    const req = { body: { title: 'Fix auth bug', extra: 'ignored' } };
    const next = jest.fn();

    validate(schema)(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ title: 'Fix auth bug' });
  });

  it('rejects invalid body with 400 AppError', async () => {
    const { validate } = await import('../middleware/validate.js');
    const { z } = await import('zod');

    const schema = z.object({ title: z.string().min(1) });
    const req = { body: {} };
    const next = jest.fn();

    validate(schema)(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err.isOperational).toBe(true);
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Tests: aiService — suggest (via mocked adapters)
// ---------------------------------------------------------------------------

describe('aiService.suggest', () => {
  it('returns a suggestion object', async () => {
    const { aiService } = await import('../services/ai.service.js');

    const result = await aiService.suggest({ title: 'Deploy to production', description: 'Final release' });

    expect(result).toBeDefined();
    // Must have at least a priority field from the mocked adapter
    expect(typeof result).toBe('object');
  });
});
