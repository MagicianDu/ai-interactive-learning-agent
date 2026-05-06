# Milestone B Parallel Workstreams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Milestone B on the mainline while running three bounded pre-research workstreams that prepare Milestone C and D without destabilizing the default learner path.

**Architecture:** The main thread owns Course IR and Quality Engine V2 as the critical path. Parallel workstreams may prototype Feedback-To-Revision V2, Learner Progress/Feedback Product Kernel, and Learning Object Runtime V1 only behind stable contracts or feature flags, and must consume the mainline Course IR and Quality Report contracts when they merge.

**Tech Stack:** TypeScript, Vitest, React/Vite, local MCP runtime, existing `tools/agent-runtime`, `src/product`, `src/components`, and `skills` packages.

---

## Scope

This plan covers one mainline and three parallel pre-research lines:

```text
Mainline B:
  Course IR And Authoring Contract
  -> Quality Engine V2

Parallel A:
  Feedback-To-Revision V2 prototype

Parallel B:
  Learner Project And Progress Kernel prototype

Parallel C:
  Learning Object Runtime V1 prototype
```

This plan does not implement Tutor, Teacher mode, cloud storage, account systems, hosted deployment, or additional runtime adapters. Those remain later work unless a prototype explicitly consumes the contracts defined here.

## Dependency Rules

- Mainline B is the critical path.
- Parallel work may start before Mainline B finishes, but cannot become the default product path until Course IR and Quality Engine V2 are stable.
- Parallel work must not introduce a competing lesson schema, course schema, or quality report shape.
- Parallel work must pass its own tests and the global release gate before merge.
- Expert artifacts may be added; learner mode must remain artifact-free by default.

## Workstream Ownership

### Mainline B: High-Quality Authoring Kernel

Objective:

Stabilize a shared Course IR and upgrade quality reporting so generated courses can be validated, revised, and exported safely.

Primary files:

- Create: `tools/agent-runtime/learner/course-ir.ts`
- Create: `tools/agent-runtime/learner/course-ir.test.ts`
- Create: `tools/agent-runtime/learner/publish-validation.ts`
- Create: `tools/agent-runtime/learner/publish-validation.test.ts`
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.ts`
- Modify: `tools/agent-runtime/learner/learning-course-publisher.ts`
- Modify: `tools/agent-runtime/learner/grounded-course-service.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`
- Modify: `tools/agent-runtime/learner/export-bundle-service.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `skills/lesson-critic/SKILL.md`
- Modify: `docs/runtime/artifact-contracts.md`
- Modify: `docs/runtime/codex-bundle-authoring.md`

Target outputs:

- `runs/<run-id>/artifacts/course-ir.vN.json`
- `runs/<run-id>/artifacts/lesson-bundle.vN.json`
- `runs/<run-id>/artifacts/publish-validation.vN.json`
- `runs/<run-id>/quality/course-quality-report.json`

Acceptance:

- Course IR has a version field and can represent overview units, focused units, pending units, failed units, revised units, source evidence, and quality status.
- Publish validation fails when required page fields, source evidence fields, assessment feedback fields, or viewport-fit hints are missing.
- Quality report includes course, unit, lesson, and page-level statuses.
- Every failed quality check includes issue ID, affected scope, reason, required fix, and severity.
- Quality report distinguishes unsupported source claim, weak source anchor, generic page, decorative interaction, missing feedback mechanism, content too dense for viewport, and learner-level mismatch.
- Export is blocked when quality status is `failed` unless expert mode provides an explicit override reason.
- Public fixture courses score `passed` or `warning`.

### Parallel A: Feedback-To-Revision V2 Prototype

Objective:

Prepare targeted learner feedback handling so Milestone C can turn page/unit/course feedback into safe source-grounded revision briefs.

Primary files:

- Modify: `tools/agent-runtime/learner/revision-targeting.ts`
- Modify: `tools/agent-runtime/learner/revision-targeting.test.ts`
- Modify: `tools/agent-runtime/learner/learning-revision-service.ts`
- Modify: `tools/agent-runtime/learner/learning-revision-service.test.ts`
- Create: `tools/agent-runtime/learner/revision-brief.ts`
- Create: `tools/agent-runtime/learner/revision-brief.test.ts`
- Modify: `skills/learner-feedback-revision/SKILL.md`

Target outputs:

- `revisionBrief.json`
- `revisionPatch.json`
- `revisionQualityReport.json`

Acceptance:

- Feedback with page references resolves to course ID, unit ID, page ID, and revision scope.
- Feedback without page references resolves to the current page when context exists.
- Feedback without enough context returns one learner-answerable clarification question, not an operator artifact request.
- Revision categories include too abstract, too dense, example missing, source unclear, interaction weak, feedback unhelpful, too easy, too hard, suspicious claim, and wants more practice.
- Prototype does not regenerate the whole course by default.
- Prototype consumes Course IR and Quality Report when available; before Mainline B lands, it may use adapter functions with fixture input only.

### Parallel B: Learner Project And Progress Kernel Prototype

Objective:

Prepare the learner-facing state model so users can continue learning, see feedback history, and understand revision changes without seeing developer artifacts.

Primary files:

- Modify: `src/product/learning-progress.ts`
- Modify: `src/product/learning-progress.test.ts`
- Modify: `src/product/CourseWorkspace.tsx`
- Modify: `src/product/CourseWorkspace.test.tsx`
- Modify: `src/product/LearningSidebar.tsx`
- Modify: `src/product/ProjectLibrary.tsx`
- Modify: `src/product/ProjectLibrary.test.tsx`
- Modify: `src/product/generated-preview.ts`
- Modify: `tools/agent-runtime/learner/project-registry.ts`
- Modify: `tools/agent-runtime/learner/project-registry.test.ts`

Target learner state:

- current project
- current course
- current unit
- current page
- completed pages
- quiz attempts
- feedback history
- revision history summary
- export/share status

Acceptance:

- Generated preview links open directly into learner study mode.
- Refresh preserves current course, unit, page, and completed page state.
- Feedback history and revision history are learner-readable.
- Sidebar contains learning functions without crowding the main teaching canvas.
- Main study page remains viewport-fit on common laptop and tablet widths.
- No account system, database, or cloud storage is introduced.

### Parallel C: Learning Object Runtime V1 Prototype

Objective:

Prepare reusable interaction objects that can replace page-specific one-off interaction logic after Course IR stabilizes.

Primary files:

- Create: `src/components/interaction/learning-object-spec.ts`
- Create: `src/components/interaction/learning-object-spec.test.ts`
- Create: `src/components/interaction/LearningObjectRenderer.tsx`
- Create: `src/components/interaction/LearningObjectRenderer.test.tsx`
- Modify: `src/components/interaction/InteractionRenderer.tsx`
- Modify: `src/components/interaction/InteractionRenderer.test.tsx`
- Modify: `src/components/visual/VisualRenderer.tsx`
- Modify: `src/renderers/PlaygroundProductView.tsx`
- Modify: `src/schemas/lesson.schema.ts`
- Modify: `skills/interaction-design/SKILL.md`
- Modify: `skills/visual-pedagogy/SKILL.md`

Prototype object kinds:

- `timeline`
- `comparison`
- `prediction`
- `debugging`
- `parameter_experiment`

Acceptance:

- At least three prototype learning objects render from a shared `LearningObjectSpec`.
- Each object has tests covering learner action and feedback behavior.
- Object feedback explains mechanism, not only correct/incorrect status.
- Objects degrade gracefully in static/export contexts.
- Quality Engine V2 can inspect object specs and flag missing learning goal, learner action, expected observation, or feedback rule.
- No domain-specific one-off widget becomes the default API.

## Parallel Execution Model

### Sprint 1: Contract First

Mainline:

- [x] Define Course IR versioned type and conversion from existing course pack/lesson bundle.
- [x] Add publish validation test cases for missing source evidence, missing feedback, missing page goal, and missing unit reference.
- [x] Add quality issue model with scope, severity, reason, and required fix.

Parallel A:

- [ ] Add feedback category and target-resolution fixture tests.
- [ ] Add `revisionBrief` type that can point to course/unit/page.

Parallel B:

- [ ] Add learner state persistence tests for current course/unit/page.
- [ ] Add feedback/revision history state shape without changing default UI yet.

Parallel C:

- [ ] Add `LearningObjectSpec` type tests.
- [ ] Add renderer tests for one low-risk prototype object.

Sprint 1 exit criteria:

- Mainline Course IR tests pass.
- Each pre-research line has at least one passing contract test.
- No pre-research line modifies default learner behavior without tests.

### Sprint 2: Runtime Integration

Mainline:

- [x] Write `course-ir`, `lesson-bundle`, and `publish-validation` artifacts from publish and deterministic draft flows.
- [x] Return compact publish validation status in learner-facing MCP responses.
- [x] Upgrade quality report builder to include page/unit/course issues.

Parallel A:

- [ ] Consume Course IR fixture to create targeted revision briefs.
- [ ] Keep revision patch application behind prototype tests.

Parallel B:

- [ ] Wire progress and feedback history into existing learner sidebar with no developer artifact language.
- [ ] Verify viewport-fit behavior still passes.

Parallel C:

- [ ] Add two more prototype objects.
- [ ] Add static/export fallback behavior.

Sprint 2 exit criteria:

- `npm run test:unit` passes.
- `npm run seed:check` passes.
- Mainline publish flow writes new artifacts without breaking preview.

### Sprint 3: Blocking Quality And Merge Readiness

Mainline:

- [x] Export blocks failed quality reports unless expert override reason exists.
- [x] MCP responses include compact quality issue summary.
- [x] Public fixture regression confirms source-backed courses remain `passed` or `warning`.

Parallel A:

- [ ] Produce `revisionQualityReport` fixture output.
- [ ] Confirm page-level feedback does not regenerate unrelated units in prototype tests.

Parallel B:

- [ ] Show learner-readable revision changes in progress/feedback state.
- [ ] Confirm refresh preserves learning position after generated preview load.

Parallel C:

- [ ] Ensure Quality Engine V2 can inspect learning object specs.
- [ ] Confirm decorative or feedback-free object specs fail quality checks.

Sprint 3 exit criteria:

- `npm run release:check` passes.
- Mainline B can merge as default behavior.
- Parallel A/B/C can merge only if behind stable contracts and not risky for the learner default path.

## Test Scheme

### Mainline B Tests

Run targeted tests during implementation:

```bash
npm run test:unit -- tools/agent-runtime/learner/course-ir.test.ts
npm run test:unit -- tools/agent-runtime/learner/publish-validation.test.ts
npm run test:unit -- tools/agent-runtime/quality/course-quality-report.test.ts
npm run test:unit -- tools/agent-runtime/learner/learning-course-publisher.test.ts
npm run test:unit -- tools/agent-runtime/learner/export-bundle-service.test.ts
```

Expected:

- Tests first fail when the new contract is missing.
- Tests pass after minimal implementation.
- Existing publisher and export tests still pass.

### Parallel A Tests

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/revision-targeting.test.ts
npm run test:unit -- tools/agent-runtime/learner/revision-brief.test.ts
npm run test:unit -- tools/agent-runtime/learner/learning-revision-service.test.ts
```

Expected:

- Feedback classification is deterministic.
- Target resolution is stable for page/unit/course feedback.
- Missing context asks one learner-facing clarification question.

### Parallel B Tests

Run:

```bash
npm run test:unit -- src/product/learning-progress.test.ts
npm run test:unit -- src/product/CourseWorkspace.test.tsx
npm run test:unit -- src/product/ProjectLibrary.test.tsx
npm run test:unit -- src/components/deck/ViewportFit.test.tsx
```

Expected:

- Progress survives refresh.
- Preview route opens directly into the course.
- Feedback and revision history are visible only in learner-facing terms.
- Viewport-fit tests remain green.

### Parallel C Tests

Run:

```bash
npm run test:unit -- src/components/interaction/learning-object-spec.test.ts
npm run test:unit -- src/components/interaction/LearningObjectRenderer.test.tsx
npm run test:unit -- src/components/interaction/InteractionRenderer.test.tsx
npm run test:unit -- tools/agent-runtime/quality/course-quality-report.test.ts
```

Expected:

- Learning objects validate required learning goal, action, observation, and feedback rules.
- Renderer handles supported objects and static fallback.
- Quality engine can flag decorative or feedback-free objects.

### Full Validation

Run before claiming any workstream complete:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:regression
npm run seed:check
npm run codex:mcp:check
npm run smoke:playwright
```

Run before merging to `main`:

```bash
npm run release:check
```

## Integration Gates

### Gate 1: Course IR Freeze

Required before Parallel A/B/C can consume the contract as non-fixture input:

- Course IR type is versioned.
- Course IR artifact is written by publish flow.
- Existing preview still loads.
- `npm run test:ci` passes.

### Gate 2: Quality Engine Freeze

Required before Revision and Learning Object prototypes can affect default flows:

- Quality issue model is stable.
- Failed quality status blocks export.
- Compact quality summary remains learner-facing.
- `npm run seed:check` passes.

### Gate 3: Parallel Merge Readiness

Required before each pre-research line merges:

- The line has its own targeted tests.
- The line does not create a competing schema.
- The line does not expose internal artifacts in learner mode.
- The line passes `npm run release:check` with the mainline.

## Milestone B Done Definition

Milestone B is complete when:

- Course IR and authoring contract are stable.
- Publish validation blocks malformed authored bundles.
- Quality Engine V2 returns actionable course/unit/page issues.
- Failed quality blocks export unless expert override is explicit.
- Public fixture courses remain `passed` or `warning`.
- Documentation and skills describe the new contract.
- `npm run release:check` passes on `main`.

## Pre-Research Done Definition

A parallel pre-research line is complete when:

- It proves the target contract with tests.
- It can be demoed with fixture data.
- It has an explicit merge or defer recommendation.
- It names the mainline contract it needs before becoming default.
- It does not require learner approval of internal artifacts.

## Recommended Branching

Use one branch per workstream:

```text
codex/milestone-b-course-ir-quality
codex/preresearch-feedback-revision-v2
codex/preresearch-learner-progress
codex/preresearch-learning-objects
```

Merge order:

1. `codex/milestone-b-course-ir-quality`
2. `codex/preresearch-feedback-revision-v2`
3. `codex/preresearch-learner-progress`
4. `codex/preresearch-learning-objects`

Parallel branches may be developed concurrently, but final merge order should preserve contract stability.
