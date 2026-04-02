// =============================================================================
// Prompt template — PR code review
//
// Provides structured, constructive feedback on a pull request.
// The diff is truncated to 2000 chars to stay within token budgets.
// =============================================================================

/**
 * Build a PR review prompt.
 *
 * @param {object}   params
 * @param {string}   params.prTitle
 * @param {string}   [params.prDescription]
 * @param {string}   [params.diff]             Raw git diff (truncated if large)
 * @param {string[]} [params.changedFiles]      List of file paths changed
 * @returns {string}
 */
export function reviewPrompt({ prTitle, prDescription, diff, changedFiles = [] }) {
  const filesSection =
    changedFiles.length > 0
      ? `\nChanged files (${changedFiles.length}):\n${changedFiles.map((f) => `  - ${f}`).join('\n')}`
      : '';

  const diffSection = diff
    ? `\nDiff (first 2000 characters):\n\`\`\`diff\n${diff.slice(0, 2000)}\n\`\`\``
    : '';

  return `You are an expert code reviewer. Review this pull request and provide constructive, actionable feedback.

PR Title: ${prTitle}
Description: ${prDescription || 'No description provided'}
${filesSection}
${diffSection}

Provide your review in exactly this format:

## Overall Assessment
[2–3 sentences summarising the PR quality, purpose and readiness]

## Potential Issues
[List any bugs, logic errors, or correctness problems. Write "None identified." if clean.]

## Code Quality
[Suggestions for readability, maintainability, naming, structure, DRY principles]

## Security Concerns
[Flag any injection risks, improper auth, secrets in code, unsafe dependencies. Write "None identified." if clean.]

## Recommendation
APPROVE | REQUEST_CHANGES | COMMENT
[One sentence explaining your recommendation]`;
}
