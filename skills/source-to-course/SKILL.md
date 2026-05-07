---
name: source-to-course
description: Use when converting books, papers, patents, blogs, notes, folders, or topic-only learner requests into course organization strategy, source kind, unit page count, selected chapters/topics, and MCP learner project inputs.
---

# Source To Course

Use this skill to turn learner-supplied material into a course request that the learner-facing MCP flow can execute.

## Product Contract

- Codex or Claude authors the final `coursePack` and `lessons` after `learning_agent.prepare_learning_course` or the explicit `create_learning_project` -> `get_authoring_context` fallback.
- Keep learner-facing course output中文优先 unless the learner explicitly asks otherwise.
- Preserve `sourceAnchorIds` for books, papers, patents, blogs, notes, folders, and other source-backed materials.
- `learning_agent.get_authoring_context` records Source Graph V2 and Course Planning V2 artifacts for expert audit, but learner mode should only receive course shape, preview, and quality summary.
- Codex should follow `contentBlueprint.units[*].pageBlueprints` before writing lessons: page type, teaching move, learner action, visual requirement, feedback requirement, and source requirement.
- 不要让学习者审批内部 artifacts such as source maps, concept maps, curriculum plans, or critic reports in the default learner flow.

## Source Routing

- `book`: long-form PDF/EPUB/text, usually needs an overview unit plus focused topic units, with optional chapter mapping.
- `paper`: extract research problem, method, evidence, limitations, and transfer use cases; keep source grounding visible.
- `patent`: map claims, prior-art problem, mechanism, embodiments, figures, and application boundaries.
- `blog`: extract the main argument, implementation pattern, caveats, and runnable examples.
- `notes` or folder: preserve the user's structure when clear; otherwise infer themes and prerequisites.
- topic-only: generate a compact course from the topic and audience, then ask for source material only if factual grounding is required.

## Strategy Mapping

- `overview_plus_topic`: default for long sources; one overview course plus core-topic units.
- `chapter_guided`: use when the learner asks to follow chapters or sections.
- `topic_guided`: use when the learner asks for core concepts, mental models, or selected topics.
- `task_guided`: use when the learner wants practical workflow, exercises, or application tasks.
- `hybrid`: use when the learner wants chapter traceability and topic-first learning.

Track selected chapters, selected topics, audience, teaching difficulty level, language, and `unitPages` as learner-visible choices. `unitPages` means pages per unit.

Ask at most three learner-answerable clarification questions. If the learner did not state teaching difficulty, ask them to choose one of: 入门衔接, 本科核心课程, 大学高年级/研究生课程, 研究论文精读/前沿讨论. Never ask a learner to approve source maps, concept maps, curriculum plans, or critic reports in the default flow.

## Apply The Plan Through MCP

Call the learner-facing tools in this order for the default flow:

```json
{"method":"tools/call","params":{"name":"learning_agent.prepare_learning_course","arguments":{"request":"<Chinese learner request with source path or URL, audience, difficulty level, strategy, and unitPages>"}}}
{"method":"tools/call","params":{"name":"learning_agent.publish_learning_course","arguments":{"runId":"<run-id>","coursePack":{},"lessons":[]}}}
{"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"<run-id>"}}}
```

Use the explicit `learning_agent.create_learning_project` -> `learning_agent.get_authoring_context` flow only when the user specifically asks to inspect or separate those steps.

Normal outputs should be compact: preview URL, course shape, and `qualityReport` status/score/checks/issueSummary/topIssues. Keep detailed artifacts available only when the learner explicitly asks for expert review.

If the workflow produced both a deterministic draft run and a Codex-authored run, call `learning_agent.compare_authoring_quality` and summarize the authored-vs-draft improvements plus remaining gaps. This is a quality delta report, not a learner approval artifact.

When inspecting expert details, prefer the latest `source-graph`, `course-plan`, `unit-plan`, `authoring-context`, `course-ir`, `lesson-bundle`, and `publish-validation` artifacts. Do not turn those artifacts into learner approval steps.

## Quality Checklist

- Keep generated learning content Chinese-first unless requested otherwise.
- Codex should author the course content from the authoring context; MCP validates and publishes it.
- Preserve the learner's requested teaching difficulty level in lesson prerequisites, examples, assessments, and transfer tasks.
- For long sources, prefer an overview unit followed by focused units instead of compressing the entire source into one short lesson.
- Use Course Planning V2 expectations from authoring context to preserve strategy reason, source mapping, expected interactions, expected assessments, and transfer expectations.
- Use `contentBlueprint.units[*].pageBlueprints` as the page-by-page authoring checklist; do not collapse it into long prose.
- Do not ask the learner to approve internal artifacts such as source maps, concept maps, or curriculum plans.
- Preserve chapter or section mappings when the learner asks for them.
- Keep every unit's page count aligned with the requested `unitPages`.
- Make the preview the main acceptance surface.
- If `qualityReport.status=failed`, revise from `topIssues` and republish; do not export unless a maintainer explicitly uses an expert override for debugging.
