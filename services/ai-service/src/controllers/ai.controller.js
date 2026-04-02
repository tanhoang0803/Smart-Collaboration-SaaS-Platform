// =============================================================================
// AI Controller — thin HTTP adapter layer
//
// Each controller function:
//  - Delegates business logic entirely to aiService
//  - Wraps in try/catch and passes errors to Express error handler
//  - Logs the X-User-ID and X-Tenant-ID from gateway-forwarded headers
//    (no auth validation needed — gateway already verified the JWT)
// =============================================================================

import { aiService } from '../services/ai.service.js';
import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// POST /api/v1/ai/suggest
// ---------------------------------------------------------------------------

/**
 * Generate task deadline, dependency and description suggestions.
 *
 * @type {import('express').RequestHandler}
 */
export const suggest = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];

    logger.debug(
      { userId, tenantId, title: req.body.title },
      'Processing suggest request',
    );

    const result = await aiService.suggest(req.body);

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/v1/ai/draft
// ---------------------------------------------------------------------------

/**
 * Draft a Slack message or GitHub PR description for a task.
 *
 * @type {import('express').RequestHandler}
 */
export const draft = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];
    const { type, context } = req.body;

    logger.debug(
      { userId, tenantId, type, taskTitle: context?.taskTitle },
      'Processing draft request',
    );

    const result = await aiService.draft(type, context);

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/v1/ai/review
// ---------------------------------------------------------------------------

/**
 * Generate a structured code review for a pull request.
 *
 * @type {import('express').RequestHandler}
 */
export const review = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];

    logger.debug(
      { userId, tenantId, prTitle: req.body.prTitle },
      'Processing review request',
    );

    const result = await aiService.review(req.body);

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};
