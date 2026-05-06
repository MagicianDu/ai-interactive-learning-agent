# AI Interactive Learning Agent

[![CI](https://github.com/MagicianDu/ai-interactive-learning-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/MagicianDu/ai-interactive-learning-agent/actions/workflows/ci.yml)

AI Interactive Learning Agent turns technical sources into visual, interactive,
feedback-rich learning experiences.

The goal is not to convert books into web pages. The goal is to reconstruct
knowledge into lessons that help learners build durable mental models through
visual structure, learner action, feedback, misconception checks, and transfer
tasks.

The current product form is a React/Vite Web Deck. The long-term product shape
is an AI-native learning system that combines:

- MCP tools for stable local capabilities such as source intake, course
  creation, publishing, preview, feedback revision, and export.
- Skills for Codex, Claude, OpenClaw-style clients, and future agent runtimes
  to operate those tools through natural language.
- Structured lesson and course-pack data that can later power canvas maps,
  playgrounds, tutor mode, teacher mode, and assessment mode.

Generated learner-facing content is Chinese-first by default.

## Status

This repository is in OSS alpha.

What works today:

- React/Vite learning workspace with side navigation, web-deck lessons, course
  packs, knowledge-map view, and project-library view.
- Structured lesson and course-pack registries.
- Local MCP server with learner-facing tools and advanced operator tools.
- Source-backed quick draft flow using public mock fixtures.
- Feedback revision and static-course export paths.
- Stable CI gate and slower source-regression gate.

What is intentionally still evolving:

- Production-grade source parsing for every document type.
- High-quality AI-authored content generation across full books, papers,
  patents, blogs, and documentation sets.
- Hosted multi-user service, accounts, sharing, telemetry, and billing.
- Rich playground/tutor/teacher modes.

## Quickstart

Requirements:

- Node.js 22 or newer
- npm

Install and start the local app:

```bash
npm ci
npm run dev
```

Open the Vite URL printed by the dev server, usually:

```text
http://localhost:5173/
```

The default app opens a public mock course pack:

```text
智能体工作流公开示例：课程包
```

## Verification

Run the stable open-source gate:

```bash
npm run test:ci
```

This runs:

- TypeScript typecheck
- ESLint
- Stable unit/component tests
- Production build
- MCP/skills bundle check

Run the slower source-regression gate when changing source ingestion, grounding,
planning, or MCP learner flows:

```bash
npm run test:regression
npm run seed:check
```

For local MCP installation checks:

```bash
npm run bundle:check
npm run codex:mcp:check
```

Before a public beta checkpoint, run the full local release gate:

```bash
npx playwright install chromium # first time on a machine
npm run release:check
```

`release:check` runs the stable CI gate, source regression, seed/MCP checks,
Codex MCP config check, and a Playwright smoke that verifies the default sample
course, a generated `#/preview/<run-id>` route, and next-page navigation.

## Public Fixtures

Open-source demos should use public mock sources under:

```text
examples/sources/
```

Current fixtures:

- `examples/sources/agent-workflow-notes.md`
- `examples/sources/talker-reasoner-architecture.md`

Do not commit private books, papers, patents, blogs, notes, generated private
lessons, or local machine paths. Runtime artifacts belong under ignored
`runs/`.

## MCP Server

List available MCP tools:

```bash
npm run mcp -- --list-tools
```

Run a learner-first smoke flow against the public mock source:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"public-mock-smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"learning_agent.create_learning_project","arguments":{"request":"请把这份资料生成中文学习网页，先给总览课，再按核心 topic 拆课，每个单元 8 页，面向有编程基础的中文学习者。","runId":"public-mock-smoke","sourcePath":"examples/sources/agent-workflow-notes.md","sourceKind":"book","audience":"有编程基础但缺少系统心智模型的中文学习者","unitPages":8,"strategy":"overview_plus_topic"}}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"learning_agent.generate_grounded_course","arguments":{"runId":"public-mock-smoke"}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"public-mock-smoke"}}}' \
  | npm run mcp
```

After generating and publishing a course, run the app and open:

```text
http://127.0.0.1:5173/#/preview/public-mock-smoke
```

Learner-facing tools:

- `learning_agent.create_learning_project`
- `learning_agent.list_learning_projects`
- `learning_agent.archive_learning_project`
- `learning_agent.get_authoring_context`
- `learning_agent.generate_grounded_course`
- `learning_agent.publish_learning_course`
- `learning_agent.get_learning_preview`
- `learning_agent.generate_quick_preview`
- `learning_agent.revise_learning_course`
- `learning_agent.apply_learning_revision`
- `learning_agent.export_learning_course`

Advanced operator tools are still available for explicit expert review flows,
including `plan_run`, `init_from_plan`, `beta_status`, `read_artifact`,
`approve_gate`, `run_course`, and `promote_units`.

Default learner-facing clients should not ask users to approve internal
`source-map`, `concept-map`, or `curriculum-plan` artifacts. Use those gates only
when the user explicitly asks for expert/operator mode.

## Try With Codex

Install the local MCP config and skills bundle for Codex:

```bash
npm run codex:bundle:install
npm run bundle:check
npm run codex:mcp:check
```

The relevant local skills live under `skills/`:

- `learning-agent-operator`
- `source-to-course`
- `learner-feedback-revision`
- `learning-agent-runner`

Copyable trial prompts are in:

```text
docs/runtime/codex-user-trial-script.md
```

The intended natural-language flow is:

1. Clarify the learning goal and source constraints in a few questions.
2. Call `learning_agent.create_learning_project`.
3. Call `learning_agent.get_authoring_context`.
4. Let Codex or another capable agent author the Chinese course pack and
   lessons.
5. Call `learning_agent.publish_learning_course`.
6. Call `learning_agent.get_learning_preview`.
7. Use `revise_learning_course` and `apply_learning_revision` for learner
   feedback.
8. Use `export_learning_course` for a shareable static artifact.

Default learner-facing answers should return the preview URL and compact
`qualityReport` summary. They should not ask learners to approve internal
`source-map`, `concept-map`, or `curriculum-plan` artifacts.

## Project Structure

```text
src/
  components/          Reusable deck, visual, interaction, assessment, course UI
  course-packs/        Course-pack registry and public examples
  lessons/             Lesson registry and public examples
  product/             Learning workspace shell and routing
  renderers/           Web deck, canvas map, and product renderers
  schemas/             Structured lesson and course-pack types
tools/
  agent-runtime/       Local generation runtime and CLI
  mcp-server/          stdio MCP entrypoint
skills/                Agent operating skills
docs/                  Runtime, product, and planning documentation
examples/sources/      Public mock source fixtures
```

## Core Scripts

```bash
npm run dev                 # start the local app
npm run build               # typecheck and build the app
npm run typecheck           # TypeScript only
npm run lint                # ESLint
npm run test                # stable unit/component tests
npm run test:ci             # full stable OSS gate
npm run test:regression     # slower source/MCP regression gate
npm run mcp -- --list-tools # inspect MCP tools
```

## Contributing

See `CONTRIBUTING.md`.

Before opening a pull request:

```bash
npm run test:ci
```

When touching source-grounding or MCP flows, also run:

```bash
npm run test:regression
```

Before a public beta release candidate, run:

```bash
npx playwright install chromium
npm run release:check
```

## License

MIT. See `LICENSE`.
