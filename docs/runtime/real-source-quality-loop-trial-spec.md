# Real Source Quality Loop Trial Spec

This spec defines the repeatable acceptance trial for Codex/Claude-style source-backed learning-course generation.

## Goal

Verify that a real source can move through the learner-facing quality loop without exposing internal artifacts to the learner:

```text
prepare/create project
  -> authoring context
  -> deterministic draft baseline
  -> Codex-authored course publish
  -> authored-vs-draft quality comparison
  -> optional quality revision brief
  -> preview smoke
```

The trial checks product behavior, not just unit-level API coverage.

## Required Source

Use a public fixture by default so the trial is safe for open source:

```text
examples/sources/agent-workflow-notes.md
```

Private books, papers, patents, or blogs may be used manually, but generated private source-derived course content must stay under a temporary workspace or `runs/` preview output that is not committed.

## Learner Request Shape

The learner-facing request must include:

- source path or URL
- audience
- teaching difficulty
- course strategy
- pages per unit

Default book request:

```text
请用 examples/sources/agent-workflow-notes.md 这本书生成中文互动学习网页。先给总览课，再按核心 topic 拆课。每个单元 8 页。面向有基础编程经验但还没有智能体系统心智模型的中文学习者。教学难度定位为大学高年级/研究生课程。
```

## Acceptance Criteria

The trial passes only when all required criteria hold:

- `prepare_learning_course` or equivalent project creation reaches `project_ready` / `authoring_context_ready`.
- Deterministic draft baseline reaches `preview_ready`.
- Codex-authored publish reaches `preview_ready`.
- `qualityReport.status` for the Codex-authored run is not `failed`.
- `qualityReport.checks.academicDepth` is `passed` for upper-undergraduate / graduate and research-level requests.
- The course has at least one overview unit plus at least two focused units for source-backed long material.
- Each unit respects the requested `unitPages`.
- `compare_authoring_quality` writes `quality/authoring-quality-comparison.json`.
- If `compare_authoring_quality.remainingGaps` is non-empty, `create_quality_revision` writes `learning-revisions/revision-001.json`.
- `get_learning_preview` returns a learner-facing URL under `#/preview/<run-id>`.
- `npm run smoke:playwright` passes after port 5173 is free.

## Failure Criteria

The trial fails when any of these are true:

- The user would need to approve `source-map`, `concept-map`, `curriculum-plan`, or `critic-report` in the normal learner flow.
- The generated course is only a summary of the source rather than an interactive course.
- The source is compressed into one short lesson despite a long-source request.
- `qualityReport.status=failed`.
- Source-backed pages lack source anchors or explicit inferred/analogy grounding.
- Quality comparison reports gaps but no revision brief can be created.

## Evidence To Record

Record these fields in the run log or final report:

- workspace root
- draft run id
- authored run id
- preview URL
- lesson count
- quality status and score
- academic depth check
- comparison improvements
- comparison remaining gaps
- revision brief path when created
- smoke command result

## Commands

Frontend smoke after freeing port 5173:

```bash
npm run smoke:playwright
```

Real-source regression and benchmark:

```bash
npm run source:regression
```

Main CI gate:

```bash
npm run test:ci
```
