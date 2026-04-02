// =============================================================================
// Prompt template — task suggestion
//
// Instructs the model to return a structured JSON object containing:
//  - deadline        : ISO 8601 datetime string
//  - dependencies    : string array of task titles / resource names
//  - draft_description : improved description of the task
// =============================================================================

/**
 * Build a task suggestion prompt.
 *
 * @param {object}   params
 * @param {string}   params.title           Task title (required)
 * @param {string}   [params.description]   Current task description (optional)
 * @param {Array<{title: string, status: string}>} [params.existingTasks]
 *   Sibling tasks already in the project — gives the model context about scope
 * @returns {string}
 */
export function suggestPrompt({ title, description, existingTasks = [] }) {
  const taskContext =
    existingTasks.length > 0
      ? `\nExisting tasks in this project:\n${existingTasks
          .map((t) => `- ${t.title} (${t.status})`)
          .join('\n')}`
      : '';

  return `You are a project management AI. Analyze this new task and provide actionable suggestions.

Task title: ${title}
Task description: ${description || 'No description provided'}
${taskContext}

Return ONLY a JSON object with this exact schema (no markdown, no explanation):
{
  "deadline": "ISO 8601 datetime string (e.g. 2026-05-01T00:00:00Z) — realistic deadline based on task complexity and any existing tasks",
  "dependencies": ["array of task titles or resource names this task likely depends on — empty array if none"],
  "draft_description": "An improved, detailed task description (2-3 sentences, professional tone, action-oriented)"
}`;
}
