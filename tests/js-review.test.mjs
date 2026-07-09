import assert from "node:assert/strict";
import test from "node:test";

import {
  OUTPUT_SCHEMA,
  matchesAnyGlob,
  parseMentionCommand,
  parseToml,
  parseUnifiedDiff,
  priorityLabelForSeverity,
  reviewCommentBody,
  summaryBody,
} from "../scripts/js-review.mjs";

test("parseMentionCommand extracts supported commands", () => {
  assert.deepEqual(parseMentionCommand("@js-review-bot fix-ci"), {
    mentioned: true,
    command: "fix-ci",
    rawCommand: "fix-ci",
  });
  assert.deepEqual(parseMentionCommand("please @js-review-bot security-review now"), {
    mentioned: true,
    command: "security-review",
    rawCommand: "security-review",
  });
});

test("parseMentionCommand defaults bare mention to review", () => {
  assert.deepEqual(parseMentionCommand("@js-review-bot"), {
    mentioned: true,
    command: "review",
    rawCommand: "review",
  });
});

test("parseMentionCommand reports unsupported commands", () => {
  assert.deepEqual(parseMentionCommand("@js-review-bot explain"), {
    mentioned: true,
    command: "",
    rawCommand: "explain",
  });
});

test("parseToml handles simple nested config", () => {
  const config = parseToml(`
model = "gpt-5.5"
clean_review_comment = false

[paths]
include = ["backend/**", "frontend/**"]

[commands.fix-ci]
enabled = true
push = true
`);
  assert.equal(config.model, "gpt-5.5");
  assert.equal(config.clean_review_comment, false);
  assert.deepEqual(config.paths.include, ["backend/**", "frontend/**"]);
  assert.equal(config.commands["fix-ci"].push, true);
});

test("parseToml handles multiline arrays", () => {
  const config = parseToml(`
[paths]
include = [
  "api/**",
  "web/**", # comment after item
  "package.json",
]
exclude = [
  "**/node_modules/**",
  "**/dist/**"
]
`);
  assert.deepEqual(config.paths.include, ["api/**", "web/**", "package.json"]);
  assert.deepEqual(config.paths.exclude, ["**/node_modules/**", "**/dist/**"]);
});

test("output schema requires every finding property", () => {
  const findingSchema = OUTPUT_SCHEMA.properties.findings.items;
  assert.deepEqual(
    new Set(findingSchema.required),
    new Set(Object.keys(findingSchema.properties)),
  );
  assert.equal(findingSchema.properties.start_line.type.includes("null"), true);
});

test("glob matching supports double-star paths", () => {
  assert.equal(matchesAnyGlob("backend/app/main.py", ["backend/**"]), true);
  assert.equal(matchesAnyGlob("frontend/package-lock.json", ["**/*.lock"]), false);
  assert.equal(matchesAnyGlob("frontend/dist/app.js", ["**/dist/**"]), true);
});

test("parseUnifiedDiff indexes changed right and left lines", () => {
  const diff = `diff --git a/app.js b/app.js
--- a/app.js
+++ b/app.js
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 const d = 5;
`;
  const index = parseUnifiedDiff(diff);
  assert.equal(index.right.get("app.js").has(2), true);
  assert.equal(index.right.get("app.js").has(3), true);
  assert.equal(index.left.get("app.js").has(2), true);
  assert.equal(index.right.get("app.js").has(4), false);
});

test("parseUnifiedDiff preserves deleted file path for left-side findings", () => {
  const diff = `diff --git a/old.js b/old.js
deleted file mode 100644
--- a/old.js
+++ /dev/null
@@ -1,2 +0,0 @@
-const removed = true;
-export default removed;
`;
  const index = parseUnifiedDiff(diff);
  assert.equal(index.left.get("old.js").has(1), true);
  assert.equal(index.left.get("old.js").has(2), true);
});

test("priorityLabelForSeverity maps severities to review priorities", () => {
  assert.equal(priorityLabelForSeverity("critical"), "P1");
  assert.equal(priorityLabelForSeverity("high"), "P2");
  assert.equal(priorityLabelForSeverity("medium"), "P3");
  assert.equal(priorityLabelForSeverity("low"), "P4");
  assert.equal(priorityLabelForSeverity("info"), "P5");
  assert.equal(priorityLabelForSeverity("unexpected"), "P3");
});

test("reviewCommentBody includes priority, metadata, and feedback prompt", () => {
  const body = reviewCommentBody(
    {
      severity: "critical",
      title: "Avoid deleting valid grants",
      body: "Re-read the stored token before deleting this grant.",
      confidence: "high",
    },
    "js-review-bot:finding:abc123",
  );

  assert.match(body, /<!-- js-review-bot:finding:abc123 -->/);
  assert.match(body, /\*\*P1 Avoid deleting valid grants\*\*/);
  assert.match(body, /Re-read the stored token before deleting this grant\./);
  assert.match(body, /Severity: critical; confidence: high/);
  assert.match(body, /Useful\? React with GitHub's thumbs-up or thumbs-down reactions\./);
});

test("summaryBody includes reviewed commit, command help, and run metadata", () => {
  const body = summaryBody(
    {
      command: "security-review",
      head_sha: "b2375c4108abcdef",
      model: "gpt-5.5",
      effort: "medium",
      extensions: {
        skills: ["security-best-practices"],
        plugins: ["codex-security"],
      },
    },
    { summary: "Found one issue." },
    [],
    1,
  );

  assert.match(body, /## JS Security Review/);
  assert.match(body, /\*\*Reviewed commit:\*\* `b2375c4108`/);
  assert.match(body, /<summary>About js-review-bot in GitHub<\/summary>/);
  assert.match(body, /`@js-review-bot fix-ci`/);
  assert.match(body, /Model: `gpt-5\.5`/);
  assert.match(body, /Skills: `security-best-practices`/);
  assert.match(body, /Plugins: `codex-security`/);
  assert.match(body, /Inline comments posted: 1/);
});
