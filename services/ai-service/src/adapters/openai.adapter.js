// =============================================================================
// OpenAI GPT-4o adapter
//
// Implements the standard adapter interface:
//   suggest(taskData)   → { deadline, dependencies, draft_description }
//   draft(type, context)→ { text }
//   review(context)     → { review }
//
// All methods throw on error — withFallback() in ai.service.js handles retries
// and fallback to the secondary provider.
// =============================================================================

import OpenAI from 'openai';
import { suggestPrompt } from '../prompts/suggest.js';
import { draftPrompt } from '../prompts/draft.js';
import { reviewPrompt } from '../prompts/review.js';
import { aiTokensUsed } from '../utils/metrics.js';
import logger from '../utils/logger.js';

// Lazily instantiated so tests can mock the env var before creating the client
let _client = null;

function getClient() {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/**
 * Record token usage in Prometheus and debug logs.
 *
 * @param {import('openai').CompletionUsage | undefined} usage
 * @param {string} operation
 */
function recordUsage(usage, operation) {
  if (!usage) return;
  aiTokensUsed.inc({ type: 'prompt' }, usage.prompt_tokens);
  aiTokensUsed.inc({ type: 'completion' }, usage.completion_tokens);
  logger.debug(
    {
      operation,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
    'OpenAI token usage',
  );
}

export const openAIAdapter = {
  name: 'openai',

  // ---------------------------------------------------------------------------
  // suggest — task deadline, dependency, and description improvement
  // ---------------------------------------------------------------------------
  async suggest(taskData) {
    const prompt = suggestPrompt(taskData);
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const response = await getClient().chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a project management assistant. Return ONLY valid JSON matching the specified schema. No markdown, no explanation.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
      // response_format forces the model to emit a JSON object (GPT-4o / gpt-4-turbo)
      response_format: { type: 'json_object' },
    });

    recordUsage(response.usage, 'suggest');

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned an empty response for suggest');

    const parsed = JSON.parse(content);

    // Normalise: guarantee required fields exist with sensible defaults
    return {
      deadline: parsed.deadline ?? null,
      dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies : [],
      draft_description: parsed.draft_description ?? '',
    };
  },

  // ---------------------------------------------------------------------------
  // draft — Slack message or PR description
  // ---------------------------------------------------------------------------
  async draft(type, context) {
    const prompt = draftPrompt(type, context);
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const response = await getClient().chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional communication assistant. Be concise and clear.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    recordUsage(response.usage, 'draft');

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI returned an empty response for draft');

    return { text };
  },

  // ---------------------------------------------------------------------------
  // review — structured PR code review
  // ---------------------------------------------------------------------------
  async review(context) {
    const prompt = reviewPrompt(context);
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const response = await getClient().chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert code reviewer. Be constructive and specific.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    recordUsage(response.usage, 'review');

    const review = response.choices[0]?.message?.content?.trim();
    if (!review) throw new Error('OpenAI returned an empty response for review');

    return { review };
  },
};
