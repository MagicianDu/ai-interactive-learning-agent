---
name: learning-agent-operator
description: Use when operating this repository's AI Interactive Learning Agent from natural language for books, papers, patents, blogs, notes, folders, or topics, especially when creating, previewing, revising, exporting, or running source-backed Chinese learning courses.
---

# Learning Agent Operator

Use this skill when the user asks Codex to generate, preview, revise, export, or continue Chinese interactive learning material from a topic, book, paper, patent, blog, URL, folder, or pasted text in this repository.

## Defaults

- Work from the repository root.
- Output language is `zh-CN` unless the user explicitly requests otherwise; learner-facing content is中文优先.
- Prefer source-backed course packs over single lessons when a file, URL, folder, book, paper, patent, blog, or long pasted text is provided.
- Default course strategy: `overview_plus_topic`.
- `--unit-pages` means pages per learning unit, not total pages for the whole source.
- Learner-facing operation should hide internal artifacts unless the user explicitly asks for expert review.
- Use expert/operator mode only for debugging, auditing, or artifact-level generation.

## Product Contract

- Codex or Claude authors the final `coursePack` and `lessons`; MCP provides preparation, validation, publishing, preview, revision, and export in the default learner profile.
- Keep all learner-facing lesson content中文优先.
- Preserve source grounding with `sourceAnchorIds` at lesson or page level for source-backed courses.
- Follow `docs/runtime/codex-authoring-protocol-v2.md` (Codex Authoring Protocol V2) before writing `coursePack` and `lessons`: every page needs a mental-model move, source synthesis, learner action or check, feedback mechanism, and `cognitivePurpose` when interactive.
- Advanced authoring tools can record Source Graph V2 and Course Planning V2 artifacts for audit and downstream quality checks. These are not learner approvals in the default flow.
- 不要让学习者审批内部 artifacts such as source maps, concept maps, curriculum plans, or critic reports in the default learner flow.

## Natural Language Mapping

Map learner intent into project inputs:

- Book: `sourceKind=book`, `sourceFile=<path>`
- Paper or article PDF: `sourceKind=paper`, `sourceFile=<path>`
- Patent: `sourceKind=patent`, `sourceFile=<path>` or `sourceUrl=<url>`
- Blog or web article: `sourceKind=blog`, `sourceUrl=<url>`
- Local notes or folder: `sourceKind=notes`, `sourceFile=<path>` or `sourceFolder=<path>`
- Topic only: `topic="<topic>"`
- "先总览再按核心 topic": `strategy=overview_plus_topic`
- "按章节": `strategy=chapter_guided`
- "按 topic / 核心概念": `strategy=topic_guided` or `overview_plus_topic`
- "按任务 / 实践": `strategy=task_guided`
- "章节 + topic 混合": `strategy=hybrid`
- Page count like "每章10页" or "每个 topic 12 页": `unitPages=10` or `unitPages=12`

Clarify only learner-visible choices when missing:

- source scope: whole source, selected chapters, selected topics, or a practical task path
- audience: beginner, experienced programmer, practitioner, researcher, or custom description
- teaching difficulty: 入门衔接, 本科核心课程, 大学高年级/研究生课程, or 研究论文精读/前沿讨论
- unit size: pages per unit; do not silently default in the learner-facing flow
- output: preview link, exported course pack, or both

Ask at most three clarification questions. If the learner already gave source, audience, teaching difficulty, strategy, and unit size, do not ask more questions; proceed to MCP.

## Default Learner Workflow

Use this flow for normal Codex/Claude-style natural language operation. It should produce a previewable learning course without asking the learner to approve source maps, concept maps, curriculum plans, or other internal artifacts. Codex should author the course content; MCP should provide context, validate, and publish.

1. Prepare a learner-facing project and authoring context in one call:

```json
{"method":"tools/call","params":{"name":"learning_agent.prepare_learning_course","arguments":{"request":"<Chinese natural-language course request>"}}}
```

If this returns `clarification_required`, ask only those learner-visible questions and call `learning_agent.prepare_learning_course` again.

2. Use Codex Authoring Protocol V2 with the returned `sourceSemantics`, `coursePlan.strategyReason`, `coursePlan.estimatedTotalPages`, `coursePlan.sourceCoveragePlan`, `coursePlan.acceptanceExpectations`, `coursePlan.recommendedUnits[*].expectedInteractions/expectedAssessments/transferExpectation`, and `contentBlueprint.units[*].pageBlueprints` as authoring constraints. For long books, `unitPages` is per unit and `estimatedTotalPages` is the approximate whole-course page budget. Do not paste source graph, course-plan, or content-blueprint artifacts to the learner unless they ask for expert details.

3. Codex authors `coursePack` and `lessons`, then publishes:

```json
{"method":"tools/call","params":{"name":"learning_agent.publish_learning_course","arguments":{"runId":"<run-id>","coursePack":{},"lessons":[]}}}
```

Default publishing writes clean preview JSON under `runs/<run-id>/preview/` and returns a compact `qualityReport`. Do not pass `outputMode=source` unless maintaining repository fixtures.

4. Open a learner-visible preview:

```json
{"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"<run-id>"}}}
```

5. When the learner gives feedback, revise and preview again:

```json
{"method":"tools/call","params":{"name":"learning_agent.revise_learning_course","arguments":{"runId":"<run-id>","feedback":"<learner feedback>"}}}
{"method":"tools/call","params":{"name":"learning_agent.apply_learning_revision","arguments":{"runId":"<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"<run-id>"}}}
```

Use `apply_learning_revision.changedPages` and `qualityAfter`, then confirm `get_learning_preview.preview.revisionHistory` includes the new revision. This is the durable preview-based acceptance point: if the learner refreshes `#/preview/<run-id>`, the sidebar should still show the same learner-readable revision history.

6. Export only after the visible preview matches the learner's request:

```json
{"method":"tools/call","params":{"name":"learning_agent.export_learning_course","arguments":{"runId":"<run-id>"}}}
```

When `qualityReport.status=failed`, do not export in the default learner flow. Revise the affected lesson/page from `topIssues` and call `learning_agent.publish_learning_course` again. `expertOverrideReason` is only for maintainer/debug exports.

## Learner-Facing Response Shape

After publish, preview, revision, or export, respond with only learner-actionable information:

- Preview URL, usually `http://127.0.0.1:5173/#/preview/<run-id>`
- Course shape: unit count, strategy, pages per unit, source kind
- Compact quality summary: `qualityReport.status`, score, major checks, `issueSummary`, and the first few `topIssues`
- Academic depth signal when relevant: `qualityReport.checks.academicDepth` and the missing `depthRubric` moves, summarized in learner-friendly language
- Optional authored-vs-draft comparison only when the user explicitly asks for advanced authoring comparison
- For revisions: latest `revisionHistory` summary, changed page numbers, `qualityAfter.status`, and preview URL
- One suggested next action: open preview, give feedback, revise, or export

Do not paste large source maps, concept maps, curriculum plans, full critic reports, or raw nested JSON unless the user explicitly asks for expert/operator details.

## Advanced Authoring

Use this mode only when the user explicitly asks for separated authoring context, deterministic drafts, or authored-vs-draft comparison.

```json
{"method":"tools/call","params":{"name":"learning_agent.create_learning_project","arguments":{"request":"<Chinese natural-language course request>"}}}
{"method":"tools/call","params":{"name":"learning_agent.get_authoring_context","arguments":{"runId":"<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.generate_grounded_course","arguments":{"runId":"<draft-run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.compare_authoring_quality","arguments":{"authoredRunId":"<authored-run-id>","draftRunId":"<draft-run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.create_quality_revision","arguments":{"runId":"<authored-run-id>"}}}
```

Do not present deterministic drafts as the default high-quality product.

## Expert/Operator Mode

Use this mode only when the user asks for artifact review, debugging, reproducibility, approval gates, or low-level workflow control. It is appropriate for operator-facing runs, not for a normal learner who wants to study.

1. Convert natural language into a reviewable run plan:

```bash
npm run agent:plan -- \
  --request "<Chinese natural-language course request>" \
  --run <run-id>
```

Inspect `runs/<run-id>/run.plan.json`, then initialize only after the plan is acceptable:

```bash
npm run agent:init-from-plan -- --run <run-id> --approve true
```

MCP equivalents:

```json
{"method":"tools/call","params":{"name":"learning_agent.plan_run","arguments":{"request":"<Chinese natural-language course request>","runId":"<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.init_from_plan","arguments":{"runId":"<run-id>","approve":true}}}
{"method":"tools/call","params":{"name":"learning_agent.run_until_gate","arguments":{"runId":"<run-id>","maxSteps":20}}}
{"method":"tools/call","params":{"name":"learning_agent.read_artifact","arguments":{"runId":"<run-id>","artifactId":"source-map","version":"v1"}}}
```

2. Initialize directly when exact flags are already known:

```bash
npm run agent:init -- \
  --source-file "<path>" \
  --source-kind <book|paper|patent|blog|documentation|notes|course|unknown> \
  --source-title "<title>" \
  --unit-pages <count> \
  --strategy overview_plus_topic \
  --planning-mode topic_guided \
  --adapter codex \
  --run <run-id>
```

For topic-only runs:

```bash
npm run agent:init -- --topic "<topic>" --unit-pages <count> --language zh-CN --adapter codex --run <run-id>
```

3. Advance the parent run through source and curriculum gates:

```bash
npm run agent:run -- --run <run-id>
```

When `manual_action_required` appears, open `promptPath`, generate exactly one valid JSON artifact for the requested `artifactId`, then submit it:

```bash
npm run agent:submit -- --run <run-id> --artifact <artifact-id> --file <json-file>
```

4. Inspect each gate artifact before approval. Use the exact version returned by the runtime:

```bash
npm run agent:approve -- --run <run-id> --gate <gate-id> --version <version> --notes "<notes>"
```

Use revision instead of approval when source coverage, unit plan, lesson quality, or technical accuracy is not acceptable:

```bash
npm run agent:revise -- --run <run-id> --gate <gate-id> --version <version> --notes "<requested changes>"
```

5. After `curriculum-plan` is approved, orchestrate unit runs:

```bash
npm run agent:course -- --run <run-id> --all true
```

This ensures child unit runs exist and advances them until the next manual request, approval gate, completion, or step limit.

6. Complete manual artifacts and approval gates for each child run. Continue:

```bash
npm run agent:course -- --run <run-id> --all true
```

7. After each child run has an approved `lesson`, promote all unit lessons and write the course pack manifest:

```bash
npm run agent:promote-units -- --run <run-id> --all true
```

This writes promoted lessons under `src/lessons/<lesson-id>/lesson.ts` and a course pack manifest under:

```text
src/course-packs/<run-id>/coursePack.ts
```

## Single Unit Or Lesson Workflow

To work on one unit only:

```bash
npm run agent:units -- --run <run-id>
npm run agent:course -- --run <run-id> --unit <unit-id>
```

To promote one approved unit lesson:

```bash
npm run agent:promote-units -- --run <run-id> --unit <unit-id>
```

For a true single lesson that is not source-backed, use the lower-level lesson runner:

```bash
npm run agent:run -- --run <run-id>
npm run agent:promote -- --run <run-id>
```

## Validation

Before reporting a generation or infrastructure change as done, run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Guardrails

- Do not collapse source-backed material into one short lesson unless the user explicitly asks for an overview only.
- Do not treat a book's total output as `--unit-pages`; it is per-unit.
- Do not expose internal artifacts or approvals in the default learner workflow.
- In expert mode, inspect `source-graph`, `course-plan`, `unit-plan`, and `authoring-context` artifacts when debugging source understanding or planning quality.
- Do not approve artifacts without inspecting versioned files under `runs/<run-id>/artifacts/` when using expert/operator mode.
- Do not promote low-level draft lessons until the relevant `lesson` artifact is approved.
- Do not assume old runs match the latest schema; check `run.config.json` and artifact shape first.
- Keep learner-facing content Chinese-first by default.
