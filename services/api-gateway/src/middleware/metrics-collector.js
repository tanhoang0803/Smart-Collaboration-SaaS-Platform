// =============================================================================
// Prometheus metrics collection middleware
//
// Hooks into the response 'finish' event to record:
//  - httpRequestsTotal   — increments a counter per request
//  - httpRequestDurationMs — observes the duration from request start to response finish
//
// The 'service' label is derived from the URL path:
//  /api/v1/auth/...         → 'auth'
//  /api/v1/tasks/...        → 'tasks'
//  /api/v1/integrations/... → 'integrations'
//  /api/v1/ai/...           → 'ai'
//  /healthz, /metrics, etc  → 'gateway'
//
// The 'route' label normalises dynamic path segments (UUIDs, numeric IDs)
// to ':id' to prevent high-cardinality explosion in Prometheus.
//
// IMPORTANT: This middleware must be registered BEFORE the proxy routes so
// it captures proxy-forwarded requests too.
// =============================================================================

import { httpRequestsTotal, httpRequestDurationMs } from '../utils/metrics.js';

// Regex to replace UUIDs and numeric IDs with :id
const ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b\d+\b/gi;

/**
 * Derive the downstream service name from the request path.
 * /api/v1/<service>/... → <service>
 * Anything else         → 'gateway'
 *
 * @param {string} path
 * @returns {string}
 */
function extractService(path) {
  // e.g. /api/v1/tasks/123 → ['', 'api', 'v1', 'tasks', '123']
  const parts = path.split('/');
  // parts[3] is the service segment when path starts with /api/v1/
  if (parts[1] === 'api' && parts[2] === 'v1' && parts[3]) {
    return parts[3];
  }
  return 'gateway';
}

/**
 * Normalise a URL path by replacing IDs with ':id' to avoid high-cardinality
 * label values in Prometheus.
 *
 * @param {string} path
 * @returns {string}
 */
function normalisePath(path) {
  return path.replace(ID_PATTERN, ':id');
}

/**
 * Express middleware that records Prometheus metrics for every HTTP request.
 *
 * @type {import('express').RequestHandler}
 */
export function metricsCollector(req, res, next) {
  const startMs = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startMs;
    const service = extractService(req.path);
    const route = req.route?.path || normalisePath(req.path);

    const labels = {
      service,
      method: req.method,
      status: String(res.statusCode),
      route,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationMs.observe(labels, durationMs);
  });

  next();
}
