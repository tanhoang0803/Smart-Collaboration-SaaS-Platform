// =============================================================================
// Passport.js strategy configuration
//
// Strategies:
//  - GitHub  (passport-github2)
//  - Google  (passport-google-oauth20)
//
// Both strategies call authService.handleOAuthCallback to upsert users.
// Passport session is NOT used — we are stateless (JWT-based).
// We configure passport.serializeUser/deserializeUser as no-ops to satisfy
// the library contract without enabling sessions.
// =============================================================================

import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import * as authService from '../services/auth.service.js';
import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Serialisation — no-ops (we don't use sessions)
// ---------------------------------------------------------------------------

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ---------------------------------------------------------------------------
// GitHub Strategy
// ---------------------------------------------------------------------------

if (process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_OAUTH_CLIENT_ID,
        clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_OAUTH_CALLBACK_URL ||
          'http://localhost:3001/api/v1/auth/oauth/github/callback',
        scope: ['user:email'],
        // Request email scope explicitly — not all GitHub accounts expose it
        passReqToCallback: false,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const result = await authService.handleOAuthCallback(profile, 'github');
          done(null, result);
        } catch (err) {
          logger.error({ err }, 'GitHub OAuth strategy error');
          done(err);
        }
      },
    ),
  );
  logger.info('GitHub OAuth strategy registered');
} else {
  logger.warn(
    'GITHUB_OAUTH_CLIENT_ID or GITHUB_OAUTH_CLIENT_SECRET not set — GitHub OAuth disabled',
  );
}

// ---------------------------------------------------------------------------
// Google Strategy
// ---------------------------------------------------------------------------

if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_OAUTH_CALLBACK_URL ||
          'http://localhost:3001/api/v1/auth/oauth/google/callback',
        scope: ['profile', 'email'],
        passReqToCallback: false,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const result = await authService.handleOAuthCallback(profile, 'google');
          done(null, result);
        } catch (err) {
          logger.error({ err }, 'Google OAuth strategy error');
          done(err);
        }
      },
    ),
  );
  logger.info('Google OAuth strategy registered');
} else {
  logger.warn(
    'GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not set — Google OAuth disabled',
  );
}

export default passport;
