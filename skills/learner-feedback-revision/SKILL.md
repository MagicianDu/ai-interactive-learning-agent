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
- Summarize visible changes: what changed in the learning path, units, pages, visuals, interactions, or feedback.
- If feedback requires behavior the learner-facing MCP tools do not support, explain the limitation and route the work to Codex-authored revision or expert/operator mode.
- Keep the next acceptance step preview-based.
