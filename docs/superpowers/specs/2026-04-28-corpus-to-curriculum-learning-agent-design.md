# Corpus-to-Curriculum Learning Agent Design

## Purpose

The project should evolve from a single-topic lesson generator into a source-grounded curriculum generator.

The future system should accept a corpus such as a paper, patent, book, lecture notes, technical documentation, article set, or user notes, then transform that corpus into a configurable set of learning products. A "learning product" can be an interactive web lesson, a whiteboard map, a playground, a quiz set, teacher notes, or a complete course pack.

The system must not simply summarize or paginate the source. It should reconstruct the material into visual, interactive, feedback-rich learning experiences that preserve traceability back to the original source.

## Scope

This spec defines the next system-level architecture direction. It does not implement file ingestion, PDF parsing, OCR, model API adapters, or an MCP server directly. Those will be planned in later implementation phases.

This spec supersedes the earlier implicit assumption that the primary input is one topic string. Topic-only runs remain supported as the smallest source type, but they are no longer the product boundary.

## Product Definition

The target product shape is:

```text
Source Corpus + User Learning Profile + Curriculum Planning Mode
  -> Source Map
  -> Concept Map
  -> Curriculum Plan
  -> Learning Units
  -> Output Products
```

A single corpus can produce multiple curriculum plans depending on the learner's level, reading habits, and goal.

Examples:

- A paper can become a 30-minute concept-first lesson, a replication-oriented technical walkthrough, or a teacher-facing seminar pack.
- A patent can become a claim-structure map, a technical mechanism lesson, or an invention-comparison exercise.
- A book chapter can become a chapter-following lesson, a concept dependency map, or a practice-focused assessment set.

## Input Model

The system should support these source forms over time:

- `topic`: a topic string, current MVP-compatible path.
- `text`: pasted or generated text.
- `file`: one local file such as Markdown, PDF, DOCX, PPTX, HTML, or source notes.
- `folder`: a local directory containing multiple source files.
- `url`: a web page or document URL.
- `mixed`: a structured collection of the above.

Each source item should be normalized into a source record:

```ts
export type SourceRecord = {
  id: string;
  type: "topic" | "text" | "file" | "folder" | "url";
  title: string;
  uri?: string;
  contentType?: string;
  language?: string;
  metadata?: Record<string, string | number | boolean>;
};
```

## Source Grounding

For papers, patents, books, and technical documents, the system must preserve source grounding.

Every extracted claim, concept, example, figure reference, or learning-unit dependency should be traceable to one or more source anchors.

```ts
export type SourceAnchor = {
  sourceId: string;
  anchorId: string;
  label: string;
  locator:
    | { kind: "page"; page: number; section?: string }
    | { kind: "heading"; headingPath: string[] }
    | { kind: "paragraph"; paragraphId: string }
    | { kind: "range"; start: string; end: string };
  quote?: string;
  notes?: string;
};
```

Grounding rules:

- Source facts must carry anchors.
- Teaching analogies must be marked as analogies, not source facts.
- Generated transfer tasks may be unanchored, but they must point back to the source concept they transfer from.
- If the system infers a concept not explicitly named in the source, the artifact should mark it as `inferred`.
- Coverage validation should check whether required source chapters, claims, sections, or concepts are represented.

## User Learning Profile

The user should be able to choose how the corpus is transformed.

```ts
export type UserLearningProfile = {
  level: "beginner" | "basic" | "intermediate" | "advanced" | "expert";
  readingHabit:
    | "follow_original"
    | "visual_first"
    | "case_first"
    | "practice_first"
    | "quick_overview"
    | "deep_dive";
  goal:
    | "understand"
    | "teach"
    | "implement"
    | "replicate_research"
    | "prepare_exam"
    | "evaluate_patent"
    | "custom";
  timeBudgetMinutes?: number;
  preferredUnitCount?: number;
  preferredPageCountPerUnit?: number;
  notes?: string;
};
```

Defaults for this project:

- `level`: `basic`
- `readingHabit`: `visual_first`
- `goal`: `understand`
- `preferredPageCountPerUnit`: user-specified when available, otherwise 8 to 12
- `outputLanguage`: `zh-CN` unless explicitly overridden

## Curriculum Planning Modes

The system should make learning path strategy explicit and user-selectable.

```ts
export type CurriculumPlanningMode =
  | "chapter_guided"
  | "concept_guided"
  | "task_guided"
  | "hybrid";
```

### `chapter_guided`

Preserve the original chapter, section, claim, or document order.

Use when:

- The user wants to read with the source.
- A book or syllabus already has a meaningful progression.
- The output must map closely to original chapters.

Tradeoff:

- Strong traceability and reading comfort.
- May inherit weak pedagogical order from the source.

### `concept_guided`

Rebuild the sequence from concept dependencies, difficulty, and mental-model construction.

Use when:

- The source is dense or non-teaching-oriented.
- The user wants faster understanding.
- Papers or patents need conceptual reconstruction.

Tradeoff:

- Better learning path.
- Requires clear source anchors so users can trace back to the original order.

### `task_guided`

Organize units around a concrete goal.

Examples:

- "I want to reproduce the paper method."
- "I want to teach this in a 90-minute class."
- "I want to implement the algorithm."
- "I want to compare this patent against prior art."

Tradeoff:

- Most action-oriented.
- May omit source parts that are irrelevant to the task unless coverage constraints require them.

### `hybrid`

Keep both tracks:

- Preserve a source chapter map.
- Build a pedagogical concept map.
- Generate learning units in an order chosen for the learner profile.
- Attach source anchors and chapter coverage to each unit.

Use when:

- The user wants learning effectiveness without losing the original structure.
- The corpus is long or heterogeneous.
- The system needs a robust default.

Recommended default:

```text
hybrid
```

The default should not force all users into concept-first learning. The UI, CLI, and future MCP tools should expose the mode so users can choose based on their knowledge level and reading habit.

## Core Artifacts

### Source Map

The source map preserves original structure.

```ts
export type SourceMap = {
  corpusId: string;
  sources: SourceRecord[];
  structure: SourceNode[];
  anchors: SourceAnchor[];
  extractionNotes: string[];
};

export type SourceNode = {
  id: string;
  sourceId: string;
  type: "document" | "chapter" | "section" | "claim" | "figure" | "table" | "paragraph";
  title: string;
  anchorIds: string[];
  children?: SourceNode[];
};
```

### Concept Map

The concept map captures teaching-relevant knowledge structure.

```ts
export type ConceptMap = {
  concepts: ConceptNode[];
  dependencies: ConceptEdge[];
  misconceptions: MisconceptionCandidate[];
  examples: ExampleCandidate[];
};

export type ConceptNode = {
  id: string;
  label: string;
  description: string;
  difficulty: "intro" | "core" | "advanced";
  sourceAnchorIds: string[];
  inferred?: boolean;
};

export type ConceptEdge = {
  from: string;
  to: string;
  relation: "prerequisite" | "enables" | "contrasts" | "part_of" | "applies_to";
  sourceAnchorIds: string[];
};

export type MisconceptionCandidate = {
  id: string;
  statement: string;
  correction: string;
  conceptIds: string[];
  sourceAnchorIds: string[];
  inferred?: boolean;
};

export type ExampleCandidate = {
  id: string;
  title: string;
  description: string;
  conceptIds: string[];
  sourceAnchorIds: string[];
  kind: "source_example" | "teaching_analogy" | "transfer_example";
};
```

### Curriculum Plan

The curriculum plan is the bridge between source structure and generated units.

```ts
export type CurriculumPlan = {
  id: string;
  corpusId: string;
  mode: CurriculumPlanningMode;
  userProfile: UserLearningProfile;
  coveragePolicy: CoveragePolicy;
  units: LearningUnitPlan[];
  sourceCoverage: SourceCoverageItem[];
  conceptCoverage: ConceptCoverageItem[];
  rationale: string[];
};

export type SourceCoverageItem = {
  sourceNodeId: string;
  status: "covered" | "partially_covered" | "omitted";
  unitIds: string[];
  reason?: string;
};

export type ConceptCoverageItem = {
  conceptId: string;
  status: "covered" | "partially_covered" | "omitted";
  unitIds: string[];
  reason?: string;
};

export type CoveragePolicy = {
  requiredCoverage: "all_source" | "selected_sections" | "core_concepts" | "goal_relevant";
  allowOmission: boolean;
  omissionRules: string[];
};

export type LearningUnitPlan = {
  id: string;
  title: string;
  purpose: string;
  targetPageCount: number;
  sourceAnchorIds: string[];
  conceptIds: string[];
  outputProducts: Array<"web_lesson" | "whiteboard_map" | "playground" | "assessment" | "teacher_notes">;
};
```

### Learning Unit

The current `Lesson` object becomes one output product within a larger learning unit.

```ts
export type LearningUnit = {
  id: string;
  title: string;
  planId: string;
  sourceAnchorIds: string[];
  conceptIds: string[];
  lesson?: Lesson;
  whiteboardMap?: unknown;
  playgroundSpec?: unknown;
  assessmentSet?: unknown;
  teacherNotes?: unknown;
};
```

## Agent Role Evolution

Current roles should evolve as follows.

### `source-ingest` -> `corpus-ingest`

Responsibilities:

- Normalize input sources.
- Extract source structure.
- Create source anchors.
- Detect language and content type.
- Identify extraction gaps.

Output:

- `source-map`
- `raw-extraction-report`

### New `concept-mapper`

Responsibilities:

- Extract concepts, prerequisites, examples, misconceptions, and dependency edges.
- Mark inferred concepts.
- Attach source anchors.

Output:

- `concept-map`

### New `curriculum-planner`

Responsibilities:

- Apply `CurriculumPlanningMode`.
- Apply `UserLearningProfile`.
- Produce a multi-unit plan.
- Record coverage and omissions.

Output:

- `curriculum-plan`

### Existing generation roles

The existing roles become unit-level roles:

- `learning-architecture`
- `visual-pedagogy`
- `interaction-design`
- `assessment-design`
- `lesson-assembly`
- `lesson-critic`
- `publish-package`

They should consume a `LearningUnitPlan`, not only a raw topic.

## Runtime Flow

Future flow:

```text
init_run
  -> ingest_corpus
  -> approve source-map
  -> map_concepts
  -> approve concept-map
  -> plan_curriculum
  -> approve curriculum-plan
  -> generate unit artifacts
  -> approve unit lesson / maps / assessments
  -> publish course pack
```

Approval gates should remain explicit. A user may approve source extraction but revise curriculum mode, or approve curriculum structure but revise one unit.

## MCP Tool Direction

The future MCP server should wrap the same runtime core rather than duplicating orchestration logic.

Proposed tools:

```text
learning_agent.init_run
learning_agent.add_source
learning_agent.ingest_corpus
learning_agent.inspect_source_map
learning_agent.map_concepts
learning_agent.plan_curriculum
learning_agent.generate_unit
learning_agent.submit_artifact
learning_agent.approve
learning_agent.request_revision
learning_agent.validate_coverage
learning_agent.promote
learning_agent.export_course_pack
```

The current CLI commands can map to a subset of these tools.

## UI Direction

The future product UI should expose strategy, not hide it.

Required controls:

- Source input: topic, file, folder, URL, pasted text, mixed corpus.
- Planning mode selector: chapter-guided, concept-guided, task-guided, hybrid.
- Learning profile selector: level, habit, goal, time budget.
- Coverage policy selector.
- Unit list with source coverage and concept coverage.
- Approval screens for source map, concept map, curriculum plan, and unit artifacts.

The UI should avoid presenting all modes as abstract labels only. Each mode should explain when it is useful.

## Quality Gates

Before a generated course pack is considered complete:

- Source map exists for all supplied source items.
- Source anchors exist for key source-derived claims.
- Concept map has no unanchored source facts.
- Curriculum plan declares its mode and coverage policy.
- Each learning unit lists source anchors and concept ids.
- Unit lessons preserve requested page count.
- Assessments cover recall, prediction, misconception, and transfer.
- Critic reports identify unsupported claims, missing coverage, and weak interactions.

## Migration From Current System

The current system already has useful foundations:

- `RunConfig`
- `RunStore`
- `ArtifactStore`
- `ApprovalService`
- `AgentWorkflow`
- `mock` adapter
- `codex-manual` adapter
- `agent:submit`
- `LessonPromotionService`

Migration phases:

### Phase A: Extend Run Config

Add:

- `sources`
- `userLearningProfile`
- `curriculumPlanningMode`
- `coveragePolicy`

Keep `topic` as shorthand for a one-item topic source.

### Phase B: Add Corpus Artifacts

Add artifact ids:

- `source-map`
- `concept-map`
- `curriculum-plan`

Add gates:

- `source-map`
- `concept-map`
- `curriculum-plan`

### Phase C: Unit-Level Generation

Teach existing unit generation roles to consume a selected `LearningUnitPlan`.

### Phase D: Course Pack Export

Promote multiple units and package them as a course, not just one lesson.

### Phase E: MCP Server

Expose the same flow through MCP tools.

## Non-Goals For The Next Implementation Slice

The next implementation slice should not attempt to solve everything.

Out of scope for the immediate next slice:

- Full PDF OCR.
- Commercial ebook DRM handling.
- Direct provider API adapters.
- Full visual editor.
- Automatic legal evaluation of patents.
- Multi-user hosted backend.

The recommended next implementation slice is:

```text
Extend run config and artifact contracts for corpus/profile/mode,
then implement a mock/codex-manual source-map -> concept-map -> curriculum-plan flow.
```

That slice moves the architecture toward the final product without prematurely building source parsers or topic-specific visual components.
