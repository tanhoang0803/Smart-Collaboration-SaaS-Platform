// =============================================================================
// Global Express error handler
//
// Must be the LAST middleware registered in app.js:
//   app.use(errorHandler);
//
// Behaviour:
//  - AppError (isOperational=true) → return statusCode + errorCode + message
//  - Knex/DB unique violation (code 23505) → 409 CONFLICT
//  - Knex/DB foreign key violation (code 23503) → 409 CONFLICT
//  - All other errors → 500, log full stack, return generic message in prod
//
// In development: stack trace is included in the response for easier debugging.
// In production:  only the safe error code + message is sent; full error is
//                 logged via pino for ELK ingestion.
// =============================================================================

import logger from '../utils/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

// PostgreSQL error codes
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';
const PG_CHECK_VIOLATION = '23514';

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

  // ── PostgreSQL constraint violations ──────────────────────────────────────
  if (err.code === PG_UNIQUE_VIOLATION) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A resource with that value already exists',
        ...(isDev && { detail: err.detail }),
      },
    });
  }

  if (err.code === PG_FOREIGN_KEY_VIOLATION) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Referenced resource does not exist',
        ...(isDev && { detail: err.detail }),
      },
    });
  }

  if (err.code === PG_NOT_NULL_VIOLATION || err.code === PG_CHECK_VIOLATION) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data for the requested operation',
        ...(isDev && { detail: err.detail }),
      },
    });
  }

  // ── JWT library errors (should normally be caught in authenticate.js) ─────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
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
    'Unhandled error',
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
