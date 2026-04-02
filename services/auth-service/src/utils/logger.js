// =============================================================================
// Structured logger — pino
// In production: JSON output to stdout for log aggregation (ELK, Datadog, etc.)
// In development: human-readable output via pino-pretty (if installed)
// =============================================================================

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

let transport;
if (isDev) {
  // Attempt to use pino-pretty for development — graceful fallback to JSON
  try {
    // Dynamic import check — if pino-pretty is not installed, we fall through
    transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    });
  } catch {
    // pino-pretty not available; fall through to plain JSON
  }
}

const logger = pino(
  {
    level,
    // Redact sensitive fields from logs — never log passwords, tokens, keys
    redact: {
      paths: [
        'password',
        'passwordHash',
        'password_hash',
        'token',
        'refreshToken',
        'refresh_token',
        'accessToken',
        'access_token',
        'authorization',
        'req.headers.authorization',
        'req.body.password',
        'req.body.refreshToken',
      ],
      censor: '[REDACTED]',
    },
    base: {
      service: 'auth-service',
      env: process.env.NODE_ENV || 'development',
    },
  },
  transport,
);

export default logger;
