// =============================================================================
// HuggingFace Inference API adapter — fallback provider
//
// Used when AI_PROVIDER=huggingface or as automatic fallback when the primary
// provider (OpenAI) throws an error.
//
// Model: mistralai/Mistral-7B-Instruct-v0.1 (instruction-tuned, free tier)
// API:   https://api-inference.huggingface.co/models/<model>
//
// Note: HuggingFace free tier may have cold-start latency (model loading).
// The service will wait up to 60 s during cold-start if the API returns 503.
// =============================================================================

import { suggestPrompt } from '../prompts/suggest.js';
import { draftPrompt } from '../prompts/draft.js';
import { reviewPrompt } from '../prompts/review.js';
import logger from '../utils/logger.js';

const HF_API_BASE = 'https://api-inference.huggingface.co/models';
const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.1';

/**
 * Send a text-generation request to the HuggingFace Inference API.
 *
 * @param {string} inputs  The full prompt string
 * @param {object} [overrides]  Additional HF parameters
 * @returns {Promise<string>}  The generated text (trimmed, without the prompt)
 */
async function hfQuery(inputs, overrides = {}) {
  const model = process.env.HUGGINGFACE_MODEL || DEFAULT_MODEL;
  const url = `${HF_API_BASE}/${model}`;
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY environment variable is not set');
  }

  const body = {
    inputs,
    parameters: {
      max_new_tokens: 500,
      temperature: 0.3,
      return_full_text: false, // Only return the generated portion, not the prompt
      ...overrides,
    },
  };

  logger.debug({ model, inputLength: inputs.length }, 'HuggingFace request');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Ask HF to wait for the model to load rather than returning a 503
      'X-Wait-For-Model': 'true',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000), // 60 s timeout (HF cold-start)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `HuggingFace API error: HTTP ${response.status} — ${errorText.slice(0, 200)}`,
    );
  }

  const data = await response.json();

  // HuggingFace returns an array: [{ generated_text: "..." }]
  const generated = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  if (!generated) {
    throw new Error('HuggingFace returned an empty generated_text');
  }

  return generated.trim();
}

/**
 * Extract the first JSON object from a string.
 * HuggingFace models sometimes wrap JSON in prose or markdown.
 *
 * @param {string} text
 * @returns {object}
 */
function extractJson(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Look for a JSON object delimited by { ... }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`No JSON object found in HuggingFace response: ${text.slice(0, 300)}`);
    }
    return JSON.parse(match[0]);
  }
}

export const huggingFaceAdapter = {
  name: 'huggingface',

  // ---------------------------------------------------------------------------
  // suggest — task deadline, dependency, and description improvement
  // ---------------------------------------------------------------------------
  async suggest(taskData) {
    // Build the same rich prompt but append explicit JSON instructions
    const basePrompt = suggestPrompt(taskData);
    const prompt = `${basePrompt}\n\nRespond with ONLY the JSON object. No explanation, no markdown.`;

    const generated = await hfQuery(prompt, { max_new_tokens: 400, temperature: 0.2 });
    const parsed = extractJson(generated);

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

    const generated = await hfQuery(prompt, { max_new_tokens: 300, temperature: 0.6 });

    return { text: generated };
  },

  // ---------------------------------------------------------------------------
  // review — structured PR code review
  // ---------------------------------------------------------------------------
  async review(context) {
    const prompt = reviewPrompt(context);

    const generated = await hfQuery(prompt, { max_new_tokens: 600, temperature: 0.3 });

    return { review: generated };
  },
};
