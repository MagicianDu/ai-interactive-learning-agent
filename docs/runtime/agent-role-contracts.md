# Agent Role Contracts

## Purpose

Agent role contracts define the responsibilities, inputs, outputs, and quality checks for the multi-agent learning-experience workflow. Each role should be portable across runtimes: it may run as a Codex subagent, Claude Code task, Gemini CLI step, custom worker, or manual step in an interactive session.

Each role reads durable artifacts from `runs/<run-id>/artifacts/` and writes durable artifacts back to the same run directory. Roles should not depend on hidden chat state as their only source of context.

## Artifact Reference Policy

Durable role outputs are versioned files named `artifacts/<artifact-id>.vN.json`, where `N` increases for each material revision. A role that creates or revises an artifact writes a new versioned draft and may update draft alias `artifacts/<artifact-id>.draft.json` to copy or point to the latest draft.

When an approval gate approves a versioned artifact, the runtime records that exact version in `approvals/<gate-id>.approved.json` and may update approved alias `artifacts/<artifact-id>.approved.json` to copy or point to the latest approved version.

Plain aliases such as `artifacts/<artifact-id>.json` are forbidden for approval-gated inputs because they do not reveal whether the content is draft or approved. Any role input requiring approved upstream content must reference either the exact versioned file recorded in the gate approval file or the approved alias. Draft aliases are allowed only for non-gated upstream work.

## Role Sequence

Recommended default order:

```text
Source Ingest
  -> Learning Architecture
  -> Visual Pedagogy
  -> Interaction Design
  -> Assessment Design
  -> Lesson Assembly
  -> Component Build
  -> Lesson Critic
  -> Publish Package
```

Visual Pedagogy runs before Interaction Design because interaction planning depends on the visual plan. Assessment Design may run in parallel with Visual Pedagogy after the Learning Architecture artifact is approved when the runtime supports independent role execution.

## Source Ingest Agent

### Purpose

Extract teachable concepts, dependencies, examples, misconceptions, and candidate learner actions from the topic or source material.

### Inputs

- `run.config.json`
- Topic or source material from `source`
- Audience description
- Scope constraints and target output form

### Outputs

Writes a new versioned draft `artifacts/source-ingest.vN.json` and may update draft alias `artifacts/source-ingest.draft.json`:

```json
{
  "concepts": [],
  "dependencies": [],
  "examples": [],
  "misconceptions": [],
  "candidateInteractions": []
}
```

### Quality Checks

- Concepts are teachable units rather than copied headings.
- Dependencies identify prerequisite ideas and causal relationships.
- Examples are concrete enough to support visuals or learner actions.
- Misconceptions are plausible for the target audience.
- Candidate interactions require thinking and feedback, not decorative clicking.
- Claims stay within the provided source or accepted technical knowledge.

## Learning Architecture Agent

### Purpose

Turn the ingested concept set into a coherent page-by-page learning path that starts with a problem, builds intuition, introduces formal ideas after concrete models, and ends with transfer.

### Inputs

- `run.config.json`
- `artifacts/source-ingest.vN.json` or draft alias `artifacts/source-ingest.draft.json`
- Target audience
- Target output form
- Page count constraint

### Outputs

Writes a new versioned draft `artifacts/learning-architecture.vN.json` and may update draft alias `artifacts/learning-architecture.draft.json`:

```json
{
  "audience": "",
  "prerequisites": [],
  "learningObjectives": [],
  "pageCount": {
    "target": 10,
    "min": 8,
    "max": 12,
    "planned": 10
  },
  "pageSequence": []
}
```

### Quality Checks

- The sequence begins with a concrete problem or situation.
- Each page has one primary learning goal.
- The path moves from concrete experience to terminology, code, or formulas.
- The planned page count respects the run constraint or explains the deviation.
- Objectives are measurable through prediction, manipulation, explanation, or transfer.
- The final pages include summary and transfer rather than ending at exposition.

## Visual Pedagogy Agent

### Purpose

Decide which parts of the learning path need diagrams, animations, comparisons, timelines, state views, or other visual structures.

### Inputs

- `artifacts/source-ingest.vN.json` or draft alias `artifacts/source-ingest.draft.json`
- Approved `artifacts/learning-architecture.vN.json` recorded in `approvals/learning-architecture.approved.json` or approved alias `artifacts/learning-architecture.approved.json`
- Target output form
- Existing renderer and component constraints when available

### Outputs

Writes a new versioned draft `artifacts/visual-plan.vN.json` and may update draft alias `artifacts/visual-plan.draft.json`:

```json
{
  "visualPlan": [
    {
      "pageId": "",
      "visualType": "",
      "teachingPurpose": "",
      "elements": [],
      "states": []
    }
  ]
}
```

### Quality Checks

- Visuals expose hidden structures, flows, states, or causal mechanisms.
- Each visual has a teaching purpose tied to a page goal.
- Labels and color meanings are explicit.
- Animation states show meaningful change over time.
- The plan avoids multiple competing diagrams on one page.
- The visual scope is feasible for the target renderer.

## Interaction Design Agent

### Purpose

Convert concepts and visual models into meaningful learner actions with immediate explanatory feedback.

### Inputs

- `artifacts/source-ingest.vN.json` or draft alias `artifacts/source-ingest.draft.json`
- Approved `artifacts/learning-architecture.vN.json` recorded in `approvals/learning-architecture.approved.json` or approved alias `artifacts/learning-architecture.approved.json`
- `artifacts/visual-plan.vN.json` or draft alias `artifacts/visual-plan.draft.json`
- Misconceptions and candidate interactions

### Outputs

Writes a new versioned draft `artifacts/interaction-plan.vN.json` and may update draft alias `artifacts/interaction-plan.draft.json`:

```json
{
  "interactions": [
    {
      "pageId": "",
      "interactionType": "",
      "learnerAction": "",
      "expectedObservation": "",
      "feedback": "",
      "misconceptionAddressed": ""
    }
  ]
}
```

### Quality Checks

- Learner actions require prediction, choice, manipulation, ordering, debugging, or explanation.
- Each interaction has a clear cognitive purpose.
- Feedback explains why an outcome happened.
- Interactions reveal cause and effect in the concept.
- At least one interaction can expose a common misconception.
- The plan avoids interactions that merely reveal more text.

## Assessment Design Agent

### Purpose

Create checks for recall, prediction, misconceptions, and transfer that assess mental model quality rather than trivia.

### Inputs

- `artifacts/source-ingest.vN.json` or draft alias `artifacts/source-ingest.draft.json`
- Approved `artifacts/learning-architecture.vN.json` recorded in `approvals/learning-architecture.approved.json` or approved alias `artifacts/learning-architecture.approved.json`
- Misconceptions
- Learning objectives
- Transfer goals

### Outputs

Writes a new versioned draft `artifacts/assessment-plan.vN.json` and may update draft alias `artifacts/assessment-plan.draft.json`:

```json
{
  "assessments": [
    {
      "pageId": "",
      "type": "",
      "prompt": "",
      "options": [],
      "answer": "",
      "feedback": ""
    }
  ]
}
```

### Quality Checks

- Includes at least one recall check, prediction check, misconception check, and transfer challenge when lesson length allows.
- Questions test reasoning about mechanisms, tradeoffs, or application.
- Correct feedback reinforces the causal model.
- Incorrect feedback names the likely wrong assumption and repairs it.
- Answer keys are unambiguous.
- Assessments align with the stated learning objectives.

## Lesson Assembly Agent

### Purpose

Merge architecture, visual, interaction, and assessment artifacts into a structured lesson object that renderers can consume.

### Inputs

- Approved `artifacts/learning-architecture.vN.json` recorded in `approvals/learning-architecture.approved.json` or approved alias `artifacts/learning-architecture.approved.json`
- `artifacts/visual-plan.vN.json` or draft alias `artifacts/visual-plan.draft.json`
- `artifacts/interaction-plan.vN.json` or draft alias `artifacts/interaction-plan.draft.json`
- `artifacts/assessment-plan.vN.json` or draft alias `artifacts/assessment-plan.draft.json`
- Run config constraints

### Outputs

Writes a new versioned draft `artifacts/lesson.vN.json` and may update draft alias `artifacts/lesson.draft.json`. A TypeScript lesson file may be created later during promotion, but the durable run artifact is JSON:

```json
{
  "id": "",
  "title": "",
  "audience": "",
  "prerequisites": [],
  "learningObjectives": [],
  "pages": [],
  "misconceptions": [],
  "transferTasks": [],
  "summary": []
}
```

### Quality Checks

- Every page has a stable id, type, title, learning goal, and concise narrative.
- Visual, interaction, assessment, and feedback specs are attached to the appropriate pages.
- The lesson object is internally consistent and renderer-oriented.
- The page sequence still follows the approved learning architecture.
- The lesson includes misconception and transfer content as first-class objects.
- The final object is structured data, not prose-only lesson notes.

## Component Build Agent

### Purpose

Build or update reusable renderer components and lesson wiring that turn the structured lesson object into a runnable learner-facing experience.

### Inputs

- Approved `artifacts/lesson.vN.json` recorded in `approvals/lesson.approved.json` or approved alias `artifacts/lesson.approved.json`
- Target output form from `run.config.json`
- Existing component inventory
- Project design and implementation conventions

### Outputs

- Reusable component files under the appropriate `src/` component directories
- Lesson implementation under `src/lessons/<lesson-id>/`
- Static example assets under `examples/<lesson-id>/` when needed
- Tests when the project has a test setup for the touched surface
- Local run or build evidence in logs

### Quality Checks

- Components are reusable across lessons where practical.
- The implementation consumes structured lesson data rather than duplicating content in one-off UI code.
- Navigation, visual rendering, interactions, quizzes, and feedback work locally.
- UI supports laptop and tablet-sized screens.
- Text is concise, readable, and does not overlap controls or diagrams.
- The role does not change approved learning content without creating a revised artifact.

## Lesson Critic Agent

### Purpose

Review the lesson and rendered output against learning principles, accuracy, interaction quality, visual clarity, and product readiness.

### Inputs

- Approved `artifacts/lesson.vN.json` recorded in `approvals/lesson.approved.json` or approved alias `artifacts/lesson.approved.json`
- Rendered output, screenshots, or local preview notes when available
- Quality rubric
- Run config constraints

### Outputs

Writes a new versioned draft `artifacts/critic-report.vN.json` and may update draft alias `artifacts/critic-report.draft.json`:

```json
{
  "score": 0,
  "strengths": [],
  "issues": [],
  "requiredFixes": [],
  "optionalImprovements": []
}
```

### Quality Checks

- Findings are specific, actionable, and tied to page ids or components.
- Required fixes identify blockers to the learning goal or runnable product.
- Optional improvements are clearly separated from required fixes.
- The critique checks pedagogy, technical accuracy, visuals, interactions, assessment, and product quality.
- The report is usable by the current runtime and by a future runtime resuming from files.

## Publish Package Agent

### Purpose

Prepare the approved lesson as a runnable, shareable package with clear instructions and promoted artifacts.

### Inputs

- Passing build or runnable preview evidence
- Approved `artifacts/lesson.vN.json` recorded in `approvals/lesson.approved.json` or approved alias `artifacts/lesson.approved.json`
- Approved `artifacts/critic-report.vN.json` recorded in `approvals/critic-report.approved.json` or approved alias `artifacts/critic-report.approved.json`
- Lesson metadata
- README or package instructions

### Outputs

- New versioned draft `artifacts/publish-package.vN.json` and optional draft alias `artifacts/publish-package.draft.json`
- Build or preview instructions
- Promoted lesson artifacts under `src/lessons/<lesson-id>/`
- Example package under `examples/<lesson-id>/` when applicable
- Updated project README or lesson README when needed
- Publish gate artifact documenting the final package state

### Quality Checks

- The package can be run by a user following documented commands.
- Promoted files preserve the approved lesson object and renderer behavior.
- Build artifacts are not treated as the source of truth.
- Instructions name the runtime requirements and verification commands.
- The publish artifact records version, source run id, and known constraints.
