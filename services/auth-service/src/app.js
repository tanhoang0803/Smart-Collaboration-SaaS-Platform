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
//  5. Passport initialisation (no sessions)
//  6. Routes
//  7. 404 handler
//  8. Global error handler  ← MUST be last
// =============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import passport from './config/passport.js';
import logger from './utils/logger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import oauthRouter from './routes/oauth.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet({
  // Allow inline scripts in development only (Swagger UI, etc.)
  contentSecurityPolicy: process.env.NODE_ENV === 'production'
    ? undefined   // use helmet defaults in production
    : false,
}));

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Postman)
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
// Request logging (pino-http)
// Placed after CORS so preflight OPTIONS requests are also logged.
// ---------------------------------------------------------------------------
app.use(
  pinoHttp({
    logger,
    // Suppress health check noise in logs
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
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// Passport (stateless — no session middleware)
// ---------------------------------------------------------------------------
app.use(passport.initialize());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/auth', oauthRouter);

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
