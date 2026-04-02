// =============================================================================
// Health and metrics endpoints
//
// GET /healthz
//   Checks Redis connectivity (PING).
//   Returns 200 { status: 'ok' } when healthy.
//   Returns 503 { status: 'degraded', checks: { redis: 'error: ...' } } when unhealthy.
//
//   The gateway has no direct DB connection — it only depends on Redis.
//   Downstream service health is NOT checked here (that would be a deep health
//   check and is the responsibility of each service's own /healthz).
//
// GET /metrics
//   Serves Prometheus metrics from prom-client's default registry.
//   Should be firewalled from the public internet and only accessible by
//   the Prometheus scraper (use Nginx auth or network policy in production).
//
// Used by:
//  - Docker HEALTHCHECK
//  - Kubernetes readiness / liveness probes
//  - Prometheus scraper (for /metrics)
//  - Load balancer health checks
// =============================================================================

import { Router } from 'express';
import { redis } from '../redis/client.js';
import { register } from '../utils/metrics.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /healthz — liveness + readiness probe
// ---------------------------------------------------------------------------
router.get('/healthz', async (req, res) => {
  const checks = {};
  let allHealthy = true;

  // Redis connectivity check
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      checks.redis = 'ok';
    } else {
      checks.redis = `unexpected response: ${pong}`;
      allHealthy = false;
    }
  } catch (err) {
    checks.redis = `error: ${err.message}`;
    allHealthy = false;
  }

  const status = allHealthy ? 'ok' : 'degraded';
  const httpStatus = allHealthy ? 200 : 503;

  return res.status(httpStatus).json({
    status,
    service: 'api-gateway',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// ---------------------------------------------------------------------------
// GET /metrics — Prometheus scrape endpoint
// ---------------------------------------------------------------------------
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    return res.end(metrics);
  } catch (err) {
    return res.status(500).end(`# Error collecting metrics: ${err.message}`);
  }
});

export default router;
