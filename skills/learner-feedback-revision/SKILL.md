---
name: learner-feedback-revision
description: Use when a learner gives feedback on a generated learning course or asks to revise, improve, simplify, deepen, export, or share a preview-ready course.
---

# Learner Feedback Revision

Use this skill after a learner has seen a generated course preview and wants changes.

## Feedback Scope

- page: fix one page's explanation, visual, quiz, or interaction.
- unit: change depth, pacing, examples, or page count for one learning unit.
- course: reorganize units, switch chapter/topic/task strategy, or adjust audience assumptions.
- source: add, remove, or re-ground against a book, paper, patent, blog, note, URL, or folder.
- style: make the Chinese explanation simpler, more rigorous, more visual, more practice-oriented, or less text-heavy.
- export: produce a shareable course package after preview acceptance.

## Feedback Categories

Map learner language into one or more revision categories:

- `too_abstract`: explanation lacks a concrete model or example.
- `too_dense`: page has too much content for one no-scroll learning screen.
- `example_missing`: learner needs a concrete case, engineering example, or analogy.
- `source_unclear`: source anchors, evidence, or claim grounding are unclear.
- `interaction_weak`: learner action is decorative or not cognitively useful.
- `feedback_unhelpful`: answer feedback does not explain why.
- `too_easy` / `too_hard`: difficulty mismatch.
- `suspicious_claim`: learner flags a possible mistake or unsupported claim.
- `more_practice`: learner wants more checks, exercises, or transfer tasks.
- `structure_change`: course/unit order or strategy should change.
- `style_change`: wording, tone, rigor, or Chinese readability should change.

If the learner says "this page" and current page context is available, target that page. If current page context is not available, ask exactly one learner-answerable question: "你想修改哪一页？请告诉我页码，或先打开要修改的页面。"

## Workflow

Convert the learner's natural language feedback into a revision request, then call:

```json
{"method":"tools/call","params":{"name":"learning_agent.revise_learning_course","arguments":{"runId":"<run-id>","feedback":"<learner feedback>"}}}
{"method":"tools/call","params":{"name":"learning_agent.apply_learning_revision","arguments":{"runId":"<run-id>"}}}
{"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"<run-id>"}}}
```

When the learner asks to share or package the accepted result, call:

```json
{"method":"tools/call","params":{"name":"learning_agent.export_learning_course","arguments":{"runId":"<run-id>"}}}
```

## Guardrails

- Do not ask the learner to approve source maps, concept maps, curriculum plans, or other internal artifacts.
- Summarize visible changes: changed lessons, changed pages, quality before/after, and preview URL.
- For source-backed courses, preserve `sourceAnchorIds` unless the learner explicitly asks to re-ground against a different source.
- If feedback requires behavior the learner-facing MCP tools do not support, explain the limitation and route the work to Codex-authored revision or expert/operator mode.
- Keep the next acceptance step preview-based.
