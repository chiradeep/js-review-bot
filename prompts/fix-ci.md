# Fix CI

Diagnose the failed CI context and make the smallest safe changes needed to fix the pull request branch. Preserve the author's intent, avoid unrelated refactors, and run targeted verification when possible.

Use the collected CI logs as the source of truth for dependency setup and failures. Run local verification only when the required dependencies and tools are already available in the workspace. Do not run package-manager install commands such as `npm install`, `npm ci`, `pip install`, `bundle install`, or `terraform init`; the Codex sandbox may not have reliable network access, and the pushed commit will be verified by the repository's GitHub Actions checks.

If the CI failure cannot be fixed from the repository context, explain the blocker in the structured result and avoid speculative edits.
