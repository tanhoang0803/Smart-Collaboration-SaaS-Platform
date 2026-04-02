// =============================================================================
// Health and observability routes
//
// GET /healthz   — liveness / readiness probe (Docker, K8s, load balancers)
// GET /metrics   — Prometheus scrape endpoint
//
// Health check verifies:
//  - Redis: PING command responds with PONG
//  (No DB dependency — ai-service is stateless; Redis is the only dependency)
// =============================================================================

import { Router } from 'express';
import { redis } from '../redis/client.js';
import { register } from '../utils/metrics.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /healthz
// ---------------------------------------------------------------------------

router.get('/healthz', async (req, res) => {
  const checks = {};
  let allHealthy = true;

  // Redis check
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : `unexpected response: ${pong}`;
    if (pong !== 'PONG') allHealthy = false;
  } catch (err) {
    checks.redis = `error: ${err.message}`;
    allHealthy = false;
  }

  const status = allHealthy ? 'ok' : 'degraded';
  const httpStatus = allHealthy ? 200 : 503;

  return res.status(httpStatus).json({
    status,
    service: 'ai-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    provider: process.env.AI_PROVIDER || 'openai',
    checks,
  });
});

// ---------------------------------------------------------------------------
// GET /metrics
// Prometheus scrape endpoint — returns text/plain in the Prometheus exposition
// format. Should be protected by network policy (not public-facing).
// ---------------------------------------------------------------------------

router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    return res.end(metrics);
  } catch (err) {
    return res.status(500).end(err.message);
  }
});

export default router;
