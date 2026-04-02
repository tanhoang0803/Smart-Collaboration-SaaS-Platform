// =============================================================================
// Slack connector
//
// Uses incoming webhook URLs for outbound notifications.
// The webhook URL is stored encrypted in integrations.config.webhookUrl.
// =============================================================================

import axios from 'axios';
import logger from '../utils/logger.js';

const STATUS_EMOJI = {
  todo: ':white_circle:',
  in_progress: ':large_blue_circle:',
  review: ':large_yellow_circle:',
  done: ':large_green_circle:',
};

const PRIORITY_EMOJI = {
  low: ':arrow_down:',
  medium: ':arrow_right:',
  high: ':arrow_up:',
  urgent: ':rotating_light:',
};

/**
 * Send a task notification to a Slack channel via incoming webhook.
 *
 * @param {{ config: { webhookUrl: string } }} integration
 * @param {object} task
 * @param {'created'|'updated'|'completed'} eventType
 */
export async function sendTaskNotification(integration, task, eventType = 'created') {
  const webhookUrl = integration.config?.webhookUrl;
  if (!webhookUrl) {
    logger.warn({ integrationId: integration.id }, 'Slack webhookUrl not configured');
    return;
  }

  const statusEmoji = STATUS_EMOJI[task.status] ?? ':white_circle:';
  const priorityEmoji = PRIORITY_EMOJI[task.priority] ?? ':arrow_right:';
  const actionText = {
    created: 'New task created',
    updated: 'Task updated',
    completed: 'Task completed',
  }[eventType] ?? 'Task event';

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${actionText}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Title:*\n${task.title}` },
          { type: 'mrkdwn', text: `*Status:*\n${statusEmoji} ${task.status}` },
          { type: 'mrkdwn', text: `*Priority:*\n${priorityEmoji} ${task.priority}` },
          ...(task.dueDate
            ? [{ type: 'mrkdwn', text: `*Due:*\n${new Date(task.dueDate).toLocaleDateString()}` }]
            : []),
        ],
      },
      ...(task.description
        ? [{ type: 'section', text: { type: 'mrkdwn', text: task.description } }]
        : []),
    ],
  };

  await axios.post(webhookUrl, payload, { timeout: 5_000 });
  logger.info({ taskId: task.id, eventType }, 'Slack notification sent');
}
