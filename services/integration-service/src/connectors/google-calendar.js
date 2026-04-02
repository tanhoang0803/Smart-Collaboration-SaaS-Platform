// =============================================================================
// Google Calendar connector
//
// Creates calendar events from task deadlines and syncs upcoming events.
//
// integration.config shape:   { calendarId: string (default 'primary') }
// integration.access_token_dec: Google OAuth2 access token (decrypted)
// integration.refresh_token_dec: Google OAuth2 refresh token (decrypted)
// =============================================================================

import axios from 'axios';
import logger from '../utils/logger.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Refresh the Google access token using the refresh token.
 * Returns a new access token string.
 */
async function refreshAccessToken(refreshToken) {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }, { timeout: 10_000 });
  return response.data.access_token;
}

/**
 * Create a Google Calendar event from a task due date.
 *
 * @param {{ config: { calendarId?: string }, access_token_dec: string, refresh_token_dec: string }} integration
 * @param {{ id: string, title: string, description?: string, dueDate: string }} task
 * @returns {Promise<{ eventId: string, htmlLink: string }>}
 */
export async function createEventFromTask(integration, task) {
  const calendarId = integration.config?.calendarId ?? 'primary';
  let token = integration.access_token_dec;

  if (!task.dueDate) {
    throw new Error('Task has no due date — cannot create calendar event');
  }

  const dueDate = new Date(task.dueDate);
  const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000); // 1-hour event

  const event = {
    summary: task.title,
    description: task.description ?? '',
    start: { dateTime: dueDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
    extendedProperties: {
      private: { smartCollabTaskId: task.id },
    },
  };

  try {
    const response = await axios.post(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      event,
      { headers: authHeaders(token), timeout: 10_000 },
    );
    logger.info({ taskId: task.id, eventId: response.data.id }, 'Google Calendar event created');
    return { eventId: response.data.id, htmlLink: response.data.htmlLink };
  } catch (err) {
    // Token may have expired — try refreshing once
    if (err.response?.status === 401 && integration.refresh_token_dec) {
      token = await refreshAccessToken(integration.refresh_token_dec);
      const response = await axios.post(
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
        event,
        { headers: authHeaders(token), timeout: 10_000 },
      );
      logger.info({ taskId: task.id, eventId: response.data.id }, 'Google Calendar event created (after token refresh)');
      return { eventId: response.data.id, htmlLink: response.data.htmlLink };
    }
    throw err;
  }
}

/**
 * Fetch upcoming Google Calendar events (next 7 days).
 *
 * @param {{ config: { calendarId?: string }, access_token_dec: string }} integration
 * @returns {Promise<object[]>}
 */
export async function syncEvents(integration) {
  const calendarId = integration.config?.calendarId ?? 'primary';
  const token = integration.access_token_dec;

  if (!token) {
    logger.warn({ integrationId: integration.id }, 'Google Calendar token missing — skipping sync');
    return [];
  }

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const response = await axios.get(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      headers: authHeaders(token),
      params: { timeMin, timeMax, singleEvents: true, orderBy: 'startTime', maxResults: 50 },
      timeout: 15_000,
    },
  );

  return response.data.items.map((event) => ({
    id: event.id,
    title: event.summary,
    start: event.start?.dateTime ?? event.start?.date,
    end: event.end?.dateTime ?? event.end?.date,
    htmlLink: event.htmlLink,
    taskId: event.extendedProperties?.private?.smartCollabTaskId ?? null,
  }));
}
