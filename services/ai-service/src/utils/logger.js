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
    // Redact sensitive fields from logs — never log API keys or tokens
    redact: {
      paths: [
        'OPENAI_API_KEY',
        'HUGGINGFACE_API_KEY',
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'apiKey',
        'api_key',
      ],
      censor: '[REDACTED]',
    },
    base: {
      service: 'ai-service',
      env: process.env.NODE_ENV || 'development',
    },
  },
  transport,
);

export default logger;
