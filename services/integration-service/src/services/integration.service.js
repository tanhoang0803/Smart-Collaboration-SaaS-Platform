// =============================================================================
// Integration Service — business logic layer
// =============================================================================

import axios from 'axios';
import db from '../db/client.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { syncTotal } from '../utils/metrics.js';
import * as slackConnector from '../connectors/slack.js';
import * as githubConnector from '../connectors/github.js';
import * as trelloConnector from '../connectors/trello.js';
import * as googleCalendarConnector from '../connectors/google-calendar.js';

const SUPPORTED_PROVIDERS = ['slack', 'github', 'trello', 'google_calendar'];

// OAuth redirect URLs per provider
const OAUTH_AUTH_URLS = {
  github: (state) =>
    `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo&state=${state}`,
  google_calendar: (state) =>
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_OAUTH_CALLBACK_URL)}&response_type=code&scope=https://www.googleapis.com/auth/calendar&access_type=offline&state=${state}`,
  slack: (state) =>
    `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=incoming-webhook,chat:write&state=${state}`,
  trello: (_state) =>
    `https://trello.com/1/authorize?expiration=never&name=SmartCollab&scope=read,write&response_type=token&key=${process.env.TRELLO_API_KEY}`,
};

// ---------------------------------------------------------------------------
// listIntegrations
// ---------------------------------------------------------------------------

export async function listIntegrations(tenantId) {
  const rows = await db('integrations').where({ tenant_id: tenantId }).select(
    'id', 'provider', 'config', 'last_synced_at', 'created_at',
  );
  return rows.map(formatIntegration);
}

// ---------------------------------------------------------------------------
// connectIntegration — returns OAuth redirect URL
// ---------------------------------------------------------------------------

export async function connectIntegration(tenantId, provider, userId) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new AppError(`Unsupported provider: ${provider}`, 400, 'UNSUPPORTED_PROVIDER');
  }

  // State encodes tenantId + userId for the callback to re-identify the user
  const state = Buffer.from(JSON.stringify({ tenantId, userId, provider })).toString('base64url');
  const redirectUrl = OAUTH_AUTH_URLS[provider]?.(state);

  if (!redirectUrl) {
    throw new AppError(`OAuth not configured for: ${provider}`, 501, 'NOT_IMPLEMENTED');
  }

  return { redirectUrl, provider, state };
}

// ---------------------------------------------------------------------------
// handleCallback — exchange OAuth code for tokens, store encrypted
// ---------------------------------------------------------------------------

export async function handleCallback(tenantId, provider, code) {
  let accessToken, refreshToken, config = {};

  if (provider === 'github') {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code },
      { headers: { Accept: 'application/json' }, timeout: 10_000 },
    );
    accessToken = response.data.access_token;
    if (!accessToken) throw new AppError('GitHub OAuth failed', 502, 'OAUTH_ERROR');

  } else if (provider === 'google_calendar') {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_OAUTH_CALLBACK_URL,
      code,
      grant_type: 'authorization_code',
    }, { timeout: 10_000 });
    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    config = { calendarId: 'primary' };

  } else if (provider === 'slack') {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: { client_id: process.env.SLACK_CLIENT_ID, client_secret: process.env.SLACK_CLIENT_SECRET, code },
      timeout: 10_000,
    });
    if (!response.data.ok) throw new AppError('Slack OAuth failed', 502, 'OAUTH_ERROR');
    accessToken = response.data.access_token;
    config = { webhookUrl: response.data.incoming_webhook?.url };
  }

  const row = {
    tenant_id: tenantId,
    provider,
    access_token_enc: accessToken ? encrypt(accessToken) : null,
    refresh_token_enc: refreshToken ? encrypt(refreshToken) : null,
    config: JSON.stringify(config),
  };

  // Upsert — replace existing integration for this tenant+provider
  const existing = await db('integrations').where({ tenant_id: tenantId, provider }).first();
  if (existing) {
    await db('integrations').where({ id: existing.id }).update({ ...row, updated_at: db.fn.now() });
    return { provider, connected: true, updated: true };
  }

  await db('integrations').insert(row);
  return { provider, connected: true, updated: false };
}

// ---------------------------------------------------------------------------
// disconnectIntegration
// ---------------------------------------------------------------------------

export async function disconnectIntegration(tenantId, provider) {
  const deleted = await db('integrations')
    .where({ tenant_id: tenantId, provider })
    .delete()
    .returning('id');

  if (!deleted.length) {
    throw new AppError(`No ${provider} integration found`, 404, 'INTEGRATION_NOT_FOUND');
  }

  return { provider, disconnected: true };
}

// ---------------------------------------------------------------------------
// syncIntegration
// ---------------------------------------------------------------------------

export async function syncIntegration(tenantId, provider) {
  const integration = await db('integrations').where({ tenant_id: tenantId, provider }).first();
  if (!integration) {
    throw new AppError(`No ${provider} integration found`, 404, 'INTEGRATION_NOT_FOUND');
  }

  // Decrypt tokens for connector use
  const enriched = {
    ...integration,
    access_token_dec: integration.access_token_enc ? decrypt(integration.access_token_enc) : null,
    refresh_token_dec: integration.refresh_token_enc ? decrypt(integration.refresh_token_enc) : null,
    config: integration.config ?? {},
  };

  let result;
  try {
    if (provider === 'github') {
      result = await githubConnector.syncPullRequests(enriched);
    } else if (provider === 'trello') {
      result = await trelloConnector.syncCards(enriched);
    } else if (provider === 'google_calendar') {
      result = await googleCalendarConnector.syncEvents(enriched);
    } else {
      result = { message: `Manual sync not supported for ${provider}` };
    }

    await db('integrations')
      .where({ id: integration.id })
      .update({ last_synced_at: db.fn.now() });

    syncTotal.inc({ provider, status: 'success' });
    logger.info({ tenantId, provider }, 'Integration sync completed');
    return { provider, synced: true, result };
  } catch (err) {
    syncTotal.inc({ provider, status: 'error' });
    logger.error({ err, tenantId, provider }, 'Integration sync failed');
    throw new AppError(`Sync failed for ${provider}: ${err.message}`, 502, 'SYNC_ERROR');
  }
}

// ---------------------------------------------------------------------------
// handleWebhook — process inbound webhook events
// ---------------------------------------------------------------------------

export async function handleWebhook(provider, payload, headers) {
  if (provider === 'github') {
    const eventType = headers['x-github-event'];
    const result = githubConnector.processWebhookPayload(payload, eventType);
    if (result) {
      logger.info({ provider, eventType, action: result.action }, 'GitHub webhook processed');
    }
    return result ?? { ignored: true };
  }

  if (provider === 'slack') {
    // Handle Slack URL verification challenge
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge };
    }
    logger.info({ provider, type: payload.event?.type }, 'Slack webhook received');
    return { received: true };
  }

  if (provider === 'trello') {
    const result = trelloConnector.processWebhookPayload(payload);
    if (result) {
      logger.info({ provider, action: result.action }, 'Trello webhook processed');
    }
    return result ?? { ignored: true };
  }

  return { ignored: true };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatIntegration(row) {
  return {
    id: row.id,
    provider: row.provider,
    config: row.config ?? {},
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  };
}
