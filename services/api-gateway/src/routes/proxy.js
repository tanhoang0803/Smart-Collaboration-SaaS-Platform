// =============================================================================
// Proxy routing — http-proxy-middleware
//
// Route table:
//
//  PUBLIC (no authenticate required — auth-service handles its own auth):
//    POST /api/v1/auth/register       → auth-service  (unauthenticated limiter)
//    POST /api/v1/auth/login          → auth-service  (unauthenticated limiter)
//    POST /api/v1/auth/refresh        → auth-service  (unauthenticated limiter)
//    GET  /api/v1/auth/oauth/**       → auth-service  (unauthenticated limiter)
//
//  SEMI-PUBLIC (require authenticate — user must be logged in):
//    POST /api/v1/auth/logout         → auth-service  (requires valid JWT)
//    GET  /api/v1/auth/me             → auth-service  (requires valid JWT)
//
//  PROTECTED (authenticate + tenant resolver required):
//    *    /api/v1/tasks/**            → task-service
//    *    /api/v1/integrations/**     → integration-service
//    *    /api/v1/ai/**               → ai-service
//
// Proxy options:
//  - changeOrigin: true — rewrites the Host header to the target host
//  - on.error: returns a 502 JSON response so clients get a structured error
//  - on.proxyReq: forwards the real client IP via X-Real-IP / X-Forwarded-For
//
// IMPORTANT: express.json() is NOT applied globally in app.js — doing so would
// consume the request body stream before the proxy can forward it. The raw
// body stream is forwarded as-is by http-proxy-middleware.
// =============================================================================

import { createProxyMiddleware } from 'http-proxy-middleware';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authenticatedLimiter } from '../middleware/rate-limit.js';
import { tenantResolver } from '../middleware/tenant-resolver.js';
import { SERVICE_URLS } from '../config/routes.js';
import { activeProxyRequests } from '../utils/metrics.js';
import logger from '../utils/logger.js';

const router = Router();

// ---------------------------------------------------------------------------
// Proxy middleware factory
//
// @param {string} target      The downstream service base URL
// @param {string} serviceName Used for Prometheus gauge labels and logging
// ---------------------------------------------------------------------------
function createProxy(target, serviceName) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // Preserve the original path (no rewriting needed — services share path prefix)
    on: {
      // Called when the upstream request is being sent
      proxyReq: (proxyReq, req) => {
        // Forward the real client IP to downstream services
        proxyReq.setHeader('X-Real-IP', req.ip || '');
        proxyReq.setHeader(
          'X-Forwarded-For',
          req.headers['x-forwarded-for'] || req.ip || '',
        );
        // Tag requests with the gateway name so downstream logs can identify source
        proxyReq.setHeader('X-Forwarded-By', 'api-gateway');

        // Track in-flight requests
        activeProxyRequests.inc({ service: serviceName });
      },

      // Called when the upstream response has been received
      proxyRes: (_proxyRes, req) => {
        activeProxyRequests.dec({ service: serviceName });
      },

      // Called when the proxy encounters a network-level error (connection refused,
      // ECONNRESET, timeout, etc.) — NOT for 4xx/5xx HTTP responses
      error: (err, req, res) => {
        activeProxyRequests.dec({ service: serviceName });
        logger.error(
          { err, service: serviceName, method: req.method, url: req.originalUrl },
          'Proxy error — upstream service unreachable',
        );

        // res may already be closed if the client disconnected
        if (res.headersSent) return;

        res.status(502).json({
          success: false,
          error: {
            code: 'UPSTREAM_ERROR',
            message: 'Service temporarily unavailable. Please try again shortly.',
          },
        });
      },
    },
  });
}

// Pre-create proxy instances — one per downstream service
// (createProxyMiddleware is not cheap; reuse instances for performance)
const authProxy = createProxy(SERVICE_URLS.auth, 'auth');
const tasksProxy = createProxy(SERVICE_URLS.tasks, 'tasks');
const integrationsProxy = createProxy(SERVICE_URLS.integrations, 'integrations');
const aiProxy = createProxy(SERVICE_URLS.ai, 'ai');

// ---------------------------------------------------------------------------
// Auth routes
//
// /api/v1/auth/logout  — requires JWT (invalidates it via auth-service)
// /api/v1/auth/me      — requires JWT (returns current user profile)
// /api/v1/auth/oauth/* — public OAuth2 callback/redirect flows
// /api/v1/auth/*       — everything else is public (register, login, refresh)
//
// Order matters: more specific paths must come before catch-all /api/v1/auth
// ---------------------------------------------------------------------------

// These paths require a valid JWT
router.use('/api/v1/auth/logout', authenticate, authProxy);
router.use('/api/v1/auth/me', authenticate, authProxy);

// OAuth2 flows — public, no JWT required (state param provides CSRF protection)
router.use('/api/v1/auth/oauth', authProxy);

// All other auth routes — public (register, login, refresh, etc.)
router.use('/api/v1/auth', authProxy);

// ---------------------------------------------------------------------------
// Task routes — AUTHENTICATED + tenant-resolved
// ---------------------------------------------------------------------------
router.use('/api/v1/tasks', authenticatedLimiter, authenticate, tenantResolver, tasksProxy);

// ---------------------------------------------------------------------------
// Integration routes — AUTHENTICATED + tenant-resolved
// ---------------------------------------------------------------------------
router.use('/api/v1/integrations', authenticatedLimiter, authenticate, tenantResolver, integrationsProxy);

// ---------------------------------------------------------------------------
// AI routes — AUTHENTICATED + tenant-resolved
// ---------------------------------------------------------------------------
router.use('/api/v1/ai', authenticatedLimiter, authenticate, tenantResolver, aiProxy);

export default router;
