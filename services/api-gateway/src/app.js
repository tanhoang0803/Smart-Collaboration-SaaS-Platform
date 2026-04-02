// =============================================================================
// Express app factory
//
// Exported as a named export so index.js can create the HTTP server and
// test files can import the app without starting the server.
//
// Middleware stack order (order is critical):
//  1. helmet()            — security headers (must be first)
//  2. cors()              — CORS preflight before any processing
//  3. pino-http logger    — log all requests (except healthz / metrics)
//  4. metricsCollector    — hook res.finish BEFORE proxy to capture all requests
//  5. unauthenticatedLimiter — global IP-based rate limit (before any proxy)
//  6. healthRouter        — /healthz, /metrics (fast path, no auth needed)
//  7. proxyRouter         — all /api/v1/* routes with per-route middleware
//  8. 404 handler
//  9. errorHandler        — MUST be last
//
// IMPORTANT: express.json() is deliberately NOT applied globally.
// Adding it here would consume the incoming request body stream, making it
// impossible for http-proxy-middleware to forward the raw body to the
// downstream service. Each proxy route forwards the body stream directly.
// =============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';
import { metricsCollector } from './middleware/metrics-collector.js';
import { unauthenticatedLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import healthRouter from './routes/health.js';
import proxyRouter from './routes/proxy.js';

/**
 * Create and configure the Express application.
 * Separated from the HTTP server so tests can import the app without binding a port.
 *
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express();

  // ---------------------------------------------------------------------------
  // Trust proxy — required when running behind Nginx or a load balancer
  // Ensures req.ip reflects the client IP from X-Forwarded-For, not the proxy IP
  // '1' means trust the first hop (Nginx)
  // ---------------------------------------------------------------------------
  app.set('trust proxy', 1);

  // ---------------------------------------------------------------------------
  // Security headers — helmet
  //
  // CSP is disabled here because:
  //  - The gateway serves no HTML, only JSON APIs
  //  - CSP for the SPA frontend is set by Nginx on static assets
  // All other helmet defaults are kept: HSTS, X-Frame-Options, etc.
  // ---------------------------------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // ---------------------------------------------------------------------------
  // CORS
  //
  // CORS_ORIGINS env var is a comma-separated list of allowed origins.
  // Example: https://app.yourdomain.com,https://staging.yourdomain.com
  //
  // The origin callback explicitly allows requests with no Origin header
  // (server-to-server, Postman, curl) — this is intentional for internal callers.
  // ---------------------------------------------------------------------------
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, health probes)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin '${origin}' is not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Tenant-ID',
        'X-Request-ID',
      ],
    }),
  );

  // ---------------------------------------------------------------------------
  // HTTP request logging — pino-http
  //
  // Skip /healthz and /metrics to avoid flooding logs with probe noise.
  // Log level escalation: 5xx → error, 4xx → warn, 2xx/3xx → info.
  // Serialisers strip the body from request logs (body may contain credentials).
  // ---------------------------------------------------------------------------
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => ['/healthz', '/metrics'].includes(req.url),
      },
      customLogLevel: (_req, res, _err) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          };
        },
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Prometheus metrics collection
  // Must be registered before proxy routes so all requests are counted,
  // including those that result in 4xx/5xx from the proxy itself.
  // ---------------------------------------------------------------------------
  app.use(metricsCollector);

  // ---------------------------------------------------------------------------
  // Global unauthenticated rate limiter — 100 req/min per IP
  // Applied to ALL routes. Authenticated routes get an additional per-token
  // limiter applied inside proxyRouter.
  // ---------------------------------------------------------------------------
  app.use(unauthenticatedLimiter);

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  // Health + metrics — fast path, no auth or proxy overhead
  app.use(healthRouter);

  // All proxy routes — /api/v1/*
  app.use(proxyRouter);

  // ---------------------------------------------------------------------------
  // 404 handler — catches any path not matched by health or proxy routes
  // ---------------------------------------------------------------------------
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Global error handler — MUST be the last middleware registered
  // Four-argument signature tells Express this is an error handler
  // ---------------------------------------------------------------------------
  app.use(errorHandler);

  return app;
}
