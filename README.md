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

## Codex Agent Runner (Advanced/operator Local Runner)

The project includes a Codex-first local runner for generating lesson artifacts. The runner is gate-driven: `run` and `resume` may first write non-gated artifacts such as `source-ingest`, then later return either `artifact_written` with `createsGate` or `approval_required` for reviewable gates.

For Codex natural-language operation, first turn the request into a reviewable run plan:

```bash
npm run agent:plan -- \
  --request "用 /path/to/source.pdf 这本书生成一套中文课程：先做总览课，再按核心 topic 拆课。每个单元 10 页，面向有基础编程经验但没建立系统心智模型的中文学习者。" \
  --run agentic-design-plan
```

This writes `runs/<run-id>/run.plan.json` with inferred source type, source kind, strategy, planning mode, page count per unit, language, adapter, and review items. After inspection, initialize the run from the reviewed plan:

```bash
npm run agent:init-from-plan -- --run agentic-design-plan --approve true
```

`--approve true` is a local shortcut for an operator-reviewed plan. For stricter operation, edit `run.plan.json` to set `"status": "approved"` before running `agent:init-from-plan` without the shortcut.

Use the beta operator status command whenever Codex, Claude, or a human operator needs a compact view of where the run is blocked and what to do next:

```bash
npm run agent:beta-status -- --run agentic-design-plan
```

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN
npm run agent:run -- --run hash-table-001
npm run agent:resume -- --run hash-table-001
```

For source-backed runs, initialize with a file, folder, URL, or pasted text. The default strategy is **overview + topic-guided units**: first create an overview learning unit, then split core topics while preserving chapter/section/source anchors.

```bash
npm run agent:init -- \
  --source-file "/path/to/source.pdf" \
  --source-kind book \
  --source-title "Agentic Design Patterns" \
  --unit-pages 12 \
  --strategy overview_plus_topic \
  --adapter codex \
  --run agentic-design-book
```

`--unit-pages` and the legacy `--pages` flag mean pages per learning unit, not total pages for an entire book, paper, patent, or blog series.

PDF sources are normalized into page and paragraph anchors when local `python3` can import `pypdf`. If text extraction is unavailable, the runtime emits an explicit `pdf-text-extraction-unavailable` warning and creates a page-level placeholder anchor instead of pretending the source was fully read.

After `curriculum-plan` is approved, inspect or select generated learning units:

```bash
npm run agent:units -- --run agentic-design-book
npm run agent:select-unit -- --run agentic-design-book --unit unit-overview
npm run agent:run -- --run agentic-design-book
```

`agent:units` and `agent:course` return source mapping summaries (`sourceAnchorCount`, `sourceAnchorSample`, `sourceNodeCount`, `sourceNodeSample`) so Codex and MCP clients do not have to render thousands of anchor ids. The full source mapping remains in `runs/<run-id>/artifacts/curriculum-plan.approved.json` and can be read with `learning_agent.read_artifact` when an operator needs to audit coverage.

For batch work, spawn one child run per unit. The child runs reuse the approved source-map, concept-map, and curriculum-plan, then continue from unit-level learning design:

```bash
npm run agent:course -- --run agentic-design-book --all true
npm run agent:spawn-units -- --run agentic-design-book --all true
npm run agent:run-units -- --run agentic-design-book --all true
npm run agent:promote-units -- --run agentic-design-book --all true
npm run agent:run -- --run agentic-design-book-unit-overview
```

`agent:course` is the high-level Codex-facing command. It ensures selected unit child runs exist, advances them to the next manual/approval boundary, and returns next actions. Lower-level commands remain available when you need precise control.

`agent:run-units` advances each child run until it reaches a manual role request, an approval gate, completion, or the configured step limit. Use `--unit <unit-id>` instead of `--all true` to advance only one unit.

After each child run has an approved `lesson`, `agent:promote-units` promotes those lessons and writes a frontend-discoverable course pack manifest under `src/course-packs/<run-id>/coursePack.ts`.

`agent:beta-status` summarizes parent artifacts, approved gates, current review gates, child unit runs, and suggested next actions without returning the full source anchor payload. It also returns `operatorHints.reviewQueue` and `operatorHints.nextToolCalls`, so natural-language operators can call the next MCP tool without parsing free-form text.

For real source smoke tests, keep promoted lessons from copyrighted books or private documents out of commits unless they are intentionally publishable examples. The durable verification evidence can remain in ignored `runs/<run-id>/` artifacts.

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

The runner stores durable state under `runs/<run-id>/`. The MCP-ready tool handler uses the same runtime core instead of duplicating orchestration logic.

## MCP-Ready Tool Handler

The repository includes a local stdio MCP entrypoint:

```bash
npm run mcp -- --list-tools
```

Default learner-facing tools:

- `learning_agent.create_learning_project`
- `learning_agent.publish_learning_course`
- `learning_agent.get_learning_preview`
- `learning_agent.generate_quick_preview`
- `learning_agent.revise_learning_course`

Advanced/operator tools include:

- `learning_agent.init_run`
- `learning_agent.plan_run`
- `learning_agent.init_from_plan`
- `learning_agent.status`
- `learning_agent.beta_status`
- `learning_agent.run_until_gate`
- `learning_agent.list_artifacts`
- `learning_agent.read_artifact`
- `learning_agent.run_next`
- `learning_agent.submit_artifact`
- `learning_agent.approve_gate`
- `learning_agent.run_course`
- `learning_agent.promote_units`
- `learning_agent.promote_lesson`

The current entrypoint accepts newline-delimited JSON-RPC requests on stdin and returns MCP-compatible JSON-RPC responses. It is intentionally thin; tool calls wrap `RunPlanService`, `RunStore`, `AgentWorkflow`, `CoursePackService`, `ManualSubmissionService`, `ApprovalService`, and `LessonPromotionService`.

Default Codex usage should be learner-first. Codex clarifies the learning request, generates a Chinese `coursePack` and `lessons`, calls `learning_agent.publish_learning_course`, then tells the user to run `npm run dev` and open the local page. Do not ask learners to approve `source-map`, `concept-map`, or `curriculum-plan`.

Default trial prompt:

```text
请使用 learningAgent MCP 服务帮我生成中文学习网页。
资料是：/absolute/path/to/source.pdf
我希望先有总览课，再按核心 topic 拆课。每个单元 8 页。
请先问我最多 3 个你必须知道的问题。明确后，不要让我审批 source-map、concept-map、curriculum-plan 这些内部 artifacts。
你可以直接生成 course bundle，然后调用 learning_agent.publish_learning_course 发布网页。
发布后告诉我运行 npm run dev，并说明我应该打开哪个页面查看。
```

Manual learner-first smoke:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"learning_agent.create_learning_project","arguments":{"request":"请生成哈希表中文学习材料，面向有编程基础的学习者，每个单元 8 页。","runId":"hash-table-nl"}}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"hash-table-nl"}}}' \
  | npm run mcp
```

Quick local preview can use `learning_agent.generate_quick_preview` after `learning_agent.create_learning_project`. It is deterministic smoke for seeing the product shape; final content should normally use Codex-authored `publish_learning_course`.

Learner feedback should use `learning_agent.revise_learning_course`. Codex records the feedback as a revision brief, revises the Chinese `coursePack` and `lessons`, preserves source anchors for source-backed projects, and calls `learning_agent.publish_learning_course` again.

For book, paper, patent, blog, documentation, or notes-backed projects, direct publish now checks source grounding. Lessons must include `sourceContext.sourceAnchorIds` or page-level source anchors unless a page is explicitly marked as inferred or analogy.

Only when the user explicitly asks for "专家审查模式 / 查看内部 artifacts / 调试生成流程" should Codex use advanced/operator tools such as `plan_run`, `read_artifact`, `approve_gate`, and `run_course`.

The advanced/operator interaction pattern is:

1. User describes the source and learning goal in natural language.
2. Codex calls `learning_agent.plan_run`, then summarizes `reviewItems` before initialization.
3. Codex calls `learning_agent.init_from_plan` only after operator approval.
4. Codex calls `learning_agent.beta_status` to inspect current gate state and suggested next actions.
5. Codex alternates `learning_agent.run_until_gate` / `learning_agent.read_artifact` / `learning_agent.approve_gate` through `source-map`, `concept-map`, and `curriculum-plan`.
6. Codex calls `learning_agent.run_course`, uses `learning_agent.beta_status` to review summarized child-run state, and approves or revises each child gate.
7. Codex calls `learning_agent.promote_units` only after approved child lessons and critic reports.

Client setup examples live in `docs/runtime/mcp-client-setup.md`.
The beta-level operator loop is documented in `docs/runtime/beta-operator-loop.md`.

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
# read runs/hash-table-claude/manual-requests/source-map.md
npm run agent:submit -- --run hash-table-claude --artifact source-map --file <json-file>
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
- Course-pack view supports multiple learning product forms: Web Deck, 知识地图, 练习, 教师, 实验, and 导师

## Extend With A New Lesson

Promoted lessons under `src/lessons/<lesson-id>/lesson.ts` are auto-discovered by `src/lessons/registry.ts` and appear in the frontend lesson selector.

1. Create or promote a structured lesson object under `src/lessons/<lesson-id>/lesson.ts`.
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
