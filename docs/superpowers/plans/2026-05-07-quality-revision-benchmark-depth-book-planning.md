# Quality Revision, Benchmark, Depth, And Long-Book Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the next four product-kernel gaps: quality revision automation, real-source quality benchmarks, university/research depth rubric, and long-book planning.

**Architecture:** Keep Codex/Claude as the author. MCP should generate source semantics, quality gaps, benchmark reports, revision briefs, and planning constraints that Codex can execute. Do not replace Codex authoring with deterministic lesson generation.

**Tech Stack:** TypeScript, Vitest, existing MCP runtime services, file-backed `runs/` artifacts, Markdown runtime docs.

---

## Files

- Modify: `tools/agent-runtime/learner/learning-revision-service.ts`
- Modify: `tools/agent-runtime/learner/learning-revision-service.test.ts`
- Modify: `tools/agent-runtime/learner/revision-brief.ts`
- Modify: `tools/agent-runtime/learner/authoring-quality-comparison.ts`
- Create: `tools/agent-runtime/learner/real-source-quality-benchmark.ts`
- Create: `tools/agent-runtime/learner/real-source-quality-benchmark.test.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`
- Modify: `tools/agent-runtime/learner/course-unit-planner.ts`
- Modify: `tools/agent-runtime/learner/course-unit-planner.test.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `tools/mcp-server/json-rpc-server.test.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`
- Modify: `docs/runtime/codex-authoring-protocol-v2.md`
- Modify: `docs/runtime/real-source-quality-benchmark.md`
- Modify: `docs/runtime/codex-user-trial-script.md`
- Modify: `docs/product/future-development-plan.md`

## Task 1: Quality Gap To Revision Brief Automation

- [x] Add a failing test in `learning-revision-service.test.ts` that writes `runs/<run-id>/quality/authoring-quality-comparison.json` with `remainingGaps` and `revisionInstructions`, then calls `requestQualityRevision({ runId })`.
- [x] Expected RED: `requestQualityRevision` does not exist.
- [x] Add `LearningRevisionService.requestQualityRevision(input: { runId: string; comparisonReportPath?: string })`.
- [x] The method reads the comparison report, converts `revisionInstructions` into revision brief `feedback`, `revisionInstructions`, and `expectedQualityChecks`, and returns `status: "quality_revision_brief_ready"`.
- [x] Add MCP tool `learning_agent.create_quality_revision` with input `{ runId, comparisonReportPath? }`.
- [x] Update JSON-RPC and runtime tool tests so the tool appears and returns a quality revision brief.
- [x] Run `npx vitest run tools/agent-runtime/learner/learning-revision-service.test.ts tools/mcp-server/runtime-tools.test.ts tools/mcp-server/json-rpc-server.test.ts --pool threads`.

## Task 2: Real Source Quality Benchmark Report

- [x] Add a failing test in `real-source-quality-benchmark.test.ts` for `buildRealSourceQualityBenchmarkReport`.
- [x] Expected report fields: `status`, `summary`, `qualityDimensions`, `sourceKinds`, `nextActions`, and per-source quality coverage.
- [x] Implement `real-source-quality-benchmark.ts` as a pure report builder over `RealSourceRegressionResult`.
- [x] Include source kinds `book`, `paper`, `patent`, `blog`, `documentation`, `notes`, and `topic-only` as benchmark coverage expectations, even when automated samples exist only for the first four.
- [x] Update `docs/runtime/real-source-quality-benchmark.md` to describe the report fields and quality dimensions.
- [x] Run `npx vitest run tools/agent-runtime/learner/real-source-quality-benchmark.test.ts tools/agent-runtime/learner/real-source-regression.test.ts --pool threads`.

## Task 3: University / Graduate / Research Depth Rubric

- [x] Add failing tests in `course-quality-report.test.ts` for a shallow graduate lesson that lacks prerequisite bridge, formal abstraction, evidence chain, assumption/boundary, critique/discussion, and homework transfer.
- [x] Replace marker-count-only depth with a structured `AcademicDepthRubricResult` in `course-quality-report.ts`.
- [x] Expose missing dimensions in the issue reason and required fix.
- [x] Ensure paper/research checks still run and keep patent/blog source-kind depth checks.
- [x] Run `npx vitest run tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/authoring-quality-comparison.test.ts --pool threads`.

## Task 4: Long Book Planning And Page Budget

- [x] Add failing tests in `course-unit-planner.test.ts` for long-book input with many selected chapters.
- [x] Expected behavior: plan contains an overview unit, chapter units, `planningNotes`, `estimatedTotalPages`, and a `sourceCoveragePlan`.
- [x] Implement long-book planning in `planCourseUnits` without changing existing unit IDs for short inputs.
- [x] Keep authoring context compatible with the new course-plan fields and validate downstream authoring-context tests.
- [x] Run `npx vitest run tools/agent-runtime/learner/course-unit-planner.test.ts tools/agent-runtime/learner/authoring-context-service.test.ts --pool threads`.

## Task 5: Docs, Release Gate, Commit

- [x] Update runtime docs so Codex users know to call `create_quality_revision` after failed compare reports.
- [ ] Run targeted suite:

```bash
npx vitest run \
  tools/agent-runtime/learner/learning-revision-service.test.ts \
  tools/agent-runtime/learner/real-source-quality-benchmark.test.ts \
  tools/agent-runtime/quality/course-quality-report.test.ts \
  tools/agent-runtime/learner/course-unit-planner.test.ts \
  tools/agent-runtime/learner/authoring-context-service.test.ts \
  tools/mcp-server/runtime-tools.test.ts \
  tools/mcp-server/json-rpc-server.test.ts \
  --pool threads
```

- [x] Run `git diff --check`.
- [x] Run `npm run test:ci`, `npm run source:regression`, `npm run seed:check`, and `npm run codex:mcp:check`.
- [ ] Commit with message `Advance quality revision and planning kernel`.

## Acceptance Metrics

- Quality compare gaps can become a revision brief without learner-written feedback.
- Real-source quality benchmark reports quality dimensions per source kind.
- Graduate/research lessons are checked against named depth dimensions rather than only text markers.
- Long books receive explicit overview + chapter/topic planning and page-budget metadata.
- Targeted tests and release gate pass.
