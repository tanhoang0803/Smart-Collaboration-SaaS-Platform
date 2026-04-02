// =============================================================================
// authenticate middleware tests
//
// Tests JWT extraction, RS256 verification, blacklist check, and header forwarding.
// Uses a real RS256 key pair generated for tests only.
// Redis is mocked to test blacklist behaviour without a live Redis instance.
// =============================================================================

import { jest } from '@jest/globals';
import crypto from 'crypto';

// ── Generate a test RS256 key pair ───────────────────────────────────────────
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Set the public key in env (base64-encoded PEM, as authenticate.js expects)
process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64');

// ── Mock Redis ────────────────────────────────────────────────────────────────
const mockRedis = {
  exists: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn(),
  on: jest.fn(),
  call: jest.fn(),
};

jest.unstable_mockModule('../redis/client.js', () => ({
  redis: mockRedis,
}));

jest.unstable_mockModule('rate-limit-redis', () => ({
  RedisStore: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    resetKey: jest.fn(),
  })),
}));

// Dynamic imports after mocks
const jwt = (await import('jsonwebtoken')).default;
const { authenticate } = await import('../middleware/authenticate.js');

// ---------------------------------------------------------------------------
// Helper: create a signed JWT for tests
// ---------------------------------------------------------------------------
function signToken(payload, options = {}) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
    jwtid: payload.jti || 'test-jti-001',
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Helper: build mock Express req/res/next
// ---------------------------------------------------------------------------
function buildReqResNext(headers = {}) {
  const req = {
    headers: { ...headers },
  };
  const res = {};
  const next = jest.fn();
  return { req, res, next };
}

// ---------------------------------------------------------------------------

describe('authenticate middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.exists.mockResolvedValue(0); // not blacklisted by default
  });

  it('rejects requests with no Authorization header', async () => {
    const { req, res, next } = buildReqResNext();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'UNAUTHORIZED', statusCode: 401 }),
    );
  });

  it('rejects requests with malformed Authorization header (no Bearer prefix)', async () => {
    const { req, res, next } = buildReqResNext({ authorization: 'Basic abc123' });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'UNAUTHORIZED', statusCode: 401 }),
    );
  });

  it('rejects a structurally invalid token', async () => {
    const { req, res, next } = buildReqResNext({ authorization: 'Bearer not.a.valid.jwt' });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'INVALID_TOKEN', statusCode: 401 }),
    );
  });

  it('rejects an expired token', async () => {
    const token = signToken(
      { sub: 'user-1', tenantId: 'tenant-1', role: 'member', jti: 'jti-expired' },
      { expiresIn: '-1s' }, // already expired
    );
    const { req, res, next } = buildReqResNext({ authorization: `Bearer ${token}` });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'TOKEN_EXPIRED', statusCode: 401 }),
    );
  });

  it('rejects a blacklisted token', async () => {
    const jti = 'jti-blacklisted';
    const token = signToken({ sub: 'user-1', tenantId: 'tenant-1', role: 'member', jti });
    const { req, res, next } = buildReqResNext({ authorization: `Bearer ${token}` });

    // Simulate blacklist hit
    mockRedis.exists.mockResolvedValue(1);

    await authenticate(req, res, next);

    expect(mockRedis.exists).toHaveBeenCalledWith(`blacklist:${jti}`);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'TOKEN_REVOKED', statusCode: 401 }),
    );
  });

  it('accepts a valid token and populates req.user and forwarding headers', async () => {
    const jti = 'jti-valid-001';
    const token = signToken({
      sub: 'user-abc',
      tenantId: 'tenant-xyz',
      role: 'admin',
      jti,
    });
    const { req, res, next } = buildReqResNext({ authorization: `Bearer ${token}` });

    await authenticate(req, res, next);

    // Should call next with no arguments (success path)
    expect(next).toHaveBeenCalledWith();

    expect(req.user).toEqual({
      id: 'user-abc',
      tenantId: 'tenant-xyz',
      role: 'admin',
    });
    expect(req.tenantId).toBe('tenant-xyz');

    // Downstream forwarding headers
    expect(req.headers['x-user-id']).toBe('user-abc');
    expect(req.headers['x-tenant-id']).toBe('tenant-xyz');
    expect(req.headers['x-user-role']).toBe('admin');
    expect(req.headers['x-token-jti']).toBe(jti);
  });

  it('keeps the Authorization header intact for downstream defense-in-depth', async () => {
    const token = signToken({
      sub: 'user-abc',
      tenantId: 'tenant-xyz',
      role: 'member',
      jti: 'jti-keep-auth',
    });
    const { req, res, next } = buildReqResNext({ authorization: `Bearer ${token}` });

    await authenticate(req, res, next);

    expect(req.headers.authorization).toBe(`Bearer ${token}`);
  });
});
