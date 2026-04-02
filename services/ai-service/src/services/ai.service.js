// =============================================================================
// AI Service — core business logic
//
// Responsibilities:
//  1. Check Redis cache before calling any AI provider
//  2. Call primaryAdapter; on error, fall back to fallbackAdapter
//  3. Record Prometheus metrics (latency, cache hits, request counts)
//  4. Return AI_UNAVAILABLE (503) if both providers fail — never throw
//     uncaught errors that would break the task creation flow
//
// Cache strategy:
//  - suggest: 10-minute TTL (same input → same recommendation)
//  - draft:   not cached (dynamic / contextual per user)
//  - review:  not cached (each PR is unique)
//
// Cache key: "ai:<operation>:<sha256(payload)>"
// =============================================================================

import { createHash } from 'crypto';
import { primaryAdapter, fallbackAdapter } from '../adapters/index.js';
import { getCachedSuggestion, cacheSuggestion } from '../redis/client.js';
import {
  aiRequestsTotal,
  aiRequestDurationMs,
  aiCacheHitsTotal,
  aiCacheMissesTotal,
} from '../utils/metrics.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

// Default suggestion cache TTL (seconds)
const SUGGEST_CACHE_TTL = parseInt(process.env.AI_CACHE_TTL || '600', 10);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic cache key for an AI operation + payload.
 * SHA-256 of the serialised payload ensures key uniqueness and bounded length.
 *
 * @param {string} operation  'suggest' | 'draft' | 'review'
 * @param {object} payload    Request body for this operation
 * @returns {string}          e.g. "ai:suggest:a3f9..."
 */
function buildCacheKey(operation, payload) {
  const hash = createHash('sha256')
    .update(JSON.stringify({ operation, payload }))
    .digest('hex');
  return `ai:${operation}:${hash}`;
}

/**
 * Execute fn(adapter), recording Prometheus metrics.
 * On failure: logs the error, increments the error counter, and rethrows.
 *
 * @template T
 * @param {string}  operation
 * @param {object}  adapter
 * @param {(adapter: object) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function callAdapter(operation, adapter, fn) {
  const stopTimer = aiRequestDurationMs.startTimer({
    provider: adapter.name,
    operation,
  });

  try {
    const result = await fn(adapter);
    aiRequestsTotal.inc({ provider: adapter.name, operation, status: 'success' });
    return result;
  } catch (err) {
    aiRequestsTotal.inc({ provider: adapter.name, operation, status: 'error' });
    throw err;
  } finally {
    stopTimer();
  }
}

/**
 * Try the primary adapter; on error, try the fallback.
 * If both fail, throw AppError(503, 'AI_UNAVAILABLE').
 *
 * @template T
 * @param {string}  operation
 * @param {(adapter: object) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withFallback(operation, fn) {
  // ── Primary attempt ───────────────────────────────────────────────────────
  try {
    return await callAdapter(operation, primaryAdapter, fn);
  } catch (primaryErr) {
    logger.warn(
      { err: primaryErr, provider: primaryAdapter.name, operation },
      'Primary AI provider failed — attempting fallback',
    );
  }

  // ── Fallback attempt ──────────────────────────────────────────────────────
  if (fallbackAdapter && fallbackAdapter.name !== primaryAdapter.name) {
    try {
      const result = await callAdapter(operation, fallbackAdapter, fn);
      logger.info(
        { provider: fallbackAdapter.name, operation },
        'Fallback AI provider succeeded',
      );
      return result;
    } catch (fallbackErr) {
      logger.error(
        { err: fallbackErr, provider: fallbackAdapter.name, operation },
        'Fallback AI provider also failed',
      );
    }
  }

  // ── Both providers failed ─────────────────────────────────────────────────
  throw new AppError(
    'AI service is temporarily unavailable. Please try again later.',
    503,
    'AI_UNAVAILABLE',
  );
}

// ---------------------------------------------------------------------------
// Public service interface
// ---------------------------------------------------------------------------

export const aiService = {
  /**
   * Generate task management suggestions (deadline, dependencies, description).
   * Results are cached in Redis for SUGGEST_CACHE_TTL seconds.
   *
   * @param {object} taskData  { title, description?, existingTasks? }
   * @returns {Promise<{ deadline: string|null, dependencies: string[], draft_description: string }>}
   */
  async suggest(taskData) {
    const key = buildCacheKey('suggest', taskData);

    // ── Cache lookup ─────────────────────────────────────────────────────────
    const cached = await getCachedSuggestion(key);
    if (cached) {
      aiCacheHitsTotal.inc();
      logger.debug({ key }, 'AI suggestion cache hit');
      return cached;
    }

    aiCacheMissesTotal.inc();
    logger.debug({ key }, 'AI suggestion cache miss — calling provider');

    // ── AI call ──────────────────────────────────────────────────────────────
    const result = await withFallback('suggest', (adapter) => adapter.suggest(taskData));

    // ── Cache result (non-blocking — failure logged, not thrown) ─────────────
    await cacheSuggestion(key, result, SUGGEST_CACHE_TTL);

    return result;
  },

  /**
   * Draft a Slack message or PR description for a task.
   * Not cached — output is context-sensitive per request.
   *
   * @param {'slack_message' | 'pr_description'} type
   * @param {object} context  { taskTitle, taskDescription?, assignee?, status? }
   * @returns {Promise<{ text: string }>}
   */
  async draft(type, context) {
    return withFallback('draft', (adapter) => adapter.draft(type, context));
  },

  /**
   * Generate a structured PR code review.
   * Not cached — each PR is unique.
   *
   * @param {object} context  { prTitle, prDescription?, diff?, changedFiles? }
   * @returns {Promise<{ review: string }>}
   */
  async review(context) {
    return withFallback('review', (adapter) => adapter.review(context));
  },
};
