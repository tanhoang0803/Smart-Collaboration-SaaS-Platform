// =============================================================================
// Webhook signature verification middleware.
//
// GitHub: HMAC-SHA256 of the raw body, compared against X-Hub-Signature-256.
// Slack:  HMAC-SHA256 of the versioned payload, compared against X-Slack-Signature.
//
// IMPORTANT: These middlewares must be mounted AFTER express.raw({type:'*/*'})
// so req.body is a Buffer. The router re-parses the body as JSON after
// verification where needed.
// =============================================================================

import crypto from 'crypto';
import { AppError } from '../utils/AppError.js';

function timingSafeEqual(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function verifyGitHubWebhook(req, _res, next) {
  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    return next(new AppError('GitHub webhook secret not configured', 500, 'CONFIG_ERROR'));
  }

  if (!signature) {
    return next(new AppError('Missing X-Hub-Signature-256 header', 401, 'INVALID_SIGNATURE'));
  }

  const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`;

  if (!timingSafeEqual(signature, expected)) {
    return next(new AppError('Invalid GitHub webhook signature', 401, 'INVALID_SIGNATURE'));
  }

  // Re-parse body as JSON for downstream handlers
  try {
    req.body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return next(new AppError('Invalid JSON in webhook body', 400, 'INVALID_BODY'));
  }

  next();
}

export function verifySlackWebhook(req, _res, next) {
  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  const secret = process.env.SLACK_SIGNING_SECRET;

  if (!secret) {
    return next(new AppError('Slack signing secret not configured', 500, 'CONFIG_ERROR'));
  }

  if (!signature || !timestamp) {
    return next(new AppError('Missing Slack signature headers', 401, 'INVALID_SIGNATURE'));
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    return next(new AppError('Slack request timestamp too old', 401, 'REPLAY_ATTACK'));
  }

  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
  const baseString = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(baseString).digest('hex')}`;

  if (!timingSafeEqual(signature, expected)) {
    return next(new AppError('Invalid Slack webhook signature', 401, 'INVALID_SIGNATURE'));
  }

  try {
    req.body = JSON.parse(rawBody);
  } catch {
    req.body = Object.fromEntries(new URLSearchParams(rawBody));
  }

  next();
}
