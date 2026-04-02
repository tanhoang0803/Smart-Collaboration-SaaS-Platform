// =============================================================================
// GitHub connector
//
// Handles two flows:
//  1. Webhook events (PR opened/closed, issues opened/closed) → task data
//  2. REST API sync (list open PRs from a configured repo) → task list
//
// The integration.config shape expected:
//   { owner: string, repo: string, accessToken: string (decrypted) }
// =============================================================================

import axios from 'axios';
import logger from '../utils/logger.js';

const GITHUB_API = 'https://api.github.com';

/**
 * Convert a GitHub webhook payload into normalised task data.
 *
 * @param {object} payload   — raw webhook body
 * @param {string} eventType — value of X-GitHub-Event header
 * @returns {{ action: string, taskData: object } | null}
 */
export function processWebhookPayload(payload, eventType) {
  if (eventType === 'pull_request') {
    const { action, pull_request: pr, repository } = payload;
    if (!['opened', 'reopened', 'closed'].includes(action)) return null;

    return {
      action,
      taskData: {
        title: `[PR] ${pr.title}`,
        description: pr.body ?? '',
        status: pr.merged ? 'done' : action === 'closed' ? 'done' : 'in_progress',
        priority: 'medium',
        externalRef: { provider: 'github', type: 'pull_request', id: String(pr.number), url: pr.html_url },
        meta: { repo: repository.full_name, number: pr.number, author: pr.user.login },
      },
    };
  }

  if (eventType === 'issues') {
    const { action, issue, repository } = payload;
    if (!['opened', 'reopened', 'closed'].includes(action)) return null;

    return {
      action,
      taskData: {
        title: `[Issue] ${issue.title}`,
        description: issue.body ?? '',
        status: action === 'closed' ? 'done' : 'todo',
        priority: issue.labels?.some((l) => l.name === 'urgent') ? 'urgent'
          : issue.labels?.some((l) => l.name === 'high') ? 'high'
          : 'medium',
        externalRef: { provider: 'github', type: 'issue', id: String(issue.number), url: issue.html_url },
        meta: { repo: repository.full_name, number: issue.number, author: issue.user.login },
      },
    };
  }

  return null;
}

/**
 * Fetch open pull requests from the configured repository.
 *
 * @param {{ config: { owner: string, repo: string }, access_token_dec: string }} integration
 * @returns {Promise<object[]>} array of normalised task data objects
 */
export async function syncPullRequests(integration) {
  const { owner, repo } = integration.config ?? {};
  const token = integration.access_token_dec;

  if (!owner || !repo || !token) {
    logger.warn({ integrationId: integration.id }, 'GitHub config incomplete — skipping sync');
    return [];
  }

  const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    params: { state: 'open', per_page: 50 },
    timeout: 15_000,
  });

  return response.data.map((pr) => ({
    title: `[PR] ${pr.title}`,
    description: pr.body ?? '',
    status: 'in_progress',
    priority: 'medium',
    externalRef: { provider: 'github', type: 'pull_request', id: String(pr.number), url: pr.html_url },
    meta: { repo: `${owner}/${repo}`, number: pr.number, author: pr.user.login },
  }));
}
