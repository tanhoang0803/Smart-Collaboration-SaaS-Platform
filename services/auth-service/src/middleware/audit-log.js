// =============================================================================
// Audit log middleware factory
//
// Records every significant mutation in the audit_logs table.
// Must be used AFTER authenticate() (needs req.user) and AFTER the controller
// sets res.locals.resourceId.
//
// Usage:
//   router.post(
//     '/tasks',
//     authenticate,
//     validate(schema),
//     controller.createTask,
//     auditLog('task.created', 'task'),
//   );
//
// The controller sets:   res.locals.resourceId = createdTask.id
// The middleware reads:  req.user, req.tenantId, res.locals.resourceId
//
// Design:
//  - Audit writes are best-effort (failures are logged but never bubble up to
//    the client — we don't want a logging failure to break the main operation).
//  - IP address supports IPv4 and IPv6 (VARCHAR(45) in schema).
// =============================================================================

import db from '../db/client.js';
import logger from '../utils/logger.js';

/**
 * Factory: returns an Express middleware that writes an audit_logs row.
 *
 * @param {string} action        e.g. 'user.registered', 'user.login', 'user.logout'
 * @param {string} resourceType  e.g. 'user', 'tenant', 'refresh_token'
 * @returns {import('express').RequestHandler}
 */
export function auditLog(action, resourceType) {
  return async (req, res, next) => {
    // Only audit if we have a user context (some routes log before auth)
    const userId = req.user?.id ?? null;
    const tenantId = req.user?.tenantId ?? req.tenantId ?? null;
    const resourceId = res.locals.resourceId ?? null;

    // Extract real client IP — respects X-Forwarded-For from Nginx/gateway
    const ipAddr =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
      req.ip ??
      null;

    // Trim to 45 chars (max for the column — handles IPv6-mapped IPv4)
    const safeIp = ipAddr ? String(ipAddr).slice(0, 45) : null;

    try {
      await db('audit_logs').insert({
        tenant_id: tenantId,
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        ip_addr: safeIp,
      });
    } catch (err) {
      // Best-effort — log failure but do not fail the request
      logger.error(
        { err, action, resourceType, userId, tenantId },
        'Failed to write audit log',
      );
    }

    next();
  };
}
