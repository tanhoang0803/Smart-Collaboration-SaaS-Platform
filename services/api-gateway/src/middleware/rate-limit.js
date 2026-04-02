// =============================================================================
// Distributed rate limiting — express-rate-limit + rate-limit-redis
//
// Two-tier strategy:
//
//  1. unauthenticatedLimiter — 100 req/min per IP
//     Applied to all routes. Protects public endpoints (login, register,
//     OAuth) from brute-force and enumeration attacks.
//
//  2. authenticatedLimiter — 500 req/min per token JTI
//     Applied to protected routes after authenticate() middleware.
//     Keyed by JTI (not IP) so shared NAT / corporate proxies don't penalise
//     multiple legitimate users behind the same IP.
//
// Both limiters use Redis as the backing store (rate-limit-redis) so limits
// are enforced consistently across multiple gateway replicas.
//
// standardHeaders: 'draft-7' sends RateLimit-* headers per RFC 6585 / IETF draft
// legacyHeaders: false suppresses the deprecated X-RateLimit-* headers
// =============================================================================

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../redis/client.js';

// ---------------------------------------------------------------------------
// Unauthenticated limiter — 100 requests per minute per IP
// Applied globally in app.js before any route
// ---------------------------------------------------------------------------
export const unauthenticatedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    // rate-limit-redis expects a sendCommand function that delegates to ioredis
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:unauth:',
  }),
  // Key by IP — req.ip respects trust proxy setting in app.js
  keyGenerator: (req) => req.ip,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    });
  },
  // Skip for internal health / metrics checks
  skip: (req) => ['/healthz', '/metrics'].includes(req.path),
});

// ---------------------------------------------------------------------------
// Authenticated limiter — 500 requests per minute per token JTI
// Applied only to protected proxy routes (after authenticate middleware sets
// the X-Token-JTI header on the request)
// ---------------------------------------------------------------------------
export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:auth:',
  }),
  // Key by JTI — unique per token (not per user, not per IP)
  keyGenerator: (req) => req.headers['x-token-jti'] || req.ip,
  // Skip if authenticate() hasn't run yet (unauthenticated limiter handles those)
  skip: (req) => !req.headers['x-token-jti'],
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded for this token. Please slow down.',
      },
    });
  },
});
