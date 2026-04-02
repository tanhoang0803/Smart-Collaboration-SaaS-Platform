import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/integration.controller.js';

const router = Router();

const PROVIDERS = ['slack', 'github', 'trello', 'google_calendar'];
const providerSchema = z.object({ provider: z.enum(PROVIDERS) });

router.use(authenticate);

// List all integrations for the tenant
router.get('/', ctrl.list);

// Initiate OAuth connect — returns redirect URL
router.post(
  '/:provider/connect',
  authorize('admin'),
  validate(providerSchema, 'params'),
  ctrl.connect,
);

// OAuth callback — exchange code for tokens
router.get(
  '/:provider/callback',
  validate(providerSchema, 'params'),
  ctrl.callback,
);

// Disconnect / revoke an integration
router.delete(
  '/:provider',
  authorize('admin'),
  validate(providerSchema, 'params'),
  ctrl.disconnect,
);

// Trigger a manual sync
router.post(
  '/:provider/sync',
  authorize('member', 'admin'),
  validate(providerSchema, 'params'),
  ctrl.sync,
);

export default router;
