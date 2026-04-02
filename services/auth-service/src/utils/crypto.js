// =============================================================================
// Cryptographic utilities
// - AES-256-GCM symmetric encryption for OAuth tokens stored in the DB
// - SHA-256 token hashing for refresh tokens (we store the hash, never the raw)
//
// ENCRYPTION_KEY env var must be a 64-character lowercase hex string (32 bytes).
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// =============================================================================

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Lazily resolve the encryption key so that tests can set the env var before
 * the module resolves the constant. At runtime the key is derived once and
 * cached in the closure.
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(raw, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a compact string: "<nonce_hex>:<ciphertext_hex>:<auth_tag_hex>"
 *
 * @param {string} plaintext
 * @returns {string}
 */
export function encrypt(plaintext) {
  const key = getKey();
  const nonce = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${nonce.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt a string produced by {@link encrypt}.
 * Throws if the auth tag does not match (tampered ciphertext).
 *
 * @param {string} encryptedString
 * @returns {string} plaintext
 */
export function decrypt(encryptedString) {
  const key = getKey();
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format');
  }
  const [nonceHex, encryptedHex, tagHex] = parts;
  const nonce = Buffer.from(nonceHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * One-way SHA-256 hash of a token (used for refresh token storage).
 * We never store raw tokens — only the hash goes into the DB.
 *
 * @param {string} token
 * @returns {string} 64-char hex digest
 */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
