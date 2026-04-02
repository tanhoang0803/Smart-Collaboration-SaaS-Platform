import db from '../db/client.js';
import logger from '../utils/logger.js';

/**
 * Append an audit log entry after a mutating operation.
 *
 * Usage: attach after the route handler has set res.locals.auditPayload
 *   res.locals.auditPayload = { action, resourceType, resourceId, diff }
 */
export function auditLog(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = async (body) => {
    res.json = originalJson; // prevent recursion

    const payload = res.locals.auditPayload;
    if (payload && req.user && res.statusCode < 400) {
      const { action, resourceType, resourceId, diff } = payload;
      try {
        await db('audit_logs').insert({
          tenant_id: req.user.tenantId,
          user_id: req.user.id,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          diff: diff ? JSON.stringify(diff) : null,
          ip_addr: req.ip,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to write audit log');
        // Non-fatal — never block the response
      }
    }

    return originalJson(body);
  };

  next();
}
