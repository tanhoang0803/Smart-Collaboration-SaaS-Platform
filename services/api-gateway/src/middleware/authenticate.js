// =============================================================================
// JWT authentication middleware — VERIFY only
//
// The gateway does NOT issue tokens (that is the auth-service's responsibility).
// This middleware:
//  1. Extracts the Bearer token from the Authorization header
//  2. Verifies the RS256 signature using the public key
//  3. Checks the JTI against Redis blacklist (set by auth-service on logout)
//  4. Attaches decoded user info to req.user
//  5. Forwards user context to downstream services via internal headers
//
// Downstream services SHOULD also verify the JWT for defense-in-depth, but
// they can additionally trust the forwarded headers within the internal network.
//
// JWT payload shape (issued by auth-service):
//   { sub: userId, tenantId, role, jti, iat, exp }
// =============================================================================

import jwt from 'jsonwebtoken';
import { redis } from '../redis/client.js';
import { AppError } from '../utils/AppError.js';

// Decode the RS256 public key from base64-encoded PEM stored in env
// The key is base64-encoded so it can safely be stored in environment variables
// without newline issues
const publicKey = Buffer.from(process.env.JWT_PUBLIC_KEY || '', 'base64').toString('utf8');

/**
 * Express middleware that verifies a JWT Bearer token.
 *
 * On success:
 *   - req.user = { id, tenantId, role }
 *   - req.tenantId = tenantId
 *   - Downstream headers set: X-User-ID, X-Tenant-ID, X-User-Role, X-Token-JTI
 *
 * On failure:
 *   - Calls next(AppError) with 401
 *
 * @type {import('express').RequestHandler}
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(
        'Missing or invalid Authorization header',
        401,
        'UNAUTHORIZED',
      );
    }

    const token = authHeader.slice(7); // strip "Bearer "

    // Verify signature and expiry — throws JsonWebTokenError or TokenExpiredError on failure
    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

    // Guard: JWT_PUBLIC_KEY not configured — would accept any token
    if (!process.env.JWT_PUBLIC_KEY) {
      throw new AppError(
        'Gateway misconfigured: JWT_PUBLIC_KEY not set',
        500,
        'INTERNAL_ERROR',
      );
    }

    // Check Redis blacklist — auth-service writes blacklist:<jti> on logout
    // The gateway uses the same key prefix so both services share state
    const blacklistKey = `blacklist:${payload.jti}`;
    const blacklisted = await redis.exists(blacklistKey);
    if (blacklisted) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    // Attach decoded user info to the request object
    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };
    req.tenantId = payload.tenantId;

    // Forward user context to downstream services via internal headers.
    // These headers are set AFTER JWT verification so downstream services
    // can trust them within the internal Docker network.
    req.headers['x-user-id'] = payload.sub;
    req.headers['x-tenant-id'] = payload.tenantId;
    req.headers['x-user-role'] = payload.role;
    req.headers['x-token-jti'] = payload.jti;

    // Keep the original Authorization header — downstream services may
    // independently verify the JWT for defense-in-depth.

    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);

    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired', 401, 'TOKEN_EXPIRED'));
    }

    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    }

    // Unexpected error (e.g. Redis down) — propagate as 500
    next(err);
  }
}
