// =============================================================================
// authenticate middleware
//
// The API Gateway validates the JWT before proxying. The gateway then injects
// decoded claims as headers so downstream services don't need the private key.
//
// Expected headers set by the gateway:
//   x-user-id     : string UUID
//   x-tenant-id   : string UUID
//   x-user-role   : 'admin' | 'member' | 'viewer'
// =============================================================================

import { AppError } from '../utils/AppError.js';

export function authenticate(req, _res, next) {
  const userId = req.headers['x-user-id'];
  const tenantId = req.headers['x-tenant-id'];
  const role = req.headers['x-user-role'];

  if (!userId || !tenantId || !role) {
    return next(
      new AppError('Missing authentication headers from gateway', 401, 'UNAUTHENTICATED'),
    );
  }

  req.user = { id: userId, tenantId, role };
  next();
}

/**
 * Require a minimum role level.
 * Role hierarchy: admin > member > viewer
 */
const ROLE_LEVEL = { viewer: 0, member: 1, admin: 2 };

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    const userLevel = ROLE_LEVEL[req.user?.role] ?? -1;
    const required = Math.min(...allowedRoles.map((r) => ROLE_LEVEL[r] ?? 99));
    if (userLevel < required) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };
}
