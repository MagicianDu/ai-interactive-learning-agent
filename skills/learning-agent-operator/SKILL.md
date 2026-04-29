---
name: learning-agent-operator
description: Use when operating this repository's AI Interactive Learning Agent from natural language: initialize source-backed runs for books, papers, patents, blogs, notes, folders, or topics; orchestrate course packs; handle manual artifacts; approve gates; and promote lessons or course packs.
---

# Learning Agent Operator

Use this skill when the user asks Codex to generate or continue Chinese interactive learning material from a topic, book, paper, patent, blog, URL, folder, or pasted text in this repository.

## Defaults

- Work from the repository root.
- Output language is `zh-CN` unless the user explicitly requests otherwise.
- Prefer source-backed course packs over single lessons when a file, URL, folder, book, paper, patent, or blog is provided.
- Default course strategy: `overview_plus_topic`.
- `--unit-pages` means pages per learning unit, not total pages for the whole source.
- Use `--adapter codex` when the current Codex session should produce manual role artifacts.
- Preserve approval gates. Do not promote drafts.

## Natural Language Mapping

Map user intent into run config flags:

- Book: `--source-kind book --source-file <path>`
- Paper or article PDF: `--source-kind paper --source-file <path>`
- Patent: `--source-kind patent --source-file <path>` or `--source-url <url>`
- Blog or web article: `--source-kind blog --source-url <url>`
- Local notes or folder: `--source-kind notes --source-file <path>` or `--source-folder <path>`
- Topic only: `--topic "<topic>"`
- "按章节": `--strategy chapter_guided --planning-mode chapter_guided`
- "按 topic / 核心概念": `--strategy overview_plus_topic --planning-mode topic_guided`
- "按任务 / 实践": `--strategy task_guided --planning-mode task_guided`
- Page count like "每章10页" or "每个 topic 12 页": `--unit-pages 10` or `--unit-pages 12`

If the user does not specify planning mode for source-backed material, use:

```bash
--strategy overview_plus_topic --planning-mode topic_guided
```

## Course Pack Workflow

1. Convert natural language into a reviewable run plan:

```bash
npm run agent:plan -- \
  --request "<Chinese natural-language course request>" \
  --run <run-id>
```

Inspect:

```text
runs/<run-id>/run.plan.json
```

Confirm inferred `sourceKind`, `strategy`, `planningMode`, `unitPages`, `audience`, and `adapter`. If the plan is acceptable, initialize from it:

```bash
npm run agent:init-from-plan -- --run <run-id> --approve true
```

Use `--approve true` only after the plan has been reviewed. For stricter operation, edit the plan file to set `"status": "approved"` and then omit the shortcut.

MCP-ready equivalent:

```json
{"method":"tools/call","params":{"name":"learning_agent.plan_run","arguments":{"request":"<Chinese natural-language course request>","runId":"<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.init_from_plan","arguments":{"runId":"<run-id>","approve":true}}}
{"method":"tools/call","params":{"name":"learning_agent.run_until_gate","arguments":{"runId":"<run-id>","maxSteps":20}}}
{"method":"tools/call","params":{"name":"learning_agent.read_artifact","arguments":{"runId":"<run-id>","artifactId":"source-map","version":"v1"}}}
```

2. Initialize the run directly when the user has already supplied exact flags:

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
- Do not approve artifacts without inspecting versioned files under `runs/<run-id>/artifacts/`.
- Do not promote until the relevant `lesson` artifact is approved.
- Do not assume old runs match the latest schema; check `run.config.json` and artifact shape first.
- Keep learner-facing content Chinese-first by default.
