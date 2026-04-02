// =============================================================================
// Global Express error handler
//
// Must be the LAST middleware registered in app.js:
//   app.use(errorHandler);
//
// Express identifies error-handling middleware by its four-argument signature
// (err, req, res, next). The _next parameter must be declared even if unused.
//
// Behaviour:
//  - AppError (isOperational=true)  → statusCode + errorCode + message
//  - JsonWebTokenError / TokenExpiredError  → 401 INVALID_TOKEN
//  - All other errors               → 500 INTERNAL_ERROR
//
// In development: stack trace is included in the response for easier debugging.
// In production:  only the safe error code + message is sent; full error is
//                 logged via pino for ELK ingestion.
//
// The gateway has no DB — no Knex/PG error codes to handle here.
// =============================================================================

import logger from '../utils/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // ── Operational errors (AppError) ─────────────────────────────────────────
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        ...(isDev && { stack: err.stack }),
      },
    });
  }

  // ── JWT errors (fallback — should be caught by authenticate.js first) ─────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }

  // ── Unknown / programmer errors ───────────────────────────────────────────
  // Log the full error for ops — never expose internals to the client
  logger.error(
    {
      err,
      req: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.id,
        tenantId: req.tenantId,
      },
    },
    'Unhandled error in API gateway',
  );

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
      ...(isDev && { stack: err.stack, message: err.message }),
    },
  });
}
