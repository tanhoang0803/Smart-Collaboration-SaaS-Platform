Safely push the current branch to GitHub for the Smart Collaboration SaaS Platform.

Pre-push checklist — execute each step and abort if any fail:

1. **Confirm identity**: run `git config user.name` and `git config user.email`.
   - Must be: TanQHoang / hoangquoctan.1996@gmail.com
   - If different, STOP and alert the user before proceeding.

2. **Check for secrets**: scan staged and committed (unpushed) changes.
   - Run: `git diff origin/main..HEAD`
   - Search for patterns: `API_KEY=`, `SECRET=`, `PASSWORD=`, `PRIVATE_KEY=`, `Bearer ey`
   - If any found: STOP, list the exact lines, ask user to remove before pushing.

3. **Verify branch**: run `git status` and `git log origin/main..HEAD --oneline`
   - Show the user which commits will be pushed.
   - Confirm the target branch is NOT a force-push scenario.

4. **Run tests** (if package.json present in changed service): `npm test`
   - Abort if tests fail.

5. **Push**: `git push -u origin <current-branch>`
   - Never use `--force` or `--force-with-lease` unless the user explicitly typed those words.

6. **Confirm**: show the GitHub URL of the pushed branch.
