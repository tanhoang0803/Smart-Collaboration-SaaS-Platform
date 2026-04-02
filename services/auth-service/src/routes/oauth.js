// =============================================================================
// OAuth2 routes — /api/v1/auth/oauth/*
//
// Flow:
//  1. Browser visits GET /oauth/github or /oauth/google
//     → passport redirects to provider with state parameter
//  2. Provider redirects back to /oauth/<provider>/callback?code=...&state=...
//     → passport exchanges code for tokens, calls strategy verify callback
//     → strategy calls authService.handleOAuthCallback → returns { user, accessToken, refreshToken }
//     → we redirect the browser to the frontend with tokens in query params
//        (short-lived; frontend should immediately store and remove from URL)
//
// PKCE note: passport-github2 and passport-google-oauth20 handle the OAuth2
// state parameter internally. For production, you should also implement PKCE
// (RFC 7636) at the application level for additional security.
//
// Security:
//  - `state` parameter prevents CSRF (handled by passport)
//  - Tokens are passed in the redirect URL fragment (#) to keep them out of
//    server logs. Frontend reads them from window.location.hash immediately
//    on load and clears the URL via history.replaceState.
// =============================================================================

import { Router } from 'express';
import passport from '../config/passport.js';
import logger from '../utils/logger.js';

const router = Router();

// Resolve the frontend base URL for redirects
const FRONTEND_URL =
  process.env.FRONTEND_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// GitHub OAuth
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/auth/oauth/github
 * Initiates the GitHub OAuth2 flow.
 * Redirects the browser to GitHub's authorization page.
 */
router.get(
  '/oauth/github',
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
  }),
);

/**
 * GET /api/v1/auth/oauth/github/callback
 * GitHub redirects here after the user authorises (or denies) the app.
 */
router.get(
  '/oauth/github/callback',
  (req, res, next) => {
    passport.authenticate('github', { session: false }, (err, result) => {
      handleOAuthResult(err, result, req, res, next, 'github');
    })(req, res, next);
  },
);

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/auth/oauth/google
 * Initiates the Google OAuth2 flow.
 */
router.get(
  '/oauth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  }),
);

/**
 * GET /api/v1/auth/oauth/google/callback
 * Google redirects here after authorisation.
 */
router.get(
  '/oauth/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, result) => {
      handleOAuthResult(err, result, req, res, next, 'google');
    })(req, res, next);
  },
);

// ---------------------------------------------------------------------------
// Shared callback handler
// ---------------------------------------------------------------------------

/**
 * Process the result from a Passport OAuth strategy and redirect to the
 * frontend with tokens in the URL hash fragment.
 *
 * On success:  redirect to <FRONTEND_URL>/auth/callback#accessToken=...&refreshToken=...
 * On failure:  redirect to <FRONTEND_URL>/auth/error?code=OAUTH_FAILED
 *
 * @param {Error | null} err
 * @param {{ user: object, accessToken: string, refreshToken: string } | false} result
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {string} provider
 */
function handleOAuthResult(err, result, req, res, _next, provider) {
  if (err) {
    logger.error({ err, provider }, 'OAuth callback error');
    return res.redirect(
      `${FRONTEND_URL}/auth/error?code=OAUTH_FAILED&provider=${provider}`,
    );
  }

  if (!result) {
    logger.warn({ provider }, 'OAuth authentication was denied by user');
    return res.redirect(
      `${FRONTEND_URL}/auth/error?code=OAUTH_DENIED&provider=${provider}`,
    );
  }

  const { accessToken, refreshToken } = result;

  logger.info(
    { userId: result.user?.id, provider },
    'OAuth authentication successful',
  );

  // Pass tokens in the URL hash fragment — hash is never sent to the server
  // so it won't appear in access logs on the frontend CDN.
  const fragment = new URLSearchParams({
    accessToken,
    refreshToken,
  }).toString();

  return res.redirect(
    `${FRONTEND_URL}/auth/callback#${fragment}`,
  );
}

export default router;
