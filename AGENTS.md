# Debt Table 313 — Agent Instructions

## Auto-commit and push after every successful task

After completing any modification or new work successfully, automatically publish it to GitHub without asking the user:

1. Verify the change first (syntax checks, JSON validation, or tests where applicable).
2. Run:

   ```bash
   git add -A
   git commit -m 'تحديث بعد إتمام المهمة'
   git push origin main
   ```

3. Do this automatically as soon as the task is complete.
4. Use `git add -A` before committing so new files are included; `git commit -am` only covers already-tracked files.
5. If there are no changes, skip the commit and push.
6. Never commit secrets, tokens, credentials, or local-only files.
7. If the push fails, report the failure and do not claim the work is published.

The published branch is `main` (GitHub Pages). The branch `max` does not exist and is not published.
