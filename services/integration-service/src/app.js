// =============================================================================
// Express app factory — Integration Service
//
// Middleware order:
//  1. Security headers (helmet)
//  2. CORS
//  3. Request logging (pino-http)
//  4. Raw body parser for webhook routes (must come before json parser)
//  5. JSON body parser for all other routes
//  6. Prometheus request duration tracking
//  7. Routes
//  8. 404 handler
//  9. Global error handler  ← MUST be last
// =============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';
import { httpRequestDuration } from './utils/metrics.js';
import healthRouter from './routes/health.js';
import integrationsRouter from './routes/integrations.js';
import webhooksRouter from './routes/webhooks.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:8080'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-User-ID', 'X-User-Role', 'X-Request-ID'],
}));

// ---------------------------------------------------------------------------
// Request logging
// ---------------------------------------------------------------------------
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/healthz' },
  customLogLevel: (_req, res, _err) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) {
      return { id: req.id, method: req.method, url: req.url, remoteAddress: req.remoteAddress };
    },
  },
}));

// ---------------------------------------------------------------------------
// Raw body parser for webhook routes (MUST come before express.json)
// Webhooks need the raw buffer to verify HMAC signatures.
// ---------------------------------------------------------------------------
app.use('/webhooks', express.raw({ type: '*/*', limit: '1mb' }));

// ---------------------------------------------------------------------------
// JSON body parser for all other routes
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// Prometheus request duration
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer({ method: req.method });
  res.on('finish', () => {
    end({ route: req.route?.path ?? req.path, status_code: res.statusCode });
  });
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(healthRouter);
app.use('/api/v1/integrations', integrationsRouter);
app.use(webhooksRouter);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.originalUrl}` },
  });
});

// ---------------------------------------------------------------------------
// Global error handler — MUST be last
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;
