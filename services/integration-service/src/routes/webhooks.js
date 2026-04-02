// =============================================================================
// Webhook routes — NO auth middleware (called by external services).
// Signature verification is done per-provider before the controller.
// =============================================================================

import { Router } from 'express';
import { verifyGitHubWebhook, verifySlackWebhook } from '../middleware/webhook-verify.js';
import * as ctrl from '../controllers/integration.controller.js';

const router = Router();

// GitHub: raw body needed for HMAC verification
router.post(
  '/webhooks/github',
  (req, res, next) => {
    // express.raw was applied globally for /webhooks routes in app.js
    verifyGitHubWebhook(req, res, next);
  },
  (req, res, next) => {
    req.params.provider = 'github';
    ctrl.webhook(req, res, next);
  },
);

// Slack: raw body needed for signing secret verification
router.post(
  '/webhooks/slack',
  (req, res, next) => {
    verifySlackWebhook(req, res, next);
  },
  (req, res, next) => {
    req.params.provider = 'slack';
    ctrl.webhook(req, res, next);
  },
);

// Trello: URL-based auth — no signature to verify
router.post('/webhooks/trello', (req, res, next) => {
  req.params.provider = 'trello';
  ctrl.webhook(req, res, next);
});

// Trello sends a HEAD request to verify the webhook URL on creation
router.head('/webhooks/trello', (_req, res) => res.sendStatus(200));

export default router;
