// =============================================================================
// Auth Controller — thin request/response layer
//
// Each method:
//  1. Extracts validated data from req (Zod middleware has already coerced it)
//  2. Calls the auth service
//  3. Sends the API envelope response
//  4. Passes any error to next() for the global error handler
//
// Controllers never contain business logic or DB queries.
// =============================================================================

import * as authService from '../services/auth.service.js';
import { created, ok, noContent } from '../utils/response.js';

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------

export const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);

    // Expose the new user ID for the audit log middleware
    res.locals.resourceId = result.user.id;

    return created(res, result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

export const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);

    res.locals.resourceId = result.user.id;

    return ok(res, result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    return ok(res, result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// (requires authenticate middleware — req.user is guaranteed to be set)
// ---------------------------------------------------------------------------

export const logout = async (req, res, next) => {
  try {
    const { id: userId, jti, exp } = req.user;
    await authService.logout(userId, jti, exp);
    return noContent(res);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// (requires authenticate middleware)
// ---------------------------------------------------------------------------

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id, req.user.tenantId);
    return ok(res, user);
  } catch (err) {
    next(err);
  }
};
