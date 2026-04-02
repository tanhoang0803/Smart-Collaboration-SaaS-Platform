// =============================================================================
// JWT utilities — RS256 sign / verify
//
// Private and public keys are stored as Base64-encoded PEM strings in env vars.
// Decoding at startup (not on every request) keeps hot-path latency low.
//
// JWT payload shape:
//   { sub: userId, tenantId: uuid, role: 'admin'|'member'|'viewer', jti: uuid }
//
// Access token  — short-lived (default 15 m), used on every API call
// Refresh token — long-lived (default 7 d), single-use, hash stored in DB
// =============================================================================

import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

/**
 * Lazily decode keys so tests can inject env vars before the module executes.
 * Both functions throw if the env var is missing.
 */
function getPrivateKey() {
  const raw = process.env.JWT_PRIVATE_KEY;
  if (!raw) throw new Error('JWT_PRIVATE_KEY env var is not set');
  return Buffer.from(raw, 'base64').toString('utf8');
}

function getPublicKey() {
  const raw = process.env.JWT_PUBLIC_KEY;
  if (!raw) throw new Error('JWT_PUBLIC_KEY env var is not set');
  return Buffer.from(raw, 'base64').toString('utf8');
}

/**
 * Issue a short-lived access token.
 *
 * @param {{ sub: string, tenantId: string, role: string }} payload
 * @returns {string} signed JWT
 */
export function signAccessToken(payload) {
  return jwt.sign(
    { ...payload, jti: randomUUID() },
    getPrivateKey(),
    {
      algorithm: 'RS256',
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
    },
  );
}

/**
 * Issue a long-lived refresh token.
 * The raw value is returned to the client; the caller must hash it before
 * storing in the DB.
 *
 * @param {{ sub: string, tenantId: string, role: string }} payload
 * @returns {string} signed JWT
 */
export function signRefreshToken(payload) {
  return jwt.sign(
    { ...payload, jti: randomUUID() },
    getPrivateKey(),
    {
      algorithm: 'RS256',
      expiresIn: process.env.JWT_REFRESH_TTL || '7d',
    },
  );
}

/**
 * Verify and decode a JWT. Throws if the token is invalid or expired.
 *
 * @param {string} token
 * @returns {import('jsonwebtoken').JwtPayload}
 */
export function verifyToken(token) {
  return jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] });
}

/**
 * Decode a JWT without verifying the signature.
 * ONLY use this when you need the payload from a token you are about to verify
 * separately (e.g., to extract the JTI before blacklisting on logout).
 *
 * @param {string} token
 * @returns {import('jsonwebtoken').JwtPayload | null}
 */
export function decodeToken(token) {
  return jwt.decode(token);
}
