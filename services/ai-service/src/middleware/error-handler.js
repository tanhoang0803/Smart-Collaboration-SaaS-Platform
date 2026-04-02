// =============================================================================
// Global Express error handler — MUST be the last middleware in app.js
//
// Behaviour:
//  - AppError (isOperational=true)   → return statusCode + errorCode + message
//    Special case: AI_UNAVAILABLE (503) → friendly message, hide internals
//  - ZodError (escaped validate.js)  → 400 VALIDATION_ERROR
//  - All other errors                → 500, log full stack, generic message
//
// In development: stack trace is included in the response for easier debugging.
// In production:  only safe error code + message sent; full error is logged
//                 via pino for ELK ingestion.
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
    // Special user-facing message for AI_UNAVAILABLE to avoid leaking provider info
    const message =
      err.errorCode === 'AI_UNAVAILABLE'
        ? 'AI assistance is temporarily unavailable. Your request has been saved and you can proceed without AI suggestions.'
        : err.message;

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message,
        ...(isDev && { stack: err.stack }),
      },
    });
  }

  // ── Zod errors that escaped validate.js (should not happen, but safe guard) ──
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors?.[0]?.message ?? 'Invalid request body',
        details: err.errors?.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // ── JSON parse errors (malformed request body) ────────────────────────────
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains invalid JSON',
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
        userId: req.headers['x-user-id'],
        tenantId: req.headers['x-tenant-id'],
      },
    },
    'Unhandled error in AI service',
  );

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
      ...(isDev && { stack: err.stack, detail: err.message }),
    },
  });
}
