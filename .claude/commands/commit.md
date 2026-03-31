Prepare and execute a Conventional Commit for the current staged changes in the Smart Collaboration SaaS Platform.

Steps:
1. Run `git diff --cached` to see all staged changes.
2. Run `git status` to confirm what is staged.
3. Determine the correct commit type from the changes:
   - `feat` — new feature or capability
   - `fix` — bug fix
   - `docs` — documentation only
   - `test` — adding or updating tests
   - `refactor` — code restructure without behaviour change
   - `chore` — tooling, deps, config
   - `ci` — GitHub Actions / CI changes
   - `perf` — performance improvement
4. Determine the scope from the service/area changed (e.g. `auth`, `tasks`, `ai`, `frontend`, `infra`, `db`).
5. Draft a commit message:
   - Format: `type(scope): imperative short description`
   - Subject line max 72 chars
   - Add body if the change needs context (what & why, not how)
   - Add `BREAKING CHANGE:` footer if applicable
6. Show the draft commit message to the user and ask for confirmation before committing.
7. After confirmation, run: `git commit -m "..."`
8. Never use `--no-verify`. Never amend a previously pushed commit.
