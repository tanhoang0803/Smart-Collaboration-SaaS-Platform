// =============================================================================
// Auth routes — /api/v1/auth/*
//
// Public endpoints (no authentication required):
//   POST /register  — create new tenant + admin user
//   POST /login     — authenticate and receive token pair
//   POST /refresh   — rotate refresh token
//
// Protected endpoints (require Bearer token):
//   POST /logout    — blacklist access token + revoke refresh tokens
//   GET  /me        — return current user's profile
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { auditLog } from '../middleware/audit-log.js';
import * as controller from '../controllers/auth.controller.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(1, 'Name cannot be empty')
    .max(255, 'Name must be 255 characters or fewer')
    .trim(),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Must be a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be 100 characters or fewer'),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Must be a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
  tenantSlug: z
    .string({ required_error: 'Tenant slug is required' })
    .min(1, 'Tenant slug is required')
    .trim(),
});

const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

/**
 * POST /api/v1/auth/register
 * Public — no auth required
 * Body: { name, email, password }
 */
router.post(
  '/register',
  validate(registerSchema),
  controller.register,
  auditLog('user.registered', 'user'),
);

/**
 * POST /api/v1/auth/login
 * Public — no auth required
 * Body: { email, password, tenantSlug }
 */
router.post(
  '/login',
  validate(loginSchema),
  controller.login,
  auditLog('user.login', 'user'),
);

/**
 * POST /api/v1/auth/refresh
 * Public — uses refresh token for auth, not access token
 * Body: { refreshToken }
 */
router.post('/refresh', validate(refreshSchema), controller.refresh);

/**
 * POST /api/v1/auth/logout
 * Protected — requires valid access token
 */
router.post(
  '/logout',
  authenticate,
  controller.logout,
  auditLog('user.logout', 'user'),
);

/**
 * GET /api/v1/auth/me
 * Protected — returns the authenticated user's profile
 */
router.get('/me', authenticate, controller.getMe);

export default router;
