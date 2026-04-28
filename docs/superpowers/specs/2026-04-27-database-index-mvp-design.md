# Database Index MVP Design

## Purpose

Build the first real vertical slice of AI Interactive Learning Agent: a runnable interactive web lesson for the sample topic "Why database indexes make queries faster", while establishing the smallest reusable learning experience foundation needed for future generated lessons.

The project should not become a one-off database index slideshow. The database index lesson is the first acceptance case for a data-driven lesson schema, web deck renderer, visual components, interaction components, assessment components, and lesson quality workflow.

## Strategy

Use a vertical slice approach:

```text
structured lesson data
  -> minimal schema
  -> web deck renderer
  -> lesson-specific visuals
  -> reusable interactions and feedback
  -> quality review
  -> runnable package
```

This keeps the first demo tangible while preventing premature platform abstraction. Every reusable abstraction must be exercised by the database index lesson.

## Scope

### In Scope

- A real React/TypeScript/Vite web deck implementation in a later implementation phase.
- Structured lesson data as the source of truth.
- A database index sample lesson with 10 pages as the default MVP example.
- Support for user-specified target page count in the lesson generation/design contract.
- Reusable page renderer and core components.
- At least two meaningful interactions:
  - Query path visualizer
  - Index tradeoff checker
- Multiple choice, prediction, misconception, and transfer assessments.
- Explanatory feedback for every assessment and interaction.
- README instructions for install, dev, build, and extension.

### Out of Scope For First MVP

- Full AI generation pipeline connected to an LLM.
- Real database integration.
- Full B+ tree engine or query optimizer simulation.
- Canvas/whiteboard mode.
- AI tutor mode.
- Teacher mode.
- Multi-lesson authoring UI.

## Page Count Requirement

The system must not hard-code lessons to exactly 10 pages.

The database index lesson remains a 10-page sample because it is the initial MVP acceptance lesson, but the broader lesson design contract must support a user-specified target page count.

Recommended initial range:

```text
6 to 14 pages
```

The generator or lesson architect should treat the target count as a planning constraint:

- Short lessons compress examples and reduce intermediate process pages.
- Standard lessons include problem, intuition, structure, process, interaction, assessment, transfer, and summary.
- Longer lessons split complex mechanisms, add more practice, or add deeper misconception checks.

The required learning arc should remain stable even when page count changes:

```text
problem
  -> intuition
  -> visual structure
  -> learner action
  -> feedback
  -> formalization
  -> misconception check
  -> transfer
  -> summary
```

For implementation, lesson metadata should include:

```ts
type LessonConfig = {
  targetPageCount: number;
  minPageCount?: number;
  maxPageCount?: number;
};
```

The rendered lesson should use the actual `pages.length`, not any hard-coded page total.

## Information Architecture

The project should keep four layers separate:

1. **Lesson Design Layer**
   - Design artifacts under `examples/`.
   - Captures pedagogy, page sequence, visual specs, interactions, assessments, and feedback.

2. **Lesson Data Layer**
   - Implementation-ready lesson objects under `src/lessons/`.
   - Contains typed data consumed by renderers.

3. **Renderer Layer**
   - Generic renderers under `src/renderers/`.
   - Converts lesson data into deck pages.

4. **Component Layer**
   - Reusable UI components under `src/components/`.
   - Split into deck, visual, interaction, assessment, canvas, and playground areas.

## MVP Architecture

### Data Flow

```text
lesson object
  -> WebDeckRenderer
  -> DeckShell
  -> DeckPage
  -> page-type renderer
  -> visual / interaction / assessment components
  -> FeedbackPanel
```

### Core Units

- `src/schemas/lesson.schema.ts`
  - TypeScript lesson, page, visual, interaction, assessment, and feedback types.
  - Includes page count configuration metadata.

- `src/lessons/database-index/lesson.ts`
  - Implementation-ready database index lesson data.
  - Based on `examples/database-index/lesson-design.json`.

- `src/renderers/WebDeckRenderer.tsx`
  - Receives a typed lesson object.
  - Owns page selection and delegates rendering by page type.

- `src/components/deck/`
  - Deck shell, page layout, progress bar, and navigation.

- `src/components/visual/`
  - Visual components needed for the first lesson:
    - table scan visual
    - book index comparison
    - simplified index tree
    - access path flow

- `src/components/interaction/`
  - Query path visualizer.
  - Index tradeoff checker.

- `src/components/assessment/`
  - Multiple choice quiz.
  - Prediction prompt.
  - Misconception check.
  - Transfer challenge.
  - Feedback panel.

## Database Index Lesson Default Sequence

The first sample lesson should use 10 pages:

1. Problem scene: querying 10 million rows
2. Intuition: searching a book with and without an index
3. Structure: table rows vs index structure
4. Process: full table scan animation
5. Process: indexed lookup animation
6. Interaction: choose query conditions and see scan path
7. Misconception: indexes always help
8. Code/SQL walkthrough: simple index examples
9. Transfer challenge: decide whether an index helps
10. Summary card

This sequence is a sample, not a global page-count rule.

## Variable Page Count Examples

### 6-Page Version

1. Problem and intuition
2. Table versus index structure
3. Full scan versus index lookup comparison
4. Query path visualizer
5. Index tradeoff and misconception check
6. Transfer and summary

### 10-Page Version

Use the default MVP sequence.

### 14-Page Version

Add:

- Selectivity page
- Composite index order page
- Covering index intuition page if needed
- Extra prediction practice
- Deeper write/storage tradeoff scenario

## Interaction Design

### Query Path Visualizer

Learner selects a query condition. The lesson shows whether the database uses:

- Full table scan
- Index lookup
- Partially useful index path

Feedback explains:

- Which index exists
- Whether the predicate matches the indexed key
- Whether selectivity makes the path useful
- Why the chosen path reduces or does not reduce search space

### Index Tradeoff Checker

Learner chooses whether to add an index for workload scenarios.

Feedback explains:

- Read benefit
- Write maintenance cost
- Storage cost
- Selectivity
- Workload frequency

## Assessment Design

The MVP must include:

- One multiple choice quiz
- One prediction task
- One misconception check
- One transfer challenge

Assessments should test mental model quality, not vocabulary recall.

## Visual Design Direction

Use a teaching-oriented, product-quality interface:

- Clear hierarchy
- Large readable typography
- One dominant idea per page
- Labeled diagrams
- SVG for diagrams and lightweight animations
- Minimal decoration

The interface should feel like a focused university mini-class, not a developer debug panel.

## Testing And Quality Gates

Before calling the MVP done:

- `npm install` succeeds.
- `npm run dev` starts the app.
- `npm run typecheck` passes.
- `npm run build` passes.
- The database index lesson opens in the browser.
- Navigation uses `pages.length` and supports arbitrary page counts.
- All 10 default pages render.
- At least 3 visual explanations render.
- Query path visualizer works.
- Index tradeoff checker works.
- Assessments show explanatory feedback.
- The lesson passes a review against `docs/quality-rubric.md`.

## Future Extension Path

After the database index MVP:

1. Add a second topic, such as hash tables or TCP three-way handshake.
2. Confirm the renderer and schema work for a different conceptual structure.
3. Extract repeated lesson design moves into the local `skills/` workflow.
4. Add a lesson critic command or checklist-driven review script.
5. Add AI-assisted generation only after the data contract and renderer are stable.

## Open Decisions

The first implementation plan should decide:

- Whether lesson implementation data should be JSON imported at runtime or TypeScript data compiled with types.
- Whether Tailwind should be installed immediately or CSS modules should be used for the first slice.
- Whether interaction state is local component state or represented in a generic response model.

Recommendation:

- Use TypeScript lesson data for the first implementation because it gives stronger type checking while the schema is still evolving.
- Use Tailwind because it matches the project preference and will speed layout iteration.
- Keep interaction state local until a second lesson proves the need for a generic learner response model.
