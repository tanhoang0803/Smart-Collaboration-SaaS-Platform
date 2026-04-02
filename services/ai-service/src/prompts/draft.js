// =============================================================================
// Prompt template — content drafting
//
// Supports two draft types:
//  - slack_message  : short team notification with emoji
//  - pr_description : structured GitHub PR description
// =============================================================================

/**
 * Build a drafting prompt for the given content type.
 *
 * @param {'slack_message' | 'pr_description'} type
 * @param {object} context
 * @param {string} context.taskTitle
 * @param {string} [context.taskDescription]
 * @param {string} [context.assignee]
 * @param {string} [context.status]
 * @returns {string}
 */
export function draftPrompt(type, context) {
  if (type === 'slack_message') {
    return `Write a concise Slack message to notify the team about this task update.

Task: ${context.taskTitle}
Status: ${context.status || 'updated'}
Assignee: ${context.assignee || 'unassigned'}
${context.taskDescription ? `Details: ${context.taskDescription}` : ''}

Requirements:
- 1–2 sentences maximum
- Professional but friendly tone
- Include at least one relevant emoji
- Do NOT include markdown headers or code blocks
- Return plain text only`;
  }

  if (type === 'pr_description') {
    return `Write a GitHub Pull Request description for the following task.

Task: ${context.taskTitle}
${context.taskDescription ? `Description: ${context.taskDescription}` : ''}

Use exactly this markdown format and populate each section:

## Summary
[One paragraph summarising what this PR does and why]

## Changes
- [Key change 1]
- [Key change 2]
- [Key change 3 if applicable]

## Test Plan
- [ ] [Test item 1]
- [ ] [Test item 2]
- [ ] [Test item 3 if applicable]`;
  }

  // Fallback for unknown type — still produces usable output
  return `Write professional content for the following task:

Task: ${context.taskTitle}
${context.taskDescription ? `Description: ${context.taskDescription}` : ''}

Keep the output concise, clear, and actionable.`;
}
