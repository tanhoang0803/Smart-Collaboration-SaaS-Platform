// =============================================================================
// Zod validation middleware factory
//
// Usage:
//   router.post('/register', validate(registerSchema), controller.register);
//
// On failure: returns 400 with the first Zod error message and the full
// errors array for clients that need field-level feedback.
// On success: replaces req.body with the Zod-parsed (and coerced) data so
// controllers always receive clean, typed input.
// =============================================================================

/**
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors;
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errors[0]?.message ?? 'Invalid request body',
        details: errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      },
    });
  }

  // Replace req.body with the Zod-parsed output (trimmed strings, etc.)
  req.body = result.data;
  next();
};
