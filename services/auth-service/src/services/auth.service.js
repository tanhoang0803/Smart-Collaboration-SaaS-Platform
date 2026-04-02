// =============================================================================
// Auth Service — business logic layer
//
// All database and Redis interactions for authentication operations live here.
// Controllers are intentionally thin: they call one service method and send
// the response.
//
// Responsibilities:
//  - register      : create tenant + admin user in a DB transaction
//  - login         : credential check, brute-force protection, token issuance
//  - refresh       : atomic token rotation (revoke old → insert new)
//  - logout        : blacklist JTI + revoke refresh tokens
//  - getMe         : return the current user's profile
//  - handleOAuth   : upsert OAuth user + issue tokens
// =============================================================================

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import db from '../db/client.js';
import {
  blacklistToken,
  incrementLoginFailures,
  isLoginLocked,
  clearLoginFailures,
} from '../redis/client.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt.js';
import { hashToken } from '../utils/crypto.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 32; // 64 hex chars

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a tenant name to a URL-safe slug.
 * e.g. "Acme Corp" → "acme-corp"
 *
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a random 4-character alphanumeric suffix for slug uniqueness.
 * @returns {string}
 */
function randomSuffix() {
  return randomBytes(2).toString('hex'); // 4 hex chars
}

/**
 * Generate a raw refresh token and its DB-storable hash.
 * @returns {{ raw: string, hash: string }}
 */
function generateRefreshToken() {
  const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  return { raw, hash: hashToken(raw) };
}

/**
 * Issue an access + refresh token pair for a user and persist the refresh
 * token hash in the database.
 *
 * @param {object} user   DB user row
 * @param {object} [trx]  Knex transaction (optional)
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function issueTokenPair(user, trx) {
  const payload = {
    sub: user.id,
    tenantId: user.tenant_id,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshTokenRaw = signRefreshToken(payload);

  // Parse expiry from the signed token to store in DB
  const decoded = verifyToken(refreshTokenRaw);
  const expiresAt = new Date(decoded.exp * 1000);

  // Generate an opaque refresh token to give the client
  // The signed JWT IS the refresh token for this implementation.
  // We also store a hash of a separate random token for DB lookup.
  const { raw: opaqueRaw, hash: opaqueHash } = generateRefreshToken();

  const query = (trx || db)('refresh_tokens').insert({
    user_id: user.id,
    token_hash: opaqueHash,
    expires_at: expiresAt,
    revoked: false,
  });

  await query;

  // Return the signed JWT as the access token and the opaque token as refresh.
  // The opaque refresh token is used as the "raw" identifier for DB lookups.
  // We encode it in the signed JWT via the payload so we can verify it.
  //
  // Practical approach: we issue both a signed refresh JWT AND an opaque token.
  // The client sends the opaque token to /refresh; we look it up by hash.
  // This avoids needing to decode the JWT to find the DB row.
  return { accessToken, refreshToken: opaqueRaw };
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

/**
 * Register a new user. Creates a tenant and the first admin user atomically.
 *
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export async function register(data) {
  const { name, email, password } = data;

  // Check if email already exists globally (across all tenants) — we do NOT
  // allow the same email to create multiple tenants in this implementation.
  // A user wanting to join an existing tenant uses an invite flow (future).
  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    throw new AppError(
      'An account with this email already exists',
      409,
      'EMAIL_ALREADY_EXISTS',
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Generate unique tenant slug
  let slug = slugify(name);
  const existing = await db('tenants').where({ slug }).first();
  if (existing) {
    slug = `${slug}-${randomSuffix()}`;
  }

  return db.transaction(async (trx) => {
    // 1. Create tenant
    const [tenant] = await trx('tenants')
      .insert({ name, slug, plan: 'free' })
      .returning(['id', 'name', 'slug', 'plan', 'created_at']);

    // 2. Create admin user
    const [user] = await trx('users')
      .insert({
        tenant_id: tenant.id,
        email,
        password_hash: passwordHash,
        role: 'admin',
      })
      .returning(['id', 'tenant_id', 'email', 'role', 'created_at']);

    // 3. Issue token pair
    const { accessToken, refreshToken } = await issueTokenPair(user, trx);

    logger.info(
      { userId: user.id, tenantId: tenant.id },
      'New user registered',
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        createdAt: user.created_at,
      },
      accessToken,
      refreshToken,
    };
  });
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

/**
 * Authenticate a user by email, password, and tenant slug.
 *
 * @param {{ email: string, password: string, tenantSlug: string }} data
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export async function login(data) {
  const { email, password, tenantSlug } = data;

  // Brute-force protection — check lockout before any DB query
  const locked = await isLoginLocked(email);
  if (locked) {
    throw new AppError(
      'Too many failed login attempts. Please try again in 15 minutes.',
      429,
      'ACCOUNT_LOCKED',
    );
  }

  // Resolve tenant by slug
  const tenant = await db('tenants').where({ slug: tenantSlug }).first();
  if (!tenant) {
    // Increment failures even for unknown tenant slugs to prevent enumeration
    await incrementLoginFailures(email);
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Find user in this tenant
  const user = await db('users')
    .where({ tenant_id: tenant.id, email })
    .first();

  if (!user) {
    await incrementLoginFailures(email);
    // Generic message — do not reveal whether email or tenant is wrong
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // OAuth-only users have no password
  if (!user.password_hash) {
    await incrementLoginFailures(email);
    throw new AppError(
      'This account uses OAuth login. Please sign in with GitHub or Google.',
      401,
      'OAUTH_ACCOUNT',
    );
  }

  // Compare password
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    const attempts = await incrementLoginFailures(email);
    logger.warn(
      { userId: user.id, tenantId: tenant.id, attempts },
      'Failed login attempt',
    );
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Successful login — clear lockout counter
  await clearLoginFailures(email);

  const { accessToken, refreshToken } = await issueTokenPair(user);

  logger.info({ userId: user.id, tenantId: tenant.id }, 'User logged in');

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    },
    accessToken,
    refreshToken,
  };
}

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------

/**
 * Rotate a refresh token pair. The old token is revoked; a new pair is issued.
 * The operation is atomic — if inserting the new token fails, the old one
 * remains valid.
 *
 * @param {string} rawRefreshToken  The opaque token returned at login/register
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export async function refresh(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);

  // Find the token record
  const tokenRecord = await db('refresh_tokens')
    .where({ token_hash: tokenHash })
    .first();

  if (!tokenRecord) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  if (tokenRecord.revoked) {
    // Possible token reuse attack — revoke ALL tokens for this user
    logger.warn(
      { userId: tokenRecord.user_id },
      'Refresh token reuse detected — revoking all user tokens',
    );
    await db('refresh_tokens')
      .where({ user_id: tokenRecord.user_id })
      .update({ revoked: true });
    throw new AppError(
      'Refresh token has already been used',
      401,
      'TOKEN_REUSE_DETECTED',
    );
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new AppError('Refresh token has expired', 401, 'REFRESH_TOKEN_EXPIRED');
  }

  // Load user
  const user = await db('users').where({ id: tokenRecord.user_id }).first();
  if (!user) {
    throw new AppError('User not found', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Atomic rotation: insert new first, then revoke old
  return db.transaction(async (trx) => {
    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(
      user,
      trx,
    );

    // Revoke old token only after new one is successfully inserted
    await trx('refresh_tokens')
      .where({ id: tokenRecord.id })
      .update({ revoked: true });

    logger.info({ userId: user.id }, 'Refresh tokens rotated');

    return { accessToken, refreshToken: newRefreshToken };
  });
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

/**
 * Logout a user: blacklist the access token JTI and revoke all refresh tokens.
 *
 * @param {string} userId
 * @param {string} jti              JTI from the current access token
 * @param {number} accessTokenExp   Access token exp (Unix timestamp in seconds)
 */
export async function logout(userId, jti, accessTokenExp) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(accessTokenExp - now, 1);

  // Blacklist the current access token JTI so it cannot be reused
  await blacklistToken(jti, ttl);

  // Revoke all active refresh tokens for this user
  const revokedCount = await db('refresh_tokens')
    .where({ user_id: userId, revoked: false })
    .update({ revoked: true });

  logger.info({ userId, revokedRefreshTokens: revokedCount }, 'User logged out');
}

// ---------------------------------------------------------------------------
// getMe
// ---------------------------------------------------------------------------

/**
 * Return the current user's profile and tenant info.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @returns {Promise<object>}
 */
export async function getMe(userId, tenantId) {
  const user = await db('users')
    .where({ id: userId, tenant_id: tenantId })
    .first();

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const tenant = await db('tenants').where({ id: tenantId }).first();

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    oauthProvider: user.oauth_provider,
    tenantId: user.tenant_id,
    tenant: tenant
      ? { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan }
      : null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

// ---------------------------------------------------------------------------
// handleOAuthCallback
// ---------------------------------------------------------------------------

/**
 * Find or create a user for an OAuth login.
 * Upserts by (oauth_provider, oauth_provider_id).
 * If an existing password user has the same email, links the OAuth provider.
 *
 * @param {object} profile   Passport profile object
 * @param {string} provider  'github' | 'google'
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export async function handleOAuthCallback(profile, provider) {
  const providerId = String(profile.id);
  // Extract primary email from the Passport profile
  const email =
    profile.emails?.[0]?.value ??
    profile.email ??
    null;

  if (!email) {
    throw new AppError(
      'OAuth provider did not return an email address. ' +
        'Please ensure your account has a verified email.',
      400,
      'OAUTH_NO_EMAIL',
    );
  }

  const displayName = profile.displayName || profile.username || email;

  return db.transaction(async (trx) => {
    // 1. Look up by provider ID (fastest path — returning user)
    let user = await trx('users')
      .where({ oauth_provider: provider, oauth_provider_id: providerId })
      .first();

    if (user) {
      // Existing OAuth user — just issue tokens
      const { accessToken, refreshToken } = await issueTokenPair(user, trx);
      const tenant = await trx('tenants').where({ id: user.tenant_id }).first();
      logger.info({ userId: user.id, provider }, 'OAuth login');
      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id,
          tenant: tenant
            ? { id: tenant.id, name: tenant.name, slug: tenant.slug }
            : null,
        },
        accessToken,
        refreshToken,
      };
    }

    // 2. Look up by email — link OAuth to existing password account
    user = await trx('users').where({ email }).first();

    if (user) {
      // Link the OAuth provider to the existing account
      const [updatedUser] = await trx('users')
        .where({ id: user.id })
        .update({
          oauth_provider: provider,
          oauth_provider_id: providerId,
          updated_at: db.fn.now(),
        })
        .returning(['id', 'tenant_id', 'email', 'role', 'created_at']);

      const { accessToken, refreshToken } = await issueTokenPair(
        updatedUser,
        trx,
      );
      const tenant = await trx('tenants')
        .where({ id: updatedUser.tenant_id })
        .first();

      logger.info(
        { userId: updatedUser.id, provider },
        'OAuth provider linked to existing account',
      );
      return {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          tenantId: updatedUser.tenant_id,
          tenant: tenant
            ? { id: tenant.id, name: tenant.name, slug: tenant.slug }
            : null,
        },
        accessToken,
        refreshToken,
      };
    }

    // 3. Brand new user — create tenant + user
    let slug = slugify(displayName);
    const existingSlug = await trx('tenants').where({ slug }).first();
    if (existingSlug) {
      slug = `${slug}-${randomSuffix()}`;
    }

    const [tenant] = await trx('tenants')
      .insert({ name: displayName, slug, plan: 'free' })
      .returning(['id', 'name', 'slug', 'plan', 'created_at']);

    const [newUser] = await trx('users')
      .insert({
        tenant_id: tenant.id,
        email,
        password_hash: null,
        role: 'admin',
        oauth_provider: provider,
        oauth_provider_id: providerId,
      })
      .returning(['id', 'tenant_id', 'email', 'role', 'created_at']);

    const { accessToken, refreshToken } = await issueTokenPair(newUser, trx);

    logger.info(
      { userId: newUser.id, tenantId: tenant.id, provider },
      'New OAuth user registered',
    );

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        tenantId: newUser.tenant_id,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        createdAt: newUser.created_at,
      },
      accessToken,
      refreshToken,
    };
  });
}
