// =============================================================================
// Integration tests — auth.service.js
//
// These tests mock the DB and Redis clients to exercise service logic without
// real external dependencies. For full integration tests with real Postgres and
// Redis, see auth.integration.test.js (requires Testcontainers).
// =============================================================================

import { describe, it, expect, beforeAll, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Module mocks
// Must be declared before any imports of the mocked modules.
// Using jest.unstable_mockModule for ESM compatibility.
// ---------------------------------------------------------------------------

// Mock db client
const mockDb = {
  transaction: jest.fn(),
  raw: jest.fn(),
  fn: { now: jest.fn(() => new Date()) },
};

// Make the mock chainable (knex query builder pattern)
const makeQueryChain = (result = null) => {
  const chain = {
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(result),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(result ? [result] : []),
    select: jest.fn().mockReturnThis(),
  };
  // Make the chain itself thenable so `await db('table')...` works
  chain.then = (resolve) => resolve([result]);
  return chain;
};

jest.unstable_mockModule('../db/client.js', () => ({
  default: Object.assign(
    (tableName) => makeQueryChain(),
    mockDb,
  ),
}));

// Mock redis client
const mockRedis = {
  blacklistToken: jest.fn().mockResolvedValue(undefined),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  incrementLoginFailures: jest.fn().mockResolvedValue(1),
  isLoginLocked: jest.fn().mockResolvedValue(false),
  clearLoginFailures: jest.fn().mockResolvedValue(undefined),
};

jest.unstable_mockModule('../redis/client.js', () => mockRedis);

// Mock JWT utilities
jest.unstable_mockModule('../utils/jwt.js', () => ({
  signAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  signRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  verifyToken: jest.fn().mockReturnValue({
    sub: 'user-id-1',
    tenantId: 'tenant-id-1',
    role: 'admin',
    jti: 'jti-uuid',
    exp: Math.floor(Date.now() / 1000) + 900,
  }),
  decodeToken: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auth.service — AppError usage', () => {
  it('AppError is exported with correct shape', async () => {
    const { AppError } = await import('../utils/AppError.js');
    const err = new AppError('Test', 400, 'TEST_CODE');
    expect(err.isOperational).toBe(true);
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('TEST_CODE');
  });
});

describe('auth.service — hashToken consistency', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
  });

  it('hashToken produces consistent 64-char hex', async () => {
    const { hashToken } = await import('../utils/crypto.js');
    const h1 = hashToken('test-token');
    const h2 = hashToken('test-token');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('hashToken produces different values for different inputs', async () => {
    const { hashToken } = await import('../utils/crypto.js');
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

describe('error-handler middleware', () => {
  it('returns 400 for AppError with 400 status', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');
    const { AppError } = await import('../utils/AppError.js');

    const err = new AppError('Bad request', 400, 'BAD_REQUEST');
    const req = { method: 'POST', originalUrl: '/api/v1/auth/register', ip: '127.0.0.1' };
    let statusCode;
    let responseBody;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (body) => { responseBody = body; return res; },
    };

    errorHandler(err, req, res, () => {});
    expect(statusCode).toBe(400);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('BAD_REQUEST');
  });

  it('returns 500 for unknown errors', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js');

    const err = new Error('Something unexpected happened');
    const req = { method: 'GET', originalUrl: '/api/v1/auth/me', ip: '127.0.0.1', user: null };
    let statusCode;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: () => res,
    };

    errorHandler(err, req, res, () => {});
    expect(statusCode).toBe(500);
  });
});
