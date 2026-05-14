# Knowledge Board Web Deck Design Spec

Date: 2026-05-13

## Goal

Upgrade `professor_lecture_deck` authoring from "one page equals one template
role" to "one page equals one knowledge board".

The learner-facing product should feel like a high-quality university or
graduate course Web Deck. A page should not look like a product UI, an
instructional design checklist, or a short article summary. It should look like
a professor's board slide: a focused title, dense but readable knowledge
structure, source-grounded explanation, examples, and a compact conclusion.

## Core Decision

Use the combined `5 + 3` direction:

1. Page layout model: professor board two-column structure.
2. Content reasoning model: source proposition -> decomposition -> evidence ->
   reconstruction.

For the current page layout slice, lock the middle section to a visual-text
split:

1. left side: one image slot as the visual anchor
2. right side: compact board text for mechanism, example, and boundary
3. bottom: one-line summary that always remains visible

In practice:

```text
source material
  -> source propositions
  -> concept / mechanism decomposition
  -> evidence anchors
  -> reconstructed knowledge board pages
  -> textbook_deck rendering
```

## Non-Goals

- Do not generate PPTX, Slides, Keynote, or static slide files.
- Do not expose source anchors, review artifacts, or teaching-design labels on
  the learner-facing page by default.
- Do not require every professor-style page to contain a quiz or interaction.
- Do not replace `build_mental_model`; this only upgrades
  `professor_lecture_deck`.
- Do not weaken source grounding or publish validation.

## Knowledge Board Page Model

Add an authoring-level `knowledgeBoard` object for professor-mode pages. It can
initially live inside lesson JSON as optional structured metadata, while the
existing `title`, `narrative`, `visualSpec`, `sourceAnchorIds`, and `grounding`
remain compatible with existing renderers.

Target shape:

```ts
type KnowledgeBoard = {
  boardKind:
    | "definition_board"
    | "mechanism_board"
    | "evidence_board"
    | "example_board"
    | "comparison_board"
    | "boundary_board"
    | "synthesis_board";
  headline: string;
  coreProposition: string;
  leftColumn: BoardSection[];
  rightColumn: BoardSection[];
  sourceTrace: SourceTraceItem[];
  bottomLine: string;
};

type BoardSection = {
  label: string;
  items: string[];
  emphasis?: "definition" | "mechanism" | "example" | "boundary" | "note";
};

type SourceTraceItem = {
  anchorId: string;
  supports: string;
};
```

Learner-facing pages should render the board, not the internal labels. For
example, `coreProposition` becomes the main statement under the title; section
labels become compact board headers; `sourceTrace` stays hidden unless the
learner opens the source view.

## Board Layout

Default desktop layout:

```text
Title
Core proposition

Visual panel (left, fixed height)    Structured board text (right)
- imagegen teaching illustration     - mechanism
- visual explanation only            - example
- short labels allowed               - boundary / caveat

Bottom line
```

The visual panel must not consume vertical space beyond the readable budget.
If the page risks overflow, reduce image height before compressing text. The
text column stays short and scannable, using compact sections rather than long
paragraphs.

All generated learning scenarios use the same visual asset pipeline:

```text
Codex content design
  -> imagegen teaching illustration generation
  -> saved preview image asset
  -> page.visualSpec.imageUrl consumed by the Web Deck renderer
```

The renderer and publisher must not create programmatic SVG placeholders for
normal learner-facing visuals. A page image is an AI-generated teaching
illustration, not a duplicate text card. It must not include the page title,
bottom-line sentence, long prose, tables, page-card text, or UI-like right-side
text boxes. Short labels, direction words, axis markers, and local annotations are
allowed when they make the visual easier to understand. If a source image is
useful, it can be used as a reference for Codex/imagegen, but the final asset
must be marked as imagegen-generated and must not be represented as an original
source image.

Mobile or narrow layout can stack the visual panel above the text while
preserving the same order and summary line.

The board should stay within one browser viewport. If content overflows, the
authoring or validation layer should split the board into multiple pages rather
than forcing learner scrolling.

## Source Proposition Flow

Before writing pages, the authoring context should extract or ask Codex to
produce source propositions:

```ts
type SourceProposition = {
  id: string;
  statement: string;
  sourceAnchorIds: string[];
  keyTerms: string[];
  dependsOn: string[];
  examples: string[];
  boundaries: string[];
};
```

Each knowledge board should be traceable to one or more source propositions.
This prevents the deck from becoming a generic lecture outline.

## Recommended Board Sequence

For a 10-page professor-style unit:

1. `synthesis_board`: course position and core problem.
2. `definition_board`: prerequisites and terms.
3. `synthesis_board`: concept map and dependencies.
4. `definition_board`: key definition and discriminating conditions.
5. `mechanism_board`: main mechanism or reasoning chain.
6. `example_board`: worked example, case, proof sketch, or pseudo-code.
7. `comparison_board`: taxonomy, alternatives, and tradeoffs.
8. `evidence_board`: source-backed claim analysis or application case.
9. `boundary_board`: counterexample, failure condition, or transfer boundary.
10. `synthesis_board`: final map and durable takeaways.

This sequence is a default, not a rigid template. The important unit of quality
is whether every page has a usable board structure.

## Content Density Rules

Each board page must include:

- one precise title
- one core proposition
- at least three compact structured sections in the text column
- at least one source-backed claim or explicitly inferred claim
- at least one concrete example, counterexample, mechanism step, or comparison
- one bottom-line conclusion

Avoid:

- one-paragraph narrative pages
- visible labels such as "self-study goal", "teaching move", or "page role"
- empty diagram placeholders
- generic summaries that could apply to any source
- ungrounded claims when source material is available
- dense text blocks that force the image to shrink below legibility

## Renderer Impact

`textbook_deck` should prefer `page.knowledgeBoard` when present.

Fallback order:

1. Render `knowledgeBoard`.
2. If absent, render existing `title + narrative + visualSpec`.
3. Keep `interactionSpec` and `assessmentSpec` hidden in professor mode unless
   a future explicit learner mode enables them.

This keeps the change incremental and preserves existing lesson JSON.

## Runtime Impact

Update professor-mode authoring in three places:

1. `content-quality-blueprint`: page blueprints should request a
   `knowledgeBoard` with source proposition, decomposition, evidence, and
   reconstruction fields.
2. `authoring-context-service` and `bundle-authoring-guidance`: tell Codex to
   write board pages, not role-template pages.
3. `course-quality-report`: validate board completeness, density, source
   grounding, and viewport-safe content volume.

## Quality Gates

Professor board quality should fail publication when:

- a professor-mode page has neither `knowledgeBoard` nor enough structured
  fallback content
- `coreProposition` is missing or generic
- source-backed pages lack `sourceAnchorIds` or `sourceTrace`
- both columns are empty or contain only one vague sentence
- the page lacks example, mechanism, comparison, evidence, or boundary content
- visible learner-facing text contains internal scaffolding terms
- estimated board content is too large for one viewport

## Acceptance Criteria

1. `prepare_learning_course` returns professor-mode guidance that explicitly
   requires knowledge board pages.
2. Published professor-mode lessons can include `page.knowledgeBoard`.
3. `WebDeckRenderer` renders knowledge boards in `textbook_deck` mode.
4. Source-backed board pages retain hidden source trace and visible
   source-grounded claims.
5. Existing professor-mode previews no longer rely on one-paragraph
   `narrative` content.
6. Unit tests cover board schema compatibility, rendering fallback, quality
   validation, and authoring guidance.
7. A real source trial regenerates `professor-agentic-design-depth-v2-20260511`
   or a successor run with board pages and passes test, typecheck, lint, build,
   and viewport inspection.

## Open Decisions

Resolved for this slice:

- `knowledgeBoard` remains part of the public TypeScript lesson schema.
- Source traces stay hidden in the learner view and visible only in the source
  view.
- Board density uses simple structural limits first, with viewport checks on the
  seed preview as a secondary gate.

Default recommendation for the next implementation slice:

- add `knowledgeBoard` to the lesson schema now
- keep source traces hidden in the page and visible in the source view
- start with simple structural validation plus Playwright viewport checks for
  the regenerated seed preview
