Run a full security review of recently changed or specified code in the Smart Collaboration SaaS Platform.

Steps:
1. If the user named specific files, read those files.
   Otherwise, run `git diff HEAD~1` to get recently changed code.
2. Invoke the `security-reviewer` agent with the code to review.
3. Present the findings grouped by severity: CRITICAL → HIGH → MEDIUM → LOW.
4. For each CRITICAL or HIGH issue:
   - Show the exact vulnerable line
   - Show the fixed version inline
   - Ask the user if they want the fix applied immediately
5. For MEDIUM/LOW: present as a numbered list for the user to action later.
6. If no issues: confirm "Security review passed — no issues found."

Never skip this check before a `git push` if the user asks for it.
