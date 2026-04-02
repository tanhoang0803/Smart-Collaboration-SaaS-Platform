// =============================================================================
// Express app factory — AI Service
//
// Exported as the default export so index.js can create the HTTP server and
// test files can import the app without starting the server.
//
// Middleware order (matters):
//  1. Security headers (helmet)
//  2. CORS
//  3. Request logging (pino-http)
//  4. Body parsers
//  5. Routes (health + AI)
//  6. 404 handler
//  7. Global error handler  ← MUST be last
// =============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';
import healthRouter from './routes/health.js';
import aiRouter from './routes/ai.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(
  helmet({
    // Relax CSP in development to allow local tooling
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  }),
);

// ---------------------------------------------------------------------------
// CORS
// Internal service: restrict to gateway origin in production.
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:8080'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server calls from gateway)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'X-User-ID',
      'X-Tenant-ID',
      'X-Request-ID',
    ],
  }),
);

// ---------------------------------------------------------------------------
// Request logging (pino-http)
// Suppress health check and metrics noise in logs.
// ---------------------------------------------------------------------------
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/healthz' || req.url === '/metrics',
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
          userId: req.headers['x-user-id'],
          tenantId: req.headers['x-tenant-id'],
        };
      },
    },
  }),
);

// ---------------------------------------------------------------------------
// Body parsers
// Limit body size — the largest payload is a PR diff at 10 KB + overhead.
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(healthRouter);              // GET /healthz, GET /metrics
app.use('/api/v1/ai', aiRouter);    // POST /api/v1/ai/suggest|draft|review

// ---------------------------------------------------------------------------
// 404 handler — must be before the error handler but after all routes
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
});

// ---------------------------------------------------------------------------
// Global error handler — MUST be the last middleware registered
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;
