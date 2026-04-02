// =============================================================================
// Health endpoint tests
//
// Tests the GET /healthz endpoint.
// Redis is mocked so tests run without a live Redis instance.
// =============================================================================

import { jest } from '@jest/globals';

// ── Mock Redis before importing app ─────────────────────────────────────────
const mockRedis = {
  ping: jest.fn(),
  exists: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
  call: jest.fn(),
};

jest.unstable_mockModule('../redis/client.js', () => ({
  redis: mockRedis,
}));

// ── Mock rate-limit-redis to avoid real Redis dependency ─────────────────────
jest.unstable_mockModule('rate-limit-redis', () => ({
  RedisStore: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    resetKey: jest.fn(),
  })),
}));

// Dynamic imports after mocks are set up
const { default: request } = await import('supertest');
const { createApp } = await import('../app.js');

const app = createApp();

// ---------------------------------------------------------------------------

describe('GET /healthz', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with status ok when Redis is healthy', async () => {
    mockRedis.ping.mockResolvedValue('PONG');

    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api-gateway');
    expect(res.body.checks.redis).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 503 with status degraded when Redis ping fails', async () => {
    mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).get('/healthz');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.redis).toMatch(/error:/);
  });

  it('returns 503 when Redis returns unexpected response', async () => {
    mockRedis.ping.mockResolvedValue('PANG'); // unexpected

    const res = await request(app).get('/healthz');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.redis).toMatch(/unexpected/);
  });
});
