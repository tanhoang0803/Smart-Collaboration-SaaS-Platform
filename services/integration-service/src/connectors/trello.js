// =============================================================================
// Trello connector
//
// Bi-directional card sync:
//  - syncCards: fetch all cards from a Trello board → normalised task list
//  - processWebhookPayload: convert Trello action payload → task update
//
// integration.config shape: { boardId: string, apiKey: string (from env) }
// integration.access_token_dec: Trello user OAuth token (decrypted)
// =============================================================================

import axios from 'axios';
import logger from '../utils/logger.js';

const TRELLO_API = 'https://api.trello.com/1';

const LIST_NAME_TO_STATUS = {
  'To Do': 'todo',
  'Todo': 'todo',
  'Backlog': 'todo',
  'In Progress': 'in_progress',
  'Doing': 'in_progress',
  'Review': 'review',
  'In Review': 'review',
  'Done': 'done',
  'Complete': 'done',
};

function mapListNameToStatus(listName) {
  return LIST_NAME_TO_STATUS[listName] ?? 'todo';
}

/**
 * Fetch all open cards from a Trello board and normalise to task format.
 *
 * @param {{ config: { boardId: string }, access_token_dec: string }} integration
 * @returns {Promise<object[]>}
 */
export async function syncCards(integration) {
  const boardId = integration.config?.boardId;
  const token = integration.access_token_dec;
  const apiKey = process.env.TRELLO_API_KEY;

  if (!boardId || !token || !apiKey) {
    logger.warn({ integrationId: integration.id }, 'Trello config incomplete — skipping sync');
    return [];
  }

  // Fetch lists and cards in one request each
  const [listsRes, cardsRes] = await Promise.all([
    axios.get(`${TRELLO_API}/boards/${boardId}/lists`, {
      params: { key: apiKey, token, fields: 'name,id' },
      timeout: 15_000,
    }),
    axios.get(`${TRELLO_API}/boards/${boardId}/cards/open`, {
      params: { key: apiKey, token, fields: 'name,desc,due,idList,url,labels' },
      timeout: 15_000,
    }),
  ]);

  const listMap = Object.fromEntries(listsRes.data.map((l) => [l.id, l.name]));

  return cardsRes.data.map((card) => {
    const listName = listMap[card.idList] ?? '';
    const hasUrgentLabel = card.labels?.some((l) => l.color === 'red');
    const hasHighLabel = card.labels?.some((l) => l.color === 'orange');

    return {
      title: card.name,
      description: card.desc ?? '',
      status: mapListNameToStatus(listName),
      priority: hasUrgentLabel ? 'urgent' : hasHighLabel ? 'high' : 'medium',
      dueDate: card.due ?? null,
      externalRef: { provider: 'trello', type: 'card', id: card.id, url: card.url },
    };
  });
}

/**
 * Convert a Trello webhook action payload to a task update object.
 *
 * @param {object} payload  — raw Trello webhook body
 * @returns {{ action: string, cardId: string, taskData: object } | null}
 */
export function processWebhookPayload(payload) {
  const action = payload?.action;
  if (!action) return null;

  const { type, data } = action;
  const card = data?.card;
  if (!card) return null;

  if (type === 'updateCard' && data.listAfter) {
    return {
      action: 'move',
      cardId: card.id,
      taskData: { status: mapListNameToStatus(data.listAfter.name) },
    };
  }

  if (type === 'updateCard' && data.old?.due !== undefined) {
    return {
      action: 'update_due',
      cardId: card.id,
      taskData: { dueDate: card.due ?? null },
    };
  }

  if (type === 'createCard') {
    return {
      action: 'create',
      cardId: card.id,
      taskData: {
        title: card.name,
        description: card.desc ?? '',
        status: 'todo',
        priority: 'medium',
        externalRef: { provider: 'trello', type: 'card', id: card.id },
      },
    };
  }

  return null;
}
