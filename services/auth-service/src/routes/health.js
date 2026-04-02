// =============================================================================
// Health check endpoint — GET /healthz
//
// Checks:
//  - PostgreSQL: raw SELECT 1
//  - Redis: PING
//
// Returns 200 { status: 'ok' } only if both dependencies are reachable.
// Returns 503 with error detail if either dependency is down.
//
// Used by:
//  - Docker healthcheck
//  - Kubernetes readiness probe
//  - Prometheus blackbox exporter
//  - Load balancer health checks
// =============================================================================

import { Router } from 'express';
import db from '../db/client.js';
import { redis } from '../redis/client.js';

const router = Router();

router.get('/healthz', async (req, res) => {
  const checks = {};
  let allHealthy = true;

  // PostgreSQL check
  try {
    await db.raw('SELECT 1');
    checks.postgres = 'ok';
  } catch (err) {
    checks.postgres = `error: ${err.message}`;
    allHealthy = false;
  }

  // Redis check
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : `unexpected: ${pong}`;
    if (pong !== 'PONG') allHealthy = false;
  } catch (err) {
    checks.redis = `error: ${err.message}`;
    allHealthy = false;
  }

  const status = allHealthy ? 'ok' : 'degraded';
  const httpStatus = allHealthy ? 200 : 503;

  return res.status(httpStatus).json({
    status,
    service: 'auth-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
