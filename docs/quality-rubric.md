# Quality Rubric

Use this checklist before marking a lesson ready for implementation or release.

## Learning Path

- Starts with a concrete problem.
- Uses one clear learning goal per page.
- Moves from concrete intuition to formal abstraction.
- Ends with a transfer challenge.
- Does not rely on long prose to carry the main idea.

## Visual Quality

- Visuals reveal structure, state, flow, comparison, or causality.
- Labels are explicit and readable.
- Color coding is explained by labels or context.
- Animation shows meaningful state change.
- The page has one dominant visual focus.

## Interaction Quality

- The learner must make a prediction, choice, adjustment, ordering, or construction.
- The result is visible immediately.
- Feedback explains why the result happened.
- The interaction reveals cause and effect.
- The interaction is not decorative.

## Assessment Quality

- Includes recall, prediction, misconception, and transfer checks.
- Questions test mental models rather than trivia.
- Incorrect feedback identifies the likely bad assumption.
- Correct feedback reinforces the causal mechanism.

## Content Quality

- Technical claims are accurate.
- Terminology appears after intuition.
- Code examples are short and purposeful.
- Common misconceptions are addressed explicitly.
- Transfer tasks use a new but related context.

## Product Quality

- Lesson content exists as structured data.
- Components are reusable.
- The app runs locally.
- Navigation works.
- Diagrams and interactions render on laptop and tablet widths.

## Automated Promotion Gates

Promotion from `runs/<run-id>/artifacts/lesson.approved.json` into `src/lessons/<lesson-id>/lesson.ts` must fail when a lesson does not satisfy core product quality.

Blocking rules include:

- Page count matches `config.targetPageCount`.
- Required learning experience elements are present: problem scene, interactive model, quiz/checkpoint, misconception check, transfer challenge or transfer task, and summary card or summary payload.
- Each learning objective is covered by at least one page title, learning goal, or narrative field.
- At least three visual explanations are present.
- At least two meaningful interactions are present.
- At least two assessment or checkpoint pages include explanatory feedback.
- Interactions include learner action, expected observation, cognitive purpose, and explanatory option feedback.
- Learner-facing text is Chinese-first by default.
- Source-backed lessons include source anchors through `sourceContext.sourceAnchorIds`, page-level `sourceAnchorIds`, or explicit `grounding.kind` markers for inferred/analogy pages.

The `lesson-critic` runtime step writes a `critic-report` artifact after the approved `lesson` gate. The report contains:

- `status`: `passed` or `revision_required`.
- `score`: automated score after blocking and warning issues.
- `checks`: per-validator status for lesson quality, Chinese-first output, and source grounding.
- `blockingFixes`: issues that must be fixed before release.
- `optionalImprovements`: warnings that may improve teaching quality but do not block release.

The automated gate is a minimum bar. Passing it does not replace human review of technical accuracy, learning flow, visual clarity, or source coverage.
