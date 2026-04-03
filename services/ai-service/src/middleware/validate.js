// =============================================================================
// Zod validation middleware factory
//
// Usage:
//   router.post('/suggest', validate(suggestSchema), controller.suggest);
//
// On failure: passes a 400 AppError to next() so the global error handler
// formats the response consistently.
// On success: replaces req.body with the Zod-parsed (and coerced) data so
// controllers always receive clean, typed input.
// =============================================================================

import { AppError } from '../utils/AppError.js';

/**
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.errors[0]?.message ?? 'Invalid request body';
    return next(new AppError(message, 400, 'VALIDATION_ERROR'));
  }

  // Replace req.body with the Zod-parsed output (coerced types, defaults applied)
  req.body = result.data;
  next();
};
