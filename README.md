	# js-review-bot

Reusable Jetstream PR review bot powered by `openai/codex-action`.

The bot is designed to run across Jetstream repositories through a shared reusable workflow. Each target repo adds a small caller workflow and can optionally customize behavior with `.github/js-review.toml`, `.github/js-review/prompts/*.md`, and repo `AGENTS.md` files.

## What It Does

- Automatically reviews trusted same-repo PRs.
- Responds to `@js-review-bot review`, `@js-review-bot security-review`, `@js-review-bot adversarial-review`, and `@js-review-bot fix-ci`.
- Skips fork PRs and untrusted contributors before Codex runs.
- Posts valid findings as inline PR review comments.
- Allows `fix-ci` to edit, commit, and push to the PR branch.
- Uses repo-local config and base-branch `AGENTS.md` guidance.

## GitHub App

Create a GitHub App named `js-review-bot` and install it on the Jetstream repos that should use the bot.

Required repository permissions:

- Contents: read and write
- Pull requests: read and write
- Issues: read and write
- Checks: read
- Actions: read
- Metadata: read

Webhook delivery is not required for v1 because GitHub Actions events trigger the workflow. The App is used for least-privilege installation tokens and for comments that appear as `js-review-bot[bot]`.

Add these as organization secrets available to the Jetstream repos that use the bot:

- `OPENAI_API_KEY`
- `JS_REVIEW_BOT_APP_ID`
- `JS_REVIEW_BOT_PRIVATE_KEY`

The GitHub App provides the bot identity and installation permissions, but GitHub Actions still needs the App private key to mint short-lived installation tokens. The App cannot directly expose that key or the OpenAI key to workflow runs.

## Target Repo Setup

Add this workflow to each repo as `.github/workflows/js-review.yml`:

```yaml
name: JS Review Bot

on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

jobs:
  js-review:
    uses: JetStreamSecurity/js-review-bot/.github/workflows/js-review.yml@main
    with:
      bot_mention: "@js-review-bot"
      default_model: "gpt-5.5"
      default_effort: "medium"
      auto_review_enabled: true
    secrets:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      JS_REVIEW_BOT_APP_ID: ${{ secrets.JS_REVIEW_BOT_APP_ID }}
      JS_REVIEW_BOT_PRIVATE_KEY: ${{ secrets.JS_REVIEW_BOT_PRIVATE_KEY }}
```

See `examples/js-review.toml` for optional per-repo customization.

## Config

`.github/js-review.toml` supports a conservative subset of TOML:

```toml
model = "gpt-5.5"
effort = "medium"
clean_review_comment = false

[paths]
include = ["backend/**", "frontend/**"]
exclude = ["**/*.lock", "**/dist/**"]

[commands.review]
enabled = true
prompt = ".github/js-review/prompts/review.md"

[commands.security-review]
enabled = true
skills = ["security-best-practices"]

[commands.adversarial-review]
enabled = true

[commands.fix-ci]
enabled = true
push = true

[skills]
enabled = ["security-best-practices"]

[plugins]
enabled = ["codex-security"]
```

Prompt files are addenda. They cannot replace the central safety and output-format instructions.

## Security Model

- The gate job uses only the default GitHub token and read permissions.
- The GitHub App token and `OPENAI_API_KEY` are only used after the trust gate passes.
- Fork PRs are skipped.
- Actors must have `write`, `maintain`, or `admin` permission.
- Review commands use Codex `sandbox: read-only`.
- `fix-ci` uses Codex `sandbox: workspace-write` and only pushes after the deterministic commit step finds changes.
- Public skills/plugins are allowlisted centrally; repo config cannot request arbitrary URLs.

## Development

```bash
npm test
npm run check
```
