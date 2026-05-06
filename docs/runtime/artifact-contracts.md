# Artifact Contracts

## Purpose

Artifacts are the durable handoff format for the multi-agent learning-experience workflow. They make the run resumable, reviewable, and portable across Codex, Claude Code, Gemini CLI, custom runners, or manual execution.

Phase 0 defines the artifact contracts in Markdown with JSON examples. It does not add schema validators, orchestration commands, or renderer implementation.

## Recommended Run Directory Layout

```text
runs/
  database-index-001/
    run.config.json
    approvals/
      source-map.approved.json
      concept-map.approved.json
      curriculum-plan.approved.json
      learning-architecture.approved.json
      lesson.approved.json
      critic-report.approved.json
      publish-package.approved.json
    artifacts/
      source-ingest.v1.json
      source-ingest.draft.json
      source-graph.v1.json
      source-graph.draft.json
      source-anchors.v1.json
      source-anchors.draft.json
      source-concepts.v1.json
      source-concepts.draft.json
      source-coverage.v1.json
      source-coverage.draft.json
      course-plan.v1.json
      course-plan.draft.json
      unit-plan.v1.json
      unit-plan.draft.json
      authoring-context.v1.json
      authoring-context.draft.json
      learning-architecture.v1.json
      learning-architecture.draft.json
      learning-architecture.approved.json
      visual-plan.v1.json
      visual-plan.draft.json
      interaction-plan.v1.json
      interaction-plan.draft.json
      assessment-plan.v1.json
      assessment-plan.draft.json
      lesson.v1.json
      lesson.draft.json
      lesson.approved.json
      course-ir.v1.json
      course-ir.draft.json
      lesson-bundle.v1.json
      lesson-bundle.draft.json
      publish-validation.v1.json
      publish-validation.draft.json
      critic-report.v1.json
      critic-report.draft.json
      critic-report.approved.json
      publish-package.v1.json
      publish-package.draft.json
      publish-package.approved.json
    quality/
      course-quality-report.json
    logs/
      orchestration.md
      runtime-events.jsonl
    exports/
      web-deck/
```

Durable reviewed artifacts are versioned. Draft and approved aliases are explicit:

```text
artifacts/
  lesson.v1.json
  lesson.draft.json
  lesson.approved.json
```

Alias meanings:

- `artifacts/<artifact-id>.draft.json` may copy or point to the latest draft version.
- `artifacts/<artifact-id>.approved.json` may copy or point to the latest approved version.
- Plain aliases such as `artifacts/<artifact-id>.json` are forbidden inside `runs/<run-id>/artifacts/` because they do not encode draft or approval status.

Approval-gated inputs must use one of these forms:

```text
artifacts/<artifact-id>.vN.json
artifacts/<artifact-id>.approved.json
```

For an exact versioned file to count as approved, it must match the `approvedArtifact` recorded in `approvals/<gate-id>.approved.json`. Draft aliases are never valid for approval-gated inputs. Role outputs create versioned drafts such as `artifacts/lesson.v2.json`; the runtime may then update `artifacts/lesson.draft.json` and record that alias movement in `logs/orchestration.md`.

## Artifact Filenames And Purpose

| File | Purpose |
| --- | --- |
| `run.config.json` | Source of truth for topic, source, audience, page count, runtime, models, and approval gates. |
| `artifacts/source-map.vN.json` | Source structure, anchors, chapter/section/claim nodes, extraction notes, and extraction warnings for a source or corpus. |
| `artifacts/source-map.draft.json` | Optional alias for the latest source-map draft. |
| `artifacts/source-map.approved.json` | Optional alias for the approved source-map artifact. |
| `artifacts/concept-map.vN.json` | Concepts, dependencies, examples, misconceptions, and source anchor links extracted from the source map. |
| `artifacts/concept-map.draft.json` | Optional alias for the latest concept-map draft. |
| `artifacts/concept-map.approved.json` | Optional alias for the approved concept-map artifact. |
| `artifacts/curriculum-plan.vN.json` | Course-pack strategy, overview/topic/chapter unit plan, source coverage, concept coverage, and rationale. |
| `artifacts/curriculum-plan.draft.json` | Optional alias for the latest curriculum-plan draft. |
| `artifacts/curriculum-plan.approved.json` | Optional alias for the approved curriculum-plan artifact. |
| `artifacts/source-ingest.vN.json` | Concepts, dependencies, examples, misconceptions, and candidate interactions extracted from source. |
| `artifacts/source-ingest.draft.json` | Optional alias for the latest source-ingest draft. |
| `artifacts/source-graph.vN.json` | Source Graph V2: source units, anchors, concept candidates, examples, misconceptions, candidate interactions, and coverage metadata. |
| `artifacts/source-graph.draft.json` | Optional alias for the latest source-graph draft. |
| `artifacts/source-anchors.vN.json` | Normalized source anchors and sourceAnchorIds used by source-backed authoring. |
| `artifacts/source-concepts.vN.json` | Concepts, examples, misconceptions, and candidate interactions derived from the source graph. |
| `artifacts/source-coverage.vN.json` | Source graph coverage counts and source unit mapping. |
| `artifacts/course-plan.vN.json` | Course Planning V2 output with effective strategy, strategy reason, unit recommendations, and acceptance expectations. |
| `artifacts/unit-plan.vN.json` | Unit-level plan with source anchors, expected interactions, expected assessments, transfer expectations, and source coverage expectations. |
| `artifacts/authoring-context.vN.json` | Context returned by `learning_agent.get_authoring_context` for Codex-authored course bundles. |
| `artifacts/learning-architecture.vN.json` | Audience assumptions, prerequisites, objectives, planned page count, and page sequence. |
| `artifacts/learning-architecture.draft.json` | Optional alias for the latest learning-architecture draft. |
| `artifacts/learning-architecture.approved.json` | Optional alias for the approved learning-architecture artifact. |
| `artifacts/visual-plan.vN.json` | Visual strategy for each page that needs a diagram, animation, comparison, or state view. |
| `artifacts/visual-plan.draft.json` | Optional alias for the latest visual-plan draft. |
| `artifacts/interaction-plan.vN.json` | Meaningful learner actions, expected observations, feedback, and misconception targets. |
| `artifacts/interaction-plan.draft.json` | Optional alias for the latest interaction-plan draft. |
| `artifacts/assessment-plan.vN.json` | Recall, prediction, misconception, and transfer checks with answer and feedback contracts. |
| `artifacts/assessment-plan.draft.json` | Optional alias for the latest assessment-plan draft. |
| `artifacts/lesson.vN.json` | Assembled renderer-ready lesson object. |
| `artifacts/lesson.draft.json` | Optional alias for the latest lesson draft. |
| `artifacts/lesson.approved.json` | Optional alias for the approved lesson artifact. |
| `artifacts/course-ir.vN.json` | Course IR V1: versioned intermediate representation shared by publishing, revision, export, and future learning-object runtimes. |
| `artifacts/course-ir.draft.json` | Alias for the latest Course IR draft written by `publish_learning_course` or deterministic draft publishing. |
| `artifacts/lesson-bundle.vN.json` | Normalized `coursePack` plus `lessons` payload submitted for publishing. |
| `artifacts/lesson-bundle.draft.json` | Alias for the latest normalized publish bundle. |
| `artifacts/publish-validation.vN.json` | Machine-readable publish validation result for missing unit references, page goals, source support, and assessment feedback. |
| `artifacts/publish-validation.draft.json` | Alias for the latest publish validation result. |
| `artifacts/critic-report.vN.json` | Review report with strengths, issues, required fixes, and optional improvements. |
| `artifacts/critic-report.draft.json` | Optional alias for the latest critic-report draft. |
| `artifacts/critic-report.approved.json` | Optional alias for the approved critic-report artifact. |
| `artifacts/publish-package.vN.json` | Final packaging record, promoted paths, verification commands, and known constraints. |
| `artifacts/publish-package.draft.json` | Optional alias for the latest publish-package draft. |
| `artifacts/publish-package.approved.json` | Optional alias for the approved publish-package artifact. |
| `logs/orchestration.md` | Human-readable record of major decisions, approvals, revisions, and blockers. |
| `logs/runtime-events.jsonl` | Structured event stream for runtime adapters that support event logging. |
| `quality/course-quality-report.json` | Course-level quality report with compact learner status plus structured course/unit/lesson/page issues for targeted revision. |
| `approvals/*.approved.json` | Operator approval records for configured gates. |
| `exports/<target-output>/` | Generated or packaged output for preview, sharing, or deployment. |

## Canonical Approval Gates

Phase 0 uses seven canonical approval gate ids. Each gate approves an exact versioned artifact.

| Gate id | Approval file | Approved artifact |
| --- | --- | --- |
| `source-map` | `approvals/source-map.approved.json` | `artifacts/source-map.vN.json`; may update `artifacts/source-map.approved.json` |
| `concept-map` | `approvals/concept-map.approved.json` | `artifacts/concept-map.vN.json`; may update `artifacts/concept-map.approved.json` |
| `curriculum-plan` | `approvals/curriculum-plan.approved.json` | `artifacts/curriculum-plan.vN.json`; may update `artifacts/curriculum-plan.approved.json` |
| `learning-architecture` | `approvals/learning-architecture.approved.json` | `artifacts/learning-architecture.vN.json`; may update `artifacts/learning-architecture.approved.json` |
| `lesson` | `approvals/lesson.approved.json` | `artifacts/lesson.vN.json`; may update `artifacts/lesson.approved.json` |
| `critic-report` | `approvals/critic-report.approved.json` | `artifacts/critic-report.vN.json`; may update `artifacts/critic-report.approved.json` |
| `publish-package` | `approvals/publish-package.approved.json` | `artifacts/publish-package.vN.json`; may update `artifacts/publish-package.approved.json` |

Other artifacts may still be reviewed by the operator, but these seven ids are the canonical Phase 0 approval gates unless a later orchestration contract expands them.

## Course Pack Planning

For source-backed runs, `curriculum-plan` should include a `coursePack` object. The default strategy is `overview_plus_topic`: create one overview unit, then split core topic units while preserving the original source mapping.

The learner-facing MCP path now also writes Source Graph V2 and Course Planning V2 artifacts during `get_authoring_context` and deterministic grounded generation. These artifacts are audit and quality inputs, not default learner approval gates. In normal learner mode, Codex should summarize the course shape and quality report instead of asking the learner to inspect these internal files.

Publishing now also writes Course IR and validation artifacts. These are stable machine contracts for agent runtimes and should not become default learner approval gates:

```text
runs/<run-id>/artifacts/course-ir.vN.json
runs/<run-id>/artifacts/lesson-bundle.vN.json
runs/<run-id>/artifacts/publish-validation.vN.json
runs/<run-id>/quality/course-quality-report.json
```

`course-quality-report.json` includes `issues[]` and `issueSummary`. Each issue must carry `issueId`, `scope`, `severity`, `category`, `reason`, and `requiredFix`; page-level issues should also include `lessonId` and `pageId`. Learner-facing MCP responses should expose only the compact `qualityReport` summary, including `issueSummary` and `topIssues`, unless the user asks for expert details.

Source Graph V2 minimal shape:

```json
{
  "runId": "agentic-design-book",
  "sourceKind": "book",
  "sourceUnits": [
    {
      "id": "source-001:chapter-1",
      "title": "第 1 章 Agent Loop",
      "kind": "chapter",
      "role": "chapter",
      "order": 1,
      "anchorIds": ["source-001:chapter-1"]
    }
  ],
  "concepts": [
    {
      "id": "concept-01",
      "label": "全局地图",
      "sourceUnitIds": ["source-001:chapter-1"],
      "sourceAnchorIds": ["source-001:chapter-1"],
      "prerequisiteIds": [],
      "exampleAnchorIds": ["source-001:chapter-1"],
      "misconceptionIds": ["summary-understanding"]
    }
  ],
  "candidateInteractions": [
    {
      "id": "predict-source-support",
      "conceptId": "concept-01",
      "kind": "prediction",
      "learnerAction": "先预测一个解释最可能由哪段来源支持",
      "expectedObservation": "系统展示预测锚点和真实锚点的差异，帮助学习者建立来源定位能力。"
    }
  ],
  "coverage": {
    "anchorCount": 12,
    "sourceUnitCount": 5,
    "conceptCount": 5,
    "misconceptionCount": 2,
    "candidateInteractionCount": 2
  }
}
```

Course Planning V2 minimal shape:

```json
{
  "coursePlan": {
    "strategy": "overview_plus_topic",
    "strategyReason": "先给总览课，再按核心 topic 拆课，适合大多数长资料学习路径。",
    "unitPages": 8,
    "acceptanceExpectations": [
      {
        "id": "overview-plus-focused-units",
        "scope": "course",
        "required": true,
        "description": "长资料默认包含一个总览单元和至少两个 focused units。"
      }
    ],
    "recommendedUnits": [
      {
        "unitId": "unit-topic-01",
        "kind": "topic",
        "expectedInteractions": ["prediction", "comparison"],
        "expectedAssessments": ["misconception_check", "transfer_challenge"],
        "transferExpectation": "把该概念迁移到一个新的技术资料或实践场景。"
      }
    ]
  }
}
```

Minimal shape:

```json
{
  "coursePack": {
    "id": "agentic-design-book-course-pack",
    "title": "Agent Workflow Patterns：课程包",
    "sourceKind": "book",
    "strategy": "overview_plus_topic",
    "overviewUnitId": "unit-overview",
    "units": [
      {
        "id": "unit-overview",
        "title": "总览课",
        "kind": "overview",
        "targetPageCount": 12,
        "sourceAnchorIds": ["source-001:chapter-01"],
        "chapterRefs": ["Chapter 1"],
        "conceptIds": ["routing", "planning"],
        "outputProducts": ["web_lesson", "assessment"]
      }
    ],
    "chapterMapping": [
      {
        "chapterId": "source-001:chapter-01",
        "title": "Chapter 1",
        "unitIds": ["unit-overview"],
        "anchorIds": ["source-001:chapter-01"]
      }
    ]
  }
}
```

`source-map` artifacts should also include `extractionWarnings` whenever source fidelity is limited. Examples include unavailable PDF text extraction, unsupported file formats, URL fetch failures, or skipped folder files. Warnings must be explicit so downstream curriculum and lesson artifacts can distinguish source-backed facts from placeholders or inferred teaching structure.

The local source normalizer currently supports:

- topic anchors for topic-only runs
- text and markdown headings plus paragraph anchors
- paper sections such as abstract, method, results, limitations, references, figures, and tables
- patent claims, figures, background/prior-art headings, implementation headings, and embodiment headings when present in text
- local HTML heading and paragraph extraction
- URL HTML/text fetch when the runtime can access the URL
- folder expansion for supported `.txt`, `.md`, `.markdown`, `.html`, `.htm`, and `.pdf` files, with explicit warnings for unsupported child files
- PDF page and paragraph anchors through local `python3` + `pypdf` when available, with paragraph-fragment merging for readable evidence anchors
- PDF page-level fallback anchors with an explicit `pdf-text-extraction-unavailable` warning when full text extraction is unavailable

After approval, a runtime may either:

- select one unit into `run.config.json:selectedUnit`, invalidate artifacts after `curriculum-plan`, and continue the same run; or
- spawn child runs for one or all units, seeding the approved `source-map`, `concept-map`, and `curriculum-plan` so each child run starts from unit-level learning design.

Current CLI commands:

```bash
npm run agent:units -- --run <run-id>
npm run agent:select-unit -- --run <run-id> --unit <unit-id>
npm run agent:course -- --run <run-id> --all true
npm run agent:spawn-units -- --run <run-id> --all true
npm run agent:run-units -- --run <run-id> --all true
npm run agent:promote-units -- --run <run-id> --all true
```

`course` is the high-level orchestration command for Codex-style natural language control. It ensures selected child runs exist, advances them until the next non-draft-writing boundary, and returns next actions.

`run-units` advances each child run until the first non-draft-writing boundary: `manual_action_required`, `approval_required`, `complete`, or a configured step limit.

`promote-units` expects each selected child run to have an approved `lesson`. It promotes those lessons and writes:

```text
src/course-packs/<run-id>/coursePack.ts
```

The frontend course pack registry auto-discovers this manifest and maps unit entries to promoted lessons.

## Promotion Path

Run artifacts are working products. Product examples and renderer source files are promoted from approved run artifacts.

Recommended promotion flow:

```text
runs/<run-id>/artifacts/lesson.vN.json
  -> examples/<lesson-id>/lesson.json
  -> src/lessons/<lesson-id>/lesson.json or src/lessons/<lesson-id>/lesson.ts
```

Renderer implementation files should be promoted or created under:

```text
src/lessons/<lesson-id>/
src/components/
src/renderers/
```

Example package files should be promoted under:

```text
examples/<lesson-id>/
```

Rules:

- Approved artifacts are the source for promotion.
- Generated build output is not the source of truth.
- Promotion should preserve the originating `runId` in lesson metadata or package metadata.
- If renderer constraints require content changes, create a new artifact version before promotion.

## Versioning Rules

- Artifact versions use `v1`, `v2`, `v3`, increasing by one for each material revision.
- Versioned artifacts are immutable once reviewed or approved.
- Minor spelling or formatting fixes that do not change meaning may update the draft alias before approval.
- Any change to objectives, page order, interaction behavior, assessment answers, or technical claims creates a new versioned artifact.
- Critic reports reference the artifact version they reviewed.
- Approval records reference the exact version approved.

Recommended metadata fields for versioned artifacts:

```json
{
  "artifactId": "lesson",
  "artifactVersion": "v1",
  "runId": "database-index-001",
  "createdByRole": "lesson-assembly",
  "basedOn": [
    "learning-architecture.v1.json",
    "visual-plan.v1.json",
    "interaction-plan.v1.json",
    "assessment-plan.v1.json"
  ]
}
```

## Approval Gate Artifacts

Approval gates are file-backed decisions. They allow an interactive run to be paused, resumed, or continued by a different runtime.

Recommended approval artifact shape:

```json
{
  "gate": "learning-architecture",
  "runId": "database-index-001",
  "approvedArtifact": "artifacts/learning-architecture.v1.json",
  "decision": "approved",
  "operatorNotes": "Use the 10-page sequence for the Web Deck renderer MVP.",
  "decidedAt": "2026-04-27T00:00:00Z"
}
```

Supported `decision` values:

- `approved`
- `approved_with_notes`
- `revision_requested`
- `rejected`

If a revision is requested, the next agent run should produce a new artifact version and a new approval record should reference that version.

## Minimal JSON Examples

### `source-ingest`

```json
{
  "artifactId": "source-ingest",
  "artifactVersion": "v1",
  "runId": "database-index-001",
  "concepts": [
    {
      "id": "full-table-scan",
      "label": "Full table scan",
      "description": "The database may inspect many or all rows when no useful index narrows the search."
    },
    {
      "id": "index-lookup",
      "label": "Index lookup",
      "description": "A useful index narrows the search space before fetching matching rows."
    }
  ],
  "dependencies": [
    {
      "from": "table-rows",
      "to": "full-table-scan",
      "relationship": "Learners must know a table contains rows before reasoning about scanning rows."
    }
  ],
  "examples": [
    {
      "id": "email-query",
      "description": "Find one user by email in a table with ten million rows."
    }
  ],
  "misconceptions": [
    {
      "id": "indexes-always-help",
      "claim": "Indexes always make every query faster."
    }
  ],
  "candidateInteractions": [
    {
      "id": "choose-query-condition",
      "description": "Learner selects a query condition and predicts whether the database uses an index."
    }
  ]
}
```

### `learning-architecture`

```json
{
  "artifactId": "learning-architecture",
  "artifactVersion": "v1",
  "runId": "database-index-001",
  "audience": "Learners who understand basic tables and SQL SELECT queries",
  "prerequisites": ["Tables contain rows and columns", "A WHERE clause filters rows"],
  "learningObjectives": [
    "Explain why an index can reduce the number of rows inspected.",
    "Predict when a query can use an index.",
    "Describe read benefits and write or storage costs of indexes."
  ],
  "pageCount": {
    "target": 10,
    "min": 8,
    "max": 12,
    "planned": 10
  },
  "pageSequence": [
    {
      "pageId": "p01-problem",
      "type": "problem_scene",
      "learningGoal": "Feel the cost of searching ten million rows without a narrowing structure."
    },
    {
      "pageId": "p10-summary",
      "type": "summary_card",
      "learningGoal": "Compress the index mental model into a durable memory aid."
    }
  ]
}
```

### `visual-plan`

```json
{
  "artifactId": "visual-plan",
  "artifactVersion": "v1",
  "runId": "database-index-001",
  "visualPlan": [
    {
      "pageId": "p03-structure",
      "visualType": "diagram",
      "teachingPurpose": "Contrast unordered table rows with an ordered index structure.",
      "elements": ["table rows", "index keys", "row pointers", "highlighted lookup path"],
      "states": ["no index", "index available"]
    }
  ]
}
```

### `interaction-plan`

```json
{
  "artifactId": "interaction-plan",
  "artifactVersion": "v1",
  "runId": "database-index-001",
  "interactions": [
    {
      "pageId": "p06-query-path",
      "interactionType": "choice",
      "learnerAction": "Choose a query condition and predict the scan path.",
      "expectedObservation": "Selective conditions on indexed columns use index lookup; non-indexed conditions use full scan.",
      "feedback": "The index helps only when its ordered keys match the condition closely enough to narrow the search.",
      "misconceptionAddressed": "indexes-always-help"
    }
  ]
}
```

### `assessment-plan`

```json
{
  "artifactId": "assessment-plan",
  "artifactVersion": "v1",
  "runId": "database-index-001",
  "assessments": [
    {
      "pageId": "p07-misconception",
      "type": "misconception_check",
      "prompt": "A table has an index on email. Will that index speed up a query filtering only by created_at?",
      "options": ["Yes, any index helps", "No, the index keys do not match the filter", "Only if the table is small"],
      "answer": "No, the index keys do not match the filter",
      "feedback": "An index is useful when its key order helps locate the requested rows. An email index does not organize rows by created_at."
    }
  ]
}
```

### `lesson`

```json
{
  "artifactId": "lesson",
  "artifactVersion": "v1",
  "runId": "database-index-001",
  "id": "database-index",
  "title": "Why Database Indexes Make Queries Faster",
  "audience": "Learners who understand basic tables and SQL SELECT queries",
  "prerequisites": ["Tables contain rows and columns", "A WHERE clause filters rows"],
  "learningObjectives": [
    "Explain search space reduction.",
    "Predict whether a query can use an index.",
    "Recognize index tradeoffs."
  ],
  "pages": [
    {
      "id": "p01-problem",
      "type": "problem_scene",
      "title": "Ten Million Rows",
      "learningGoal": "See why row-by-row search becomes expensive.",
      "narrative": "A query needs one customer record, but the table has ten million rows."
    }
  ],
  "misconceptions": [
    {
      "id": "indexes-always-help",
      "description": "A learner may believe any index improves any query."
    }
  ],
  "transferTasks": [
    {
      "id": "log-search-transfer",
      "prompt": "Decide whether an index helps a log search by service name and timestamp."
    }
  ],
  "summary": [
    "Indexes speed reads by narrowing the search space.",
    "An index helps when the query can use its key order.",
    "Indexes cost storage and make writes maintain more structures."
  ]
}
```

### `critic-report`

```json
{
  "artifactId": "critic-report",
  "roleId": "lesson-critic",
  "status": "passed",
  "score": 100,
  "checks": [
    {
      "name": "lesson-quality",
      "ok": true,
      "issueCount": 0
    },
    {
      "name": "chinese-first",
      "ok": true,
      "issueCount": 0
    },
    {
      "name": "source-grounding",
      "ok": true,
      "issueCount": 0
    }
  ],
  "blockingFixes": [],
  "optionalImprovements": [],
  "summary": "lesson 已通过自动质量门禁，可以进入人工审查或发布流程。"
}
```
