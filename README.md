# AI Interactive Learning Agent

AI Interactive Learning Agent turns technical topics and source material into visual, interactive, feedback-rich learning experiences that help learners build transferable mental models.

This repository now contains a runnable React/Vite Web Deck MVP, not only a scaffold. The first product form is a PPT-like interactive web lesson with structured lesson data, reusable deck/visual/interaction/assessment components, and local verification scripts.

## Language Direction

The default learning output is **Chinese-first**. Generated lessons, page titles, learner actions, feedback, quizzes, misconception checks, transfer tasks, and primary UI labels should be written in Chinese unless a lesson explicitly targets another language.

Technical terms such as SQL, B+ tree, index, key, and WHERE may remain in English when that is the standard term learners must recognize, but explanations should still be Chinese and should define the term in context.

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL printed by the dev server, usually `http://localhost:5173/`.

## Codex Agent Runner

The project includes a Codex-first local runner for generating lesson artifacts. The runner is gate-driven: `run` and `resume` may first write non-gated artifacts such as `source-ingest`, then later return either `artifact_written` with `createsGate` or `approval_required` for reviewable gates.

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN
npm run agent:run -- --run hash-table-001
npm run agent:resume -- --run hash-table-001
```

Repeat `npm run agent:run -- --run <run-id>` or `npm run agent:resume -- --run <run-id>` until the runtime writes a gated artifact or returns `approval_required`. Inspect the artifact under `runs/<run-id>/artifacts/`, then approve or revise using the exact `<version>` returned by the runtime:

```bash
npm run agent:approve -- --run hash-table-001 --gate learning-architecture --version <version>
npm run agent:revise -- --run hash-table-001 --gate learning-architecture --version <version> --notes "调整页面顺序和迁移任务"
```

Continue the same loop until the `lesson` gate is reached. Inspect and approve the lesson artifact before promotion:

```bash
npm run agent:approve -- --run hash-table-001 --gate lesson --version <version>
npm run agent:promote -- --run hash-table-001
```

The runner stores durable state under `runs/<run-id>/` and is designed so a future MCP server can reuse the same runtime core.

To use an operator session (Codex, Claude, or future OpenClaw) as the content generator, initialize with one of:

- `--adapter codex`
- `--adapter claude`
- `--adapter openclaw`
- `--adapter codex-manual` (legacy alias)

In this mode `run` creates a role prompt under `runs/<run-id>/manual-requests/` and pauses. The model/provider session should answer the prompt by writing a JSON file, then submit it back into the versioned artifact store:

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN --adapter codex --run hash-table-codex
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN --adapter claude --run hash-table-claude
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN --adapter openclaw --run hash-table-openclaw
npm run agent:run -- --run hash-table-claude
# read runs/hash-table-claude/manual-requests/source-ingest.md
npm run agent:submit -- --run hash-table-claude --artifact source-ingest --file <json-file>
```

After submission, continue with the same `run` / inspect / approve / revise loop. `codex-manual` does not call an external model API; it gives Codex a durable prompt and keeps artifact state on disk.

## Verify

Run the full local check set before publishing or extending a lesson:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Current Lesson

The first sample lesson is **数据库索引为什么更快**.

- Source: `src/lessons/database-index/lesson.ts`
- Default lesson size: 10 pages
- The renderer and schema support variable page counts using `lesson.config.targetPageCount` and `lesson.pages.length`
- The lesson includes visual explanations, query-path interaction, index-tradeoff interaction, quizzes, misconception checks, transfer work, and a summary card

## Extend With A New Lesson

1. Create a structured lesson object under `src/lessons/<lesson-id>/lesson.ts`.
2. Set `config.targetPageCount`, `config.minPageCount`, and `config.maxPageCount`.
3. Add pages using the types in `src/schemas/lesson.schema.ts`.
4. Reuse deck, visual, interaction, and assessment components from `src/components/`.
5. Run the lesson against `docs/quality-rubric.md` before publishing.

## Runtime Contracts

System-level runtime contracts for the multi-agent, multi-model, cross-runtime architecture live in `docs/runtime/`:

- `agent-role-contracts.md`
- `artifact-contracts.md`
- `run-config.schema.md`
- `runtime-adapters.md`

## Repository Layout

```text
docs/                 Product, learning design, quality, and runtime docs
examples/             Lesson design artifacts and sample outputs
skills/               Agent skills for the generation workflow
src/                  React/Vite Web Deck MVP source
```
