// =============================================================================
// Express app factory
//
// Exported as the default export so index.js can create the HTTP server and
// test files can import the app without starting the server.
//
// Middleware order (matters):
//  1. Security headers (helmet)
//  2. CORS
//  3. Request logging (pino-http)
//  4. Body parsers
//  5. Routes
//  6. 404 handler
//  7. Global error handler  ← MUST be last
// =============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';
import { httpRequestDuration } from './utils/metrics.js';
import healthRouter from './routes/health.js';
import tasksRouter from './routes/tasks.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// ---------------------------------------------------------------------------
// CORS — task-service sits behind the gateway (service-to-service),
// but we still configure CORS defensively.
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:8080'];

app.use(
  cors({
    origin: (origin, callback) => {
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
      'X-User-ID',
      'X-User-Role',
      'X-Request-ID',
    ],
  }),
);

// ---------------------------------------------------------------------------
// Request logging (pino-http)
// ---------------------------------------------------------------------------
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/healthz',
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
// Prometheus request duration tracking
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer({ method: req.method });
  res.on('finish', () => {
    end({ route: req.route?.path ?? req.path, status_code: res.statusCode });
  });
  next();
});

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(healthRouter);
app.use('/api/v1/tasks', tasksRouter);

// ---------------------------------------------------------------------------
// 404 handler
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
// Global error handler — MUST be last
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;
