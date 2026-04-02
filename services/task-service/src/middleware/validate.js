import { AppError } from '../utils/AppError.js';

/**
 * Zod validation middleware factory.
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} [source='body']
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return next(new AppError(message, 422, 'VALIDATION_ERROR'));
    }
    req[source] = result.data;
    next();
  };
}
