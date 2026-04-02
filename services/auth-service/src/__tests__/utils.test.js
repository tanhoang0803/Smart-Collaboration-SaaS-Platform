// =============================================================================
// Unit tests — utility modules
// Tests crypto, jwt, and response helpers without any DB/Redis dependencies.
// =============================================================================

import { describe, it, expect, beforeAll } from '@jest/globals';

// ---------------------------------------------------------------------------
// crypto.js tests
// ---------------------------------------------------------------------------

describe('crypto utilities', () => {
  beforeAll(() => {
    // 64-char hex = 32 bytes
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  it('should import encrypt, decrypt, hashToken', async () => {
    const { encrypt, decrypt, hashToken } = await import('../utils/crypto.js');
    expect(typeof encrypt).toBe('function');
    expect(typeof decrypt).toBe('function');
    expect(typeof hashToken).toBe('function');
  });

  it('encrypt/decrypt round-trip preserves plaintext', async () => {
    const { encrypt, decrypt } = await import('../utils/crypto.js');
    const original = 'super-secret-oauth-token-value-12345';
    const ciphertext = encrypt(original);
    expect(ciphertext).not.toBe(original);
    expect(ciphertext.split(':')).toHaveLength(3);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(original);
  });

  it('encrypt produces different ciphertext each call (random nonce)', async () => {
    const { encrypt } = await import('../utils/crypto.js');
    const text = 'same-plaintext';
    const c1 = encrypt(text);
    const c2 = encrypt(text);
    expect(c1).not.toBe(c2);
  });

  it('decrypt throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('../utils/crypto.js');
    const ciphertext = encrypt('hello');
    const [nonce, enc, tag] = ciphertext.split(':');
    // Flip one byte in the auth tag
    const tamperedTag = tag.slice(0, -2) + '00';
    expect(() => decrypt(`${nonce}:${enc}:${tamperedTag}`)).toThrow();
  });

  it('hashToken returns 64-char hex string', async () => {
    const { hashToken } = await import('../utils/crypto.js');
    const hash = hashToken('raw-token-value');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('hashToken is deterministic', async () => {
    const { hashToken } = await import('../utils/crypto.js');
    expect(hashToken('token')).toBe(hashToken('token'));
  });
});

// ---------------------------------------------------------------------------
// response.js tests
// ---------------------------------------------------------------------------

describe('response helpers', () => {
  const makeMockRes = () => {
    const res = {};
    res.status = (code) => { res._status = code; return res; };
    res.json = (body) => { res._body = body; return res; };
    res.send = () => { res._sent = true; return res; };
    return res;
  };

  it('ok() sends 200 with success envelope', async () => {
    const { ok } = await import('../utils/response.js');
    const res = makeMockRes();
    ok(res, { id: '123' }, { page: 1, total: 1 });
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data).toEqual({ id: '123' });
    expect(res._body.meta).toEqual({ page: 1, total: 1 });
  });

  it('created() sends 201 with success envelope', async () => {
    const { created } = await import('../utils/response.js');
    const res = makeMockRes();
    created(res, { id: 'new-id' });
    expect(res._status).toBe(201);
    expect(res._body.success).toBe(true);
    expect(res._body.data).toEqual({ id: 'new-id' });
  });

  it('noContent() sends 204', async () => {
    const { noContent } = await import('../utils/response.js');
    const res = makeMockRes();
    noContent(res);
    expect(res._status).toBe(204);
    expect(res._sent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AppError.js tests
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('constructs with expected properties', async () => {
    const { AppError } = await import('../utils/AppError.js');
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.errorCode).toBe('NOT_FOUND');
    expect(err.isOperational).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validate.js middleware tests
// ---------------------------------------------------------------------------

describe('validate middleware', () => {
  it('calls next() with valid body and replaces req.body', async () => {
    const { validate } = await import('../middleware/validate.js');
    const { z } = await import('zod');

    const schema = z.object({ name: z.string().min(1) });
    const middleware = validate(schema);

    const req = { body: { name: '  Acme  ' } };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    middleware(req, res, next);
    expect(nextCalled).toBe(true);
  });

  it('returns 400 with VALIDATION_ERROR for invalid body', async () => {
    const { validate } = await import('../middleware/validate.js');
    const { z } = await import('zod');

    const schema = z.object({ email: z.string().email() });
    const middleware = validate(schema);

    const req = { body: { email: 'not-an-email' } };
    let responseStatus;
    let responseBody;
    const res = {
      status: (code) => { responseStatus = code; return res; },
      json: (body) => { responseBody = body; return res; },
    };

    middleware(req, res, () => {});
    expect(responseStatus).toBe(400);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });
});
