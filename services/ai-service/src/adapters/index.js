// =============================================================================
// Adapter factory — provider selection at startup
//
// Reads AI_PROVIDER env var (default: 'openai') to select the primary adapter.
// The other registered adapter is automatically used as the fallback provider
// inside ai.service.js → withFallback().
//
// Supported values: 'openai' | 'huggingface'
// =============================================================================

import { openAIAdapter } from './openai.adapter.js';
import { huggingFaceAdapter } from './huggingface.adapter.js';
import logger from '../utils/logger.js';

/** @type {Record<string, object>} */
const adapters = {
  openai: openAIAdapter,
  huggingface: huggingFaceAdapter,
};

const providerName = (process.env.AI_PROVIDER || 'openai').toLowerCase();

if (!adapters[providerName]) {
  logger.warn(
    { AI_PROVIDER: process.env.AI_PROVIDER, fallback: 'openai' },
    'Unknown AI_PROVIDER value — defaulting to openai',
  );
}

/** Primary AI adapter selected by AI_PROVIDER env var. */
export const primaryAdapter = adapters[providerName] ?? openAIAdapter;

/**
 * Fallback adapter — automatically the other provider.
 * If primary is openai → fallback is huggingface, and vice versa.
 * This gives zero-configuration resilience between the two providers.
 */
export const fallbackAdapter =
  primaryAdapter.name === 'openai' ? huggingFaceAdapter : openAIAdapter;

logger.info(
  { primary: primaryAdapter.name, fallback: fallbackAdapter.name },
  'AI provider configuration loaded',
);
