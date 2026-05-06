# Product Mainline Development Spec

Date: 2026-05-06

## Purpose

This spec defines the serial product mainline for AI Interactive Learning Agent after the public beta quality checkpoint.

The mainline goal is to turn the current local Codex/MCP beta into a complete learning product kernel:

```text
natural-language learning request
  -> source graph
  -> course plan
  -> course IR
  -> source-grounded Chinese learning units
  -> quality/revision loop
  -> learner-facing preview/export
```

Parallel exploration tracks are intentionally not expanded here as execution commitments. They are recorded in `docs/product/parallel-exploration-backlog.md` so they remain searchable and can be promoted into future specs when the mainline is ready.

## Current Baseline

Baseline commit:

```text
2d53976 Build public beta quality path
```

Current verified product shape:

- React/Vite learning surface with course library, sidebar, web deck, source anchors, knowledge map entry points, preview loading, progress, feedback, and export surfaces.
- Local MCP server with learner-facing tools for project creation, authoring context, course generation, publish, preview, revision, export, and expert/operator workflows.
- Skills bundle for Codex-style operation, source routing, learner feedback revision, and runner/expert workflows.
- Clean generated preview runtime under `runs/<run-id>/preview`.
- Course quality report contract under runtime quality services.
- Public source regression for book, paper, patent, and blog fixtures.
- Release gate:

```bash
npm run release:check
```

## Product Mainline Definition

The serial mainline is the smallest ordered path that makes the product genuinely useful for real learners and seed users.

The mainline is not:

- another UI-only polish pass
- a generic slideshow builder
- a fully autonomous research assistant
- a cloud SaaS platform
- a complete LMS
- an arbitrary agent framework

The mainline is:

- reliable source understanding across long-form materials
- flexible course planning for different learning intents
- high-quality Chinese learning content authored through agent + MCP collaboration
- source-grounded claims and learner-readable evidence
- meaningful interactions, checks, feedback, and transfer tasks
- targeted revision from learner feedback
- a learner-facing browser experience that opens directly into study mode

## Product Acceptance Metrics

The product mainline is accepted when all required metrics below are met on a local checkout without private fixtures.

### Learner Operation

- A learner can start from Codex/Claude-style natural language and receive a preview URL without naming MCP tool names.
- The default learner path asks at most 3 clarification questions.
- The default learner path requires 0 approvals of internal artifacts such as `source-map`, `concept-map`, or `curriculum-plan`.
- The response after generation includes only:
  - preview URL
  - course structure summary
  - compact quality summary
  - next learner action
  - natural-language feedback prompt

### Source Coverage

- Public regression contains one fixture each for:
  - book
  - paper
  - patent
  - blog
- Each fixture produces a `sourceGraph` with:
  - source units
  - source anchors
  - concept candidates
  - examples
  - misconceptions
  - candidate interactions
  - source-type metadata
- Each generated page from source-backed fixtures has at least one source anchor or an explicit `inferred` / `analogy` / `background` evidence classification.
- Source evidence status is never `missing` in `npm run source:regression`.

### Course Planning

- The same source can be planned through:
  - `overview_plus_topic`
  - `chapter_guided`
  - `topic_guided`
  - `task_guided`
  - `hybrid`
- Long sources are planned as course packs with multiple units, not collapsed into a single 8-12 page lesson.
- The planner preserves chapter/section mapping even when the learning sequence is pedagogically reordered.
- Course plan output contains page budgets, learner level, course intent, unit goals, expected interactions, expected assessments, and source coverage expectations.

### Learning Quality

- Every generated course contains:
  - overview unit
  - at least one focused unit
  - visual explanation pages
  - at least one meaningful learner action per focused unit
  - at least one misconception check per course
  - at least one transfer task per course
  - explanatory feedback for assessments and interactions
- Main study pages fit the browser viewport and do not require vertical scrolling for the primary learning content.
- `qualityReport.status` is `passed` or `warning` for public fixture courses; `failed` blocks export unless explicitly overridden in expert mode.
- Quality report includes page-level required fixes when score is below threshold.

### Revision Loop

- Feedback such as `第 3 页太抽象` resolves to course, unit, page, and revision scope.
- Page-level feedback changes only the target page unless the critic determines a prerequisite or unit-level issue.
- Revision results include changed lessons, changed pages, before/after quality status, and preview URL.
- Applying revision re-runs source grounding, Chinese-first, interaction, assessment, and viewport-fit checks for changed content.

### Product Reliability

- `npm run release:check` passes.
- `npm run codex:mcp:check` passes.
- `npm run bundle:check` passes.
- `npm run source:regression` passes for all public fixture source types.
- README learner path and developer path remain distinct.
- Generated private/source-derived course content is not committed by default.

## Serial Mainline Slices

The slices below are intentionally ordered. Later slices may prototype behind flags, but they should not become the default product path before earlier acceptance gates are met.

### Slice 1: Source Graph V2

Goal:

Build a stronger source-understanding layer that works for books, papers, patents, blogs, notes, and folders.

Primary implementation areas:

- `tools/agent-runtime/source/`
- `tools/agent-runtime/learner/source-semantic-extractor.ts`
- `tools/agent-runtime/learner/real-source-regression.ts`
- `tools/agent-runtime/quality/source-evidence-analyzer.ts`
- `docs/runtime/source-type-acceptance.md`

Required outputs:

- `sourceGraph.json`
- `sourceAnchors.json`
- `sourceConcepts.json`
- `sourceCoverage.json`

Required source graph fields:

```ts
type SourceGraph = {
  runId: string;
  sourceKind: "book" | "paper" | "patent" | "blog" | "notes" | "folder" | "topic";
  sourceUnits: Array<{
    id: string;
    title: string;
    kind: "chapter" | "section" | "claim" | "figure" | "paragraph" | "heading" | "note" | "topic";
    order: number;
    anchorIds: string[];
  }>;
  concepts: Array<{
    id: string;
    label: string;
    sourceUnitIds: string[];
    prerequisiteIds: string[];
    exampleAnchorIds: string[];
    misconceptionIds: string[];
  }>;
  misconceptions: Array<{
    id: string;
    claim: string;
    correction: string;
    anchorIds: string[];
  }>;
  candidateInteractions: Array<{
    id: string;
    conceptId: string;
    kind: "prediction" | "stepper" | "comparison" | "parameter_experiment" | "debugging" | "build_from_parts";
    learnerAction: string;
    expectedObservation: string;
    anchorIds: string[];
  }>;
};
```

Acceptance:

- `npm run source:regression` writes source graph artifacts for all four public fixtures.
- Book fixture preserves chapter-level units.
- Paper fixture identifies problem, method, experiment, and conclusion sections when present.
- Patent fixture separates background, claims, embodiments, and figures when present.
- Blog fixture preserves heading hierarchy and argument flow.
- Source graph includes at least 5 concepts, 2 examples, 2 misconceptions, and 2 candidate interactions for each non-trivial fixture.

Stop conditions:

- Do not add network-only LLM judging to the release gate.
- Do not commit private source-derived artifacts.

### Slice 2: Course Planning V2

Goal:

Make course organization a first-class product capability instead of a fixed topic split.

Primary implementation areas:

- `tools/agent-runtime/learner/course-unit-planner.ts`
- `tools/agent-runtime/learner/authoring-context-service.ts`
- `tools/agent-runtime/natural-language/run-intent.ts`
- `skills/source-to-course/SKILL.md`
- `skills/learning-agent-operator/SKILL.md`
- `docs/runtime/run-config.schema.md`

Required outputs:

- `coursePlan.json`
- `unitPlan.json`
- `authoringContext.json`

Required strategies:

- `overview_plus_topic`
- `chapter_guided`
- `topic_guided`
- `task_guided`
- `hybrid`

Acceptance:

- Natural-language requests can specify source kind, audience, language, strategy, selected chapters/topics, and pages per unit.
- If a user does not specify strategy, the planner recommends a strategy and records the reason.
- Long source planning always creates an overview unit plus focused units unless the user explicitly asks for a single-unit output.
- Chapter-guided plans preserve chapter order.
- Topic-guided and hybrid plans preserve chapter references.
- Task-guided plans include scenario/task labels and transfer expectations.
- `coursePlan.json` includes acceptance expectations that downstream quality checks can enforce.

Stop conditions:

- Do not make planning dependent on a specific model provider.
- Do not hide unsupported source strategy choices; return a learner-readable limitation instead.

### Slice 3: Course IR And Authoring Contract

Goal:

Stabilize the intermediate representation that Codex, Claude, MCP tools, deterministic generators, and future specialist agents all consume.

Primary implementation areas:

- `src/schemas/course-pack.schema.ts`
- `src/schemas/lesson.schema.ts`
- `tools/agent-runtime/learner/bundle-authoring-guidance.ts`
- `tools/agent-runtime/learner/learning-course-publisher.ts`
- `tools/agent-runtime/learner/grounded-course-service.ts`
- `docs/runtime/artifact-contracts.md`
- `docs/runtime/codex-bundle-authoring.md`

Required outputs:

- `courseIR.json`
- `lessonBundle.json`
- `publishValidation.json`

Acceptance:

- Course IR can represent overview units, focused units, pending units, failed units, revised units, source evidence, and quality status.
- Authoring instructions tell the agent how to produce Chinese-first, source-grounded, viewport-fit learning content.
- Publish validation fails when required page fields, source evidence fields, or assessment feedback fields are missing.
- Deterministic generation remains available as smoke/draft path, but the recommended high-quality path is agent-authored content validated by MCP.
- Course IR has a version field and migration note for future breaking changes.

Stop conditions:

- Do not create a second incompatible lesson schema.
- Do not let frontend-only needs distort the source/course planning contract.

### Slice 4: Quality Engine V2

Goal:

Make quality control actionable enough that it can drive revision and block bad exports.

Primary implementation areas:

- `tools/agent-runtime/quality/`
- `tools/agent-runtime/learner/targeted-revision-service.ts`
- `tools/agent-runtime/learner/export-bundle-service.ts`
- `tools/mcp-server/runtime-tools.ts`
- `skills/lesson-critic/SKILL.md`

Required checks:

- source grounding
- Chinese-first
- course structure
- page structure
- viewport fit
- visual usefulness
- interaction purpose
- feedback quality
- misconception coverage
- transfer coverage
- learner-level fit

Acceptance:

- `CourseQualityReport` includes course, unit, lesson, and page-level status.
- Each failed check includes:
  - issue ID
  - affected course/unit/page
  - reason
  - required fix
  - severity
- Quality report can distinguish:
  - unsupported source claim
  - weak source anchor
  - generic page
  - decorative interaction
  - missing feedback mechanism
  - content too dense for viewport
  - learner-level mismatch
- Export is blocked by `failed` status unless expert mode passes an explicit override reason.

Stop conditions:

- Do not require external APIs for deterministic quality gates.
- Do not present large critic artifacts to learner-mode users by default.

### Slice 5: Feedback-To-Revision V2

Goal:

Turn natural-language learner feedback into targeted, source-grounded course improvement.

Primary implementation areas:

- `tools/agent-runtime/learner/revision-targeting.ts`
- `tools/agent-runtime/learner/learning-revision-service.ts`
- `tools/agent-runtime/learner/targeted-revision-service.ts`
- `src/product/learning-progress.ts`
- `src/product/CourseWorkspace.tsx`
- `skills/learner-feedback-revision/SKILL.md`

Required outputs:

- `revisionBrief.json`
- `revisionPatch.json`
- `revisionQualityReport.json`

Feedback categories:

- too abstract
- too dense
- example missing
- source unclear
- interaction weak
- feedback unhelpful
- too easy
- too hard
- wrong or suspicious claim
- wants more practice

Acceptance:

- Feedback with page references resolves to a page target.
- Feedback without page references resolves to current page or asks one learner-answerable clarification question.
- Revision keeps unchanged units stable.
- Revision records before/after page summaries and quality deltas.
- Changed pages preserve or improve source evidence status.
- Preview URL remains stable after revision when possible.

Stop conditions:

- Do not regenerate the whole course for page-level feedback unless the planner marks the issue as structural.
- Do not silently change source-grounded claims without source evidence.

### Slice 6: Learner Project And Progress Kernel

Goal:

Make the browser experience feel like a learning product rather than a one-off preview.

Primary implementation areas:

- `src/product/ProjectLibrary.tsx`
- `src/product/CourseWorkspace.tsx`
- `src/product/LearningSidebar.tsx`
- `src/product/learning-progress.ts`
- `src/product/generated-preview.ts`
- `tools/agent-runtime/learner/project-registry.ts`
- `tools/agent-runtime/learner/learning-preview-service.ts`

Required learner state:

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

- Opening the app shows a learner-facing product home, not a developer control surface.
- Generated preview links open directly into the course.
- Refresh preserves current course, unit, page, and completed page state.
- Sidebar contains learning functions without crowding the main page.
- Main page remains viewport-fit on common laptop and tablet widths.
- User can see what changed after revision in learner-readable language.

Stop conditions:

- Do not introduce account systems or cloud storage in this slice.
- Do not move internal artifacts into the main learner surface.

### Slice 7: Learning Object Runtime V1

Goal:

Upgrade from page-level components to reusable interactive learning objects.

Primary implementation areas:

- `src/components/interaction/`
- `src/components/visual/`
- `src/components/playground/`
- `src/renderers/PlaygroundProductView.tsx`
- `src/schemas/lesson.schema.ts`
- `skills/interaction-design/SKILL.md`
- `skills/visual-pedagogy/SKILL.md`

Required object contract:

```ts
type LearningObjectSpec = {
  id: string;
  kind: "timeline" | "flow" | "graph_path" | "comparison" | "parameter_experiment" | "debugging" | "build_from_parts";
  learningGoal: string;
  learnerAction: string;
  expectedObservation: string;
  feedbackRules: Array<{
    condition: string;
    feedback: string;
    misconceptionAddressed?: string;
  }>;
  sourceAnchorIds: string[];
};
```

Acceptance:

- At least 5 reusable learning objects exist.
- At least 3 source-backed public fixture courses use a learning object beyond static text/diagram rendering.
- Each object has tests covering learner action and feedback behavior.
- Quality engine can flag decorative or feedback-free objects.
- Objects degrade gracefully when rendered in static export.

Stop conditions:

- Do not build domain-specific one-off widgets when a generic object can serve the same learning purpose.
- Do not make animations that lack a cognitive purpose.

### Slice 8: Tutor And Teacher Minimum Product

Goal:

Add AI-native guidance modes after the source, plan, quality, revision, and learner kernels are stable.

Primary implementation areas:

- `src/renderers/TutorProductView.tsx`
- `src/renderers/TeacherProductView.tsx`
- `skills/learning-agent-operator/SKILL.md`
- `skills/assessment-design/SKILL.md`
- `skills/publish-package/SKILL.md`
- `tools/agent-runtime/learner/export-bundle-service.ts`

Tutor acceptance:

- Tutor can answer questions about the current page using source anchors and page content.
- Tutor can ask diagnostic questions based on current page learning goal.
- Tutor can turn learner confusion into a revision brief.
- Tutor response does not replace the visual page as the main learning experience.

Teacher acceptance:

- Teacher mode exports:
  - instructor notes
  - suggested pacing
  - classroom questions
  - common misconceptions
  - practice tasks
  - post-class review prompts
- Teacher materials reference the same course/unit/page IDs as the learner course.
- Export package includes teacher materials when requested.

Stop conditions:

- Do not make tutor mode default before source grounding and revision are reliable.
- Do not let tutor answers cite sources that are not present in the course/source graph.

## Mainline Dependency Map

```text
Source Graph V2
  -> Course Planning V2
    -> Course IR And Authoring Contract
      -> Quality Engine V2
        -> Feedback-To-Revision V2
          -> Learner Project And Progress Kernel
            -> Learning Object Runtime V1
              -> Tutor And Teacher Minimum Product
```

Parallel exploration can prototype beside this path only when it consumes the same Source Graph, Course Plan, Course IR, and Quality Report contracts.

## Release Milestones

### Milestone A: Real Source Planning Kernel

Includes:

- Slice 1
- Slice 2

Acceptance:

- `sourceGraph.json` and `coursePlan.json` are generated for book, paper, patent, and blog fixtures.
- Strategy selection is visible and test-covered.
- Existing release gate passes.

### Milestone B: High-Quality Authoring Kernel

Includes:

- Slice 3
- Slice 4

Acceptance:

- Agent-authored content contract is stable.
- Quality report blocks bad exports.
- Public fixture courses score `passed` or `warning`.
- Required fixes are page-level and actionable.

### Milestone C: Revision-Ready Learning Product

Includes:

- Slice 5
- Slice 6

Acceptance:

- Learner can open, study, refresh, provide feedback, apply revision, and continue.
- Revision changes are visible and quality-checked.
- Default experience is learner-facing.

### Milestone D: Interactive Product Differentiation

Includes:

- Slice 7
- Slice 8

Acceptance:

- Reusable interactive learning objects exist.
- Tutor and teacher modes are usable but grounded by the same source/course contracts.
- Export can include learner and teacher materials.

## Required Validation Commands

Run before claiming a mainline slice is complete:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:regression
npm run seed:check
npm run codex:mcp:check
npm run smoke:playwright
```

Run before release or public demo:

```bash
npm run release:check
```

Manual validation for each milestone:

1. Start the frontend with `npm run dev`.
2. Generate or load a public fixture course.
3. Open the preview URL.
4. Confirm the app opens in learner-facing study mode.
5. Navigate at least one overview unit and one focused unit.
6. Submit one page-level feedback item.
7. Apply revision.
8. Confirm the quality report and preview update.
9. Confirm no private/source-derived generated content is staged for commit.

## Documentation Updates Required With Each Slice

Each completed slice must update at least one of:

- `README.md`
- `docs/product/current-product-state.md`
- `docs/product/future-development-plan.md`
- `docs/runtime/source-type-acceptance.md`
- `docs/runtime/codex-user-trial-script.md`
- `docs/runtime/seed-user-guide.md`
- `docs/runtime/artifact-contracts.md`
- relevant `skills/*/SKILL.md`

## Risk Register

### Risk: Content Quality Remains Generic

Mitigation:

- Source Graph V2 must extract examples, misconceptions, and interaction candidates before authoring.
- Quality Engine V2 must flag generic pages and weak interactions.

### Risk: Learner Path Becomes Operator Workflow Again

Mitigation:

- Skill/MCP contract tests must keep artifact approval out of default learner instructions.
- Learner responses must summarize preview, quality, and next action only.

### Risk: Long Sources Become Too Slow

Mitigation:

- Course planning should generate overview first and defer focused units.
- Unit generation should be resumable and retryable.

### Risk: Source Grounding Blocks Useful Teaching Analogies

Mitigation:

- Evidence classification should distinguish direct support, inference, analogy, and background.
- Analogies are allowed when labeled and tied to a sourced concept.

### Risk: UI Work Outruns Kernel Stability

Mitigation:

- Canvas, playground, tutor, and teacher modes should consume shared Course IR.
- No exploration track becomes default until mainline contracts are stable.

## Done Definition For This Spec

This spec is complete when:

- It identifies the serial mainline.
- It defines measurable acceptance gates.
- It names implementation areas without forcing a premature file-by-file patch plan.
- It keeps parallel exploration outside the mainline execution commitment.
- It provides milestone-level validation commands.
- It is linked from the product roadmap documents.
