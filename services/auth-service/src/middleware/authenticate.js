// =============================================================================
// Bearer token authentication middleware
//
// 1. Extracts the JWT from the Authorization header
// 2. Verifies RS256 signature + expiry
// 3. Checks the JTI against the Redis blacklist (handles logout / rotation)
// 4. Attaches { id, tenantId, role } to req.user and req.tenantId
//
// Throws AppError(401) for any failure — never leaks details in production.
// =============================================================================

import { verifyToken } from '../utils/jwt.js';
import { isTokenBlacklisted } from '../redis/client.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * @type {import('express').RequestHandler}
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Authorization header missing or malformed',
        401,
        'UNAUTHORIZED',
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // Verify signature and expiry — throws on failure
    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      // jwt.verify throws JsonWebTokenError, TokenExpiredError, etc.
      const isExpired = err.name === 'TokenExpiredError';
      throw new AppError(
        isExpired ? 'Token has expired' : 'Invalid token',
        401,
        isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      );
    }

    // Check JTI blacklist (covers logout and rotation invalidation)
    if (payload.jti) {
      const blacklisted = await isTokenBlacklisted(payload.jti);
      if (blacklisted) {
        throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
      }
    }

    // Attach standardised user context to request
    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };

    // Convenience shorthand used by downstream middleware (audit log, etc.)
    req.tenantId = payload.tenantId;

    next();
  } catch (err) {
    // Pass AppErrors through; wrap unexpected errors
    if (err.isOperational) {
      return next(err);
    }
    logger.error({ err }, 'Unexpected error in authenticate middleware');
    next(new AppError('Authentication failed', 401, 'UNAUTHORIZED'));
  }
}

/**
 * Role-based access control middleware factory.
 * Must be used AFTER authenticate().
 *
 * @param {...string} allowedRoles  e.g. requireRole('admin', 'member')
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401, 'UNAUTHORIZED'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have permission to perform this action',
          403,
          'FORBIDDEN',
        ),
      );
    }
    next();
  };
}
