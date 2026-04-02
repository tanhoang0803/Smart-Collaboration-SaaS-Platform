// =============================================================================
// AppError — operational error class
// Distinguishes known, expected errors (validation, upstream failures) from
// unexpected programmer errors. The global error handler uses isOperational
// to decide how much detail to expose to the client.
// =============================================================================

export class AppError extends Error {
  /**
   * @param {string} message    Human-readable message (safe to expose to clients)
   * @param {number} statusCode HTTP status code
   * @param {string} errorCode  Machine-readable code for the client (e.g. 'AI_UNAVAILABLE')
   */
  constructor(message, statusCode, errorCode) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    // Flag to differentiate operational errors from programming bugs
    this.isOperational = true;
    // Capture stack for logging (not sent to clients in production)
    Error.captureStackTrace(this, this.constructor);
  }
}
