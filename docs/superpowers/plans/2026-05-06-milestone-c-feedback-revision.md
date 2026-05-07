# Milestone C Feedback-To-Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert learner natural-language feedback into targeted revision briefs, scoped revision application, quality re-check output, and learner-readable revision history.

**Architecture:** Extend the existing revision services instead of replacing them. `revision-targeting.ts` owns deterministic feedback classification and target resolution; `learning-revision-service.ts` writes Revision Brief V2; `targeted-revision-service.ts` applies bounded page changes and returns before/after quality metadata; `learning-progress.ts` stores learner-facing feedback and revision history.

**Tech Stack:** TypeScript, Vitest, local MCP runtime, React/Vite product state utilities, existing Course IR V1 and Quality Report V2 contracts.

---

## File Map

- Modify: `tools/agent-runtime/learner/revision-targeting.ts`
  - Add feedback categories, V2 target type, current-context input, deterministic classifier, and clarification behavior.
- Modify: `tools/agent-runtime/learner/revision-targeting.test.ts`
  - RED/GREEN tests for explicit page, current page context, category detection, and ambiguous feedback.
- Create: `tools/agent-runtime/learner/revision-brief.ts`
  - Build Revision Brief V2 from target, preview, publish paths, Course IR artifact path, and quality report path.
- Create: `tools/agent-runtime/learner/revision-brief.test.ts`
  - Tests for source constraints, expected checks, and artifact path inclusion.
- Modify: `tools/agent-runtime/learner/learning-revision-service.ts`
  - Use `parseRevisionTargetV2` and `buildRevisionBriefV2`; preserve the current service response shape while returning the richer target.
- Modify: `tools/agent-runtime/learner/learning-revision-service.test.ts`
  - Tests for schemaVersion 2, source constraints, and target context.
- Modify: `tools/agent-runtime/learner/targeted-revision-service.ts`
  - Return `changedPages`, `qualityBefore`, and `qualityAfter`; keep page-only deterministic apply behavior.
- Modify: `tools/agent-runtime/learner/targeted-revision-service.test.ts`
  - Tests for changed page summaries and before/after quality status.
- Modify: `src/product/learning-progress.ts`
  - Add `RevisionHistoryItem`, state normalization, and `addRevisionHistoryItem`.
- Modify: `src/product/learning-progress.test.ts`
  - Tests for revision history persistence and newest-first capping.
- Modify: `skills/learner-feedback-revision/SKILL.md`
  - Document feedback categories, page-context routing, preview-based acceptance, and no artifact approval.
- Modify: `docs/product/future-development-plan.md`
  - Link the Milestone C spec and plan.

## Task 1: Feedback Targeting V2

- [ ] Write failing tests in `tools/agent-runtime/learner/revision-targeting.test.ts`:

```ts
expect(parseRevisionTargetV2("第 3 页太抽象，换成工程例子")).toMatchObject({
  scope: "page",
  pageIndex: 2,
  pageNumber: 3,
  categories: ["too_abstract"],
  confidence: "high"
});

expect(parseRevisionTargetV2("这页来源依据不清楚", {
  currentCourseId: "course-a",
  currentUnitId: "unit-overview",
  currentLessonId: "lesson-a",
  currentPageId: "p4",
  currentPageIndex: 3
})).toMatchObject({
  scope: "page",
  courseId: "course-a",
  unitId: "unit-overview",
  lessonId: "lesson-a",
  pageId: "p4",
  pageIndex: 3,
  categories: ["source_unclear"]
});

expect(parseRevisionTargetV2("这页太抽象")).toMatchObject({
  scope: "page",
  confidence: "low",
  clarificationQuestion: "你想修改哪一页？请告诉我页码，或先打开要修改的页面。"
});
```

- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/revision-targeting.test.ts
```

Expected: fails because `parseRevisionTargetV2` is not exported.

- [ ] Implement `RevisionFeedbackCategory`, `RevisionTargetV2`, `RevisionTargetContext`, and `parseRevisionTargetV2` in `revision-targeting.ts`.
- [ ] Keep `parseRevisionTarget` as a compatibility wrapper.
- [ ] Re-run the same test command. Expected: pass.

## Task 2: Revision Brief V2

- [ ] Add failing tests in new `tools/agent-runtime/learner/revision-brief.test.ts`:

```ts
const brief = buildRevisionBriefV2({
  runId: "course-a",
  revisionId: "revision-001",
  feedback: "第 3 页太抽象",
  target: parseRevisionTargetV2("第 3 页太抽象"),
  currentCoursePackPath: "runs/course-a/preview/course-pack.json",
  currentLessonPaths: ["runs/course-a/preview/lessons/lesson-a.json"],
  courseIRPath: "runs/course-a/artifacts/course-ir.draft.json",
  qualityReportPath: "runs/course-a/quality/course-quality-report.json",
  previousFeedbackCount: 0
});
expect(brief).toMatchObject({
  schemaVersion: 2,
  sourceConstraints: {
    preserveSourceAnchors: true,
    allowInferredGrounding: true
  },
  expectedQualityChecks: expect.arrayContaining(["source grounding", "Chinese-first", "publish validation"])
});
```

- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/revision-brief.test.ts
```

Expected: fails because module does not exist.

- [ ] Implement `buildRevisionBriefV2` in `revision-brief.ts`.
- [ ] Re-run the same test command. Expected: pass.

## Task 3: Learning Revision Service Integration

- [ ] Update `learning-revision-service.test.ts` with a RED assertion that the written brief has `schemaVersion: 2`, `target.categories`, `sourceConstraints`, `expectedQualityChecks`, `courseIRPath`, and `qualityReportPath`.
- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/learning-revision-service.test.ts
```

Expected: fail because the service still writes schemaVersion 1.

- [ ] Modify `learning-revision-service.ts` to call `parseRevisionTargetV2` and `buildRevisionBriefV2`.
- [ ] Add helper functions to detect `runs/<run-id>/artifacts/course-ir.draft.json` and `runs/<run-id>/quality/course-quality-report.json`.
- [ ] Re-run the same test command. Expected: pass.

## Task 4: Apply Revision Result Metadata

- [ ] Update `targeted-revision-service.test.ts` with RED assertions:

```ts
expect(result.changedPages).toEqual([
  {
    lessonId: "target-lesson",
    pageId: "p3",
    pageIndex: 2,
    changeSummary: "第 3 页太抽象，换成工程例子"
  }
]);
expect(result.qualityBefore).toMatchObject({ status: "passed" });
expect(result.qualityAfter).toMatchObject({ status: "passed" });
```

- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/targeted-revision-service.test.ts
```

Expected: fail because result lacks `changedPages`, `qualityBefore`, and `qualityAfter`.

- [ ] Modify `targeted-revision-service.ts` to read the current preview quality before republish and return changed page metadata.
- [ ] Re-run the same test command. Expected: pass.

## Task 5: Learner Revision History

- [ ] Update `src/product/learning-progress.test.ts` with RED assertions that `addRevisionHistoryItem` stores learner-facing revision history newest-first and survives `saveLearningProgress`/`loadLearningProgress`.
- [ ] Run:

```bash
npm run test:unit -- src/product/learning-progress.test.ts
```

Expected: fail because revision history does not exist.

- [ ] Modify `src/product/learning-progress.ts` to add `RevisionHistoryItem`, `revisionHistory`, and `addRevisionHistoryItem`.
- [ ] Re-run the same test command. Expected: pass.

## Task 6: Skills And Docs

- [ ] Update `skills/learner-feedback-revision/SKILL.md` to mention feedback categories, current page context, and quality re-check output.
- [ ] Update `docs/product/future-development-plan.md` with links to the Milestone C spec and this plan.
- [ ] Run:

```bash
npm run bundle:check
```

Expected: pass.

## Validation

Run targeted checks:

```bash
npm run test:unit -- tools/agent-runtime/learner/revision-targeting.test.ts tools/agent-runtime/learner/revision-brief.test.ts tools/agent-runtime/learner/learning-revision-service.test.ts tools/agent-runtime/learner/targeted-revision-service.test.ts src/product/learning-progress.test.ts
```

Run final seed gate before merge:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run bundle:check
npm run seed:check
```

## Done Definition

- Revision targeting V2 resolves explicit page feedback, current-page feedback, coarse feedback, and ambiguous feedback.
- Revision Brief V2 is written by `learning_agent.revise_learning_course`.
- `apply_learning_revision` returns changed pages and before/after quality status.
- Learner progress stores revision history.
- Skills and docs describe the revised learner-facing loop.
- All validation commands above pass.
