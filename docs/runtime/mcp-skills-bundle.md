# MCP And Skills Bundle

This document defines the local product bundle for AI Interactive Learning Agent.

The bundle has two parts:

- MCP server: stable callable tools for creating projects, preparing authoring context, validating/publishing Codex-authored courses, generating deterministic drafts, previewing, revising, exporting, and running expert workflows.
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
skills/learning-agent-runner
```

Use `learning-agent-operator` as the default entry skill for user-facing operation. Use `source-to-course` when turning books, papers, patents, blogs, notes, folders, or topic-only prompts into project inputs. Use `learner-feedback-revision` after the learner has seen a preview and asks for changes.

## Default Learner Flow

Normal users should not review internal artifacts. The default flow is:

```text
learning_agent.create_learning_project
learning_agent.get_authoring_context
learning_agent.publish_learning_course
learning_agent.get_learning_preview
learning_agent.revise_learning_course
learning_agent.apply_learning_revision
learning_agent.export_learning_course
```

Use expert/operator tools only when the user explicitly asks to inspect artifacts, debug generation, or audit source coverage.

Use `learning_agent.generate_grounded_course` only for quick deterministic drafts or smoke previews.

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
