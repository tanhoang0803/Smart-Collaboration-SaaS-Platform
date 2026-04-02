// =============================================================================
// Tenant resolver middleware
//
// Validates that the X-Tenant-ID header sent by the client matches the
// tenantId embedded in the verified JWT. This prevents a user from one
// tenant accessing another tenant's data by spoofing the X-Tenant-ID header.
//
// Rules:
//  - If client sends X-Tenant-ID AND it matches JWT tenantId → allow, forward
//  - If client sends X-Tenant-ID AND it differs from JWT tenantId → 403
//  - If client omits X-Tenant-ID → inject it from JWT tenantId (convenience)
//  - If JWT has no tenantId → 401 UNAUTHORIZED (malformed token)
//
// This middleware must run AFTER authenticate() so that req.tenantId
// (derived from the JWT) is already populated.
//
// The authoritative X-Tenant-ID forwarded to downstream services is ALWAYS
// sourced from the JWT — never blindly from the client header.
// =============================================================================

import { AppError } from '../utils/AppError.js';

/**
 * Validates and reconciles the X-Tenant-ID header against the JWT tenantId.
 *
 * @type {import('express').RequestHandler}
 */
export function tenantResolver(req, res, next) {
  // req.tenantId is set by authenticate() from the JWT payload
  const jwtTenantId = req.tenantId;

  if (!jwtTenantId) {
    return next(
      new AppError(
        'Token is missing tenantId claim',
        401,
        'UNAUTHORIZED',
      ),
    );
  }

  const clientTenantId = req.headers['x-tenant-id'];

  if (clientTenantId) {
    // Client explicitly supplied X-Tenant-ID — ensure it matches the JWT
    if (clientTenantId !== jwtTenantId) {
      return next(
        new AppError(
          'X-Tenant-ID header does not match authenticated tenant',
          403,
          'TENANT_MISMATCH',
        ),
      );
    }
  } else {
    // Client did not supply X-Tenant-ID — inject it from JWT for convenience
    // Downstream services require this header for row-level isolation
    req.headers['x-tenant-id'] = jwtTenantId;
  }

  // At this point req.headers['x-tenant-id'] === jwtTenantId — safe to forward
  next();
}
