# Milestone C Feedback-To-Revision Design Spec

Date: 2026-05-06

## Purpose

Milestone C turns learner feedback into targeted, source-grounded course revision.

The learner should be able to say:

```text
第 3 页太抽象，换成一个工程例子
```

and the system should produce a revision brief that identifies the affected course, unit, lesson, page, feedback category, source constraints, expected change, and quality checks before Codex republishes the course.

This milestone is not a full autonomous editor. Codex or Claude still authors the revised `coursePack` and `lessons`; MCP provides targeting, revision briefs, preview state, quality gates, and learner-readable revision history.

## Baseline

Milestone B is already on `main`:

- Course IR V1 is written during publish.
- Publish validation blocks malformed course bundles.
- Quality reports expose structured `issues`, `issueSummary`, and `topIssues`.
- Export blocks failed quality unless a maintainer supplies `expertOverrideReason`.

Milestone C consumes those contracts.

## Product Goals

1. Learner feedback becomes targeted revision work, not a vague note.
2. Page-level feedback changes only the target page by default.
3. Unit/course feedback produces bounded instructions rather than regenerating everything automatically.
4. Source-backed revisions preserve existing `sourceAnchorIds` and grounding.
5. Revision output includes before/after quality status, changed lessons, changed pages, and preview URL.
6. Learner-facing UI state records feedback and revision history in non-developer language.

## Non-Goals

- No cloud storage or account system.
- No full autonomous rewriting of a long book.
- No new lesson schema competing with Lesson JSON or Course IR.
- No default learner approval of internal artifacts.
- No Tutor or Teacher mode implementation in this milestone.

## Feedback Categories

Milestone C must classify learner feedback into these categories:

```ts
type RevisionFeedbackCategory =
  | "too_abstract"
  | "too_dense"
  | "example_missing"
  | "source_unclear"
  | "interaction_weak"
  | "feedback_unhelpful"
  | "too_easy"
  | "too_hard"
  | "suspicious_claim"
  | "more_practice"
  | "structure_change"
  | "style_change";
```

Categories are used for routing and required checks. They do not replace the learner's raw feedback.

## Revision Target V2

The target model should resolve:

```ts
type RevisionTargetV2 = {
  scope: "course" | "unit" | "page" | "interaction" | "assessment" | "source" | "style";
  requestedChange: string;
  categories: RevisionFeedbackCategory[];
  confidence: "high" | "medium" | "low";
  clarificationQuestion?: string;
  courseId?: string;
  unitId?: string;
  lessonId?: string;
  pageId?: string;
  pageIndex?: number;
  pageNumber?: number;
};
```

Rules:

- Explicit page references such as `第 3 页` resolve to page scope.
- Focus/context may supply current `courseId`, `unitId`, `lessonId`, `pageId`, and `pageIndex`.
- If page feedback lacks both explicit page and current page context, return one learner-answerable `clarificationQuestion`.
- Unit/course/source/style keywords should resolve to the smallest clear scope.
- Category detection should be deterministic and local.

## Revision Brief V2

`learning_agent.revise_learning_course` should write:

```text
runs/<run-id>/learning-revisions/revision-00N.json
```

The brief should contain:

```ts
type RevisionBriefV2 = {
  schemaVersion: 2;
  runId: string;
  revisionId: string;
  feedback: string;
  focus?: string;
  target: RevisionTargetV2;
  currentPreview?: {
    localUrl: string;
    coursePackId: string;
    courseTitle: string;
    lessonCount: number;
  };
  currentCoursePackPath?: string;
  currentLessonPaths: string[];
  courseIRPath?: string;
  qualityReportPath?: string;
  sourceConstraints: {
    preserveSourceAnchors: boolean;
    allowInferredGrounding: boolean;
    sourceBacked: boolean;
  };
  revisionInstructions: string[];
  expectedQualityChecks: string[];
  previousFeedbackCount: number;
  createdAt: string;
};
```

## Apply Revision Result

`learning_agent.apply_learning_revision` should return:

```ts
type ApplyLearningRevisionResult = {
  status: "revision_applied";
  runId: string;
  revisionId: string;
  changedLessonIds: string[];
  changedPages: Array<{
    lessonId: string;
    pageId: string;
    pageIndex: number;
    changeSummary: string;
  }>;
  qualityBefore?: {
    status: "passed" | "warning" | "failed";
    score: number;
  };
  qualityAfter: {
    status: "passed" | "warning" | "failed";
    score: number;
  };
  preview: {
    localUrl: string;
    coursePackId: string;
    courseTitle: string;
    lessonCount: number;
  };
};
```

The current deterministic implementation may still append a revision note to the target page for tests. The contract must make changed scope visible so Codex can later replace that stub with real authored revision.

## Learner State

The browser-side learning progress state should add revision history:

```ts
type RevisionHistoryItem = {
  runId: string;
  revisionId: string;
  scope: "course" | "unit" | "page" | "interaction" | "assessment" | "source" | "style";
  summary: string;
  changedLessonIds: string[];
  changedPages: Array<{
    lessonId: string;
    pageId: string;
    pageNumber: number;
  }>;
  qualityStatus: "passed" | "warning" | "failed";
  createdAt: string;
};
```

This history is learner-facing. It should say what visibly changed, not expose raw artifact internals.

## Acceptance

- Feedback like `第 3 页太抽象` resolves to `scope=page`, `pageIndex=2`, `category=too_abstract`.
- Feedback like `这页来源依据不清楚` with current page context resolves to that page and category `source_unclear`.
- Feedback like `整体太难` resolves to course or unit scope with category `too_hard`.
- Ambiguous page-like feedback without page context returns one clarification question instead of guessing.
- Revision brief V2 includes source constraints, expected checks, Course IR path when available, and quality report path when available.
- Applying a page revision returns changed lesson IDs, changed page IDs, before/after quality status, and preview URL.
- Learner progress can store revision history and survives local storage reload.
- `npm run test:unit -- tools/agent-runtime/learner/revision-targeting.test.ts tools/agent-runtime/learner/learning-revision-service.test.ts tools/agent-runtime/learner/targeted-revision-service.test.ts src/product/learning-progress.test.ts` passes.
- `npm run seed:check` passes before merge.
