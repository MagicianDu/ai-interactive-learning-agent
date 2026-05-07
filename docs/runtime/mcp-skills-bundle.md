# MCP And Skills Bundle

This document defines the local product bundle for AI Interactive Learning Agent.

The bundle has two parts:

- MCP server: stable callable tools for preparing learner requests, validating/publishing Codex-authored courses, previewing, revising, exporting, and running explicit advanced workflows.
- Skills: operating instructions for Codex, Claude, OpenClaw-style clients, and future agent runtimes so natural-language learner requests follow the right path.

## Codex Install

From the repository root:

```bash
npm install
npm run codex:bundle:install
npm run bundle:check
npm run codex:mcp:check
```

`codex:bundle:install` installs:

- the `learningAgent` MCP server into `~/.codex/config.toml`
- the required skill folders into `~/.codex/skills/`

Restart Codex or open a new Codex session after installation.

## Installed Skills

The Codex skill install copies these folders:

```text
skills/learning-agent-operator
skills/source-to-course
skills/learner-feedback-revision
```

Use `learning-agent-operator` as the default entry skill for user-facing operation. Use `source-to-course` when turning books, papers, patents, blogs, notes, folders, or topic-only prompts into project inputs. Use `learner-feedback-revision` after the learner has seen a preview and asks for changes.

## Current Publish Contract

`learning_agent.publish_learning_course` writes a clean preview plus machine-readable runtime contracts:

```text
runs/<run-id>/artifacts/course-ir.vN.json
runs/<run-id>/artifacts/lesson-bundle.vN.json
runs/<run-id>/artifacts/publish-validation.vN.json
runs/<run-id>/quality/course-quality-report.json
```

Normal MCP responses should remain learner-facing. Summarize `qualityReport.status`, score, checks, `issueSummary`, and the first few `topIssues`; do not ask learners to approve the internal artifacts.

Advanced authoring profile can expose `learning_agent.compare_authoring_quality`, which writes:

```text
runs/<authored-run-id>/quality/authoring-quality-comparison.json
```

Use it only when a deterministic draft run exists and Codex has published a higher-quality authored run. Summarize the concrete improvements, remaining gaps, and `revisionInstructions`; do not present the draft as the product-quality default.

`learning_agent.create_quality_revision` converts those comparison `revisionInstructions` into:

```text
runs/<authored-run-id>/learning-revisions/revision-<n>.json
```

Use it when `compare_authoring_quality.remainingGaps` is non-empty. Codex should then revise `coursePack` and `lessons`, call `publish_learning_course` again, and rerun `compare_authoring_quality`.

`learning_agent.export_learning_course` refuses to export when the quality report is `failed` unless a maintainer explicitly passes `expertOverrideReason`.

## Default Learner Flow

Normal users should not review internal artifacts. The default learner profile is:

Before `prepare_learning_course`, confirm learner-visible requirements: source scope, audience, teaching difficulty level, course organization, and pages per unit. Teaching difficulty should be one of 入门衔接, 本科核心课程, 大学高年级/研究生课程, or 研究论文精读/前沿讨论 unless the user gives a custom equivalent. Missing teaching difficulty or pages per unit should return a learner-facing clarification instead of silently defaulting.

```text
learning_agent.prepare_learning_course
learning_agent.publish_learning_course
learning_agent.get_learning_preview
learning_agent.revise_learning_course
learning_agent.apply_learning_revision
learning_agent.export_learning_course
```

Advanced authoring profile adds source-context and quality-delta tools: `create_learning_project`, `get_authoring_context`, `compare_authoring_quality`, `create_quality_revision`, and `generate_grounded_course`.

Operator profile adds artifact gates, debug tools, child-run orchestration, and promotion tools. Use it only when the user explicitly asks to inspect artifacts, debug generation, or audit source coverage.

Use `learning_agent.generate_grounded_course` only in advanced authoring mode for quick deterministic drafts or smoke previews. If you generate such a draft and later publish Codex-authored content under another run, call `learning_agent.compare_authoring_quality` to make the quality delta explicit.

## Upgrade

After pulling a newer repository version:

```bash
npm install
npm run codex:bundle:install
npm run bundle:check
npm run seed:check
```

The skill installer overwrites only this bundle's skill folders under `~/.codex/skills/`. It does not modify unrelated skills.

## Claude And Generic MCP Clients

For Claude Desktop or a generic MCP client, configure the same stdio server:

```json
{
  "mcpServers": {
    "learning-agent": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/ai-interactive-learning-agent"
    }
  }
}
```

Clients that support skills should import or mirror the same skill folders listed above. Clients that do not support skills should follow the default learner flow in this document.

## Checks

Use:

```bash
npm run bundle:check
npm run seed:check
```

`bundle:check` verifies package scripts, required skill files, and bundle docs. `seed:check` verifies product tests, typecheck, build, MCP tool list, and source regression.
