// =============================================================================
// Structured logger — pino
//
// In production: JSON output to stdout for log aggregation (ELK, Datadog, etc.)
// In development: human-readable output via pino-pretty (if installed)
//
// Sensitive fields are redacted so tokens and credentials never appear in logs.
// =============================================================================

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

let transport;
if (isDev) {
  // Attempt to use pino-pretty for development — graceful fallback to JSON
  try {
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
        'authorization',
        'req.headers.authorization',
        'req.headers["x-token-jti"]',
        'token',
        'accessToken',
        'access_token',
        'refreshToken',
        'refresh_token',
      ],
      censor: '[REDACTED]',
    },
    base: {
      service: 'api-gateway',
      env: process.env.NODE_ENV || 'development',
    },
  },
  transport,
);

export default logger;
