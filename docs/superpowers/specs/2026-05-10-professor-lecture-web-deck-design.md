# Professor Lecture Web Deck Design Spec

Date: 2026-05-10

## Final Goal

Add an optional course intent for generating professor-style university or
graduate-level Web Decks.

The product should continue to output Web Decks, not PPTX or slide files. The
new mode changes the authoring target and quality rubric, not the renderer or
the core MCP flow.

## Product Motivation

The current default product emphasizes mental model construction through
visuals, learner actions, feedback, misconception checks, and transfer tasks.
That remains the default.

There is another legitimate learner job:

- "I want to quickly understand the core content of a university or graduate
  course."
- "I want something like the slides a professor would use."
- "I want a structured course deck that tells me the field, key concepts,
  methods, examples, readings, and homework path."

This job is not satisfied by a generic summary, and it is not exactly the same
as an interaction-heavy self-study lesson. It needs a course-like teaching
structure.

## Core Decision

Introduce a learner-visible `courseIntent` field.

Initial values:

- `build_mental_model`
- `professor_lecture_deck`

Future values may include:

- `exam_review`
- `research_seminar`

The default remains `build_mental_model` unless the user explicitly asks for a
professor-style course, lecture deck, course PPT-like material, seminar notes,
or equivalent phrasing.

## Non-Goals

- Do not generate PPTX, Google Slides, Keynote, or static slide files.
- Do not add a second renderer.
- Do not expose hidden operator artifacts to learners.
- Do not replace the existing mental-model course path.
- Do not weaken source grounding, publish validation, or quality checks.
- Do not make every page interactive in professor mode.

## Course Intent Semantics

### `build_mental_model`

Purpose:

Help the learner construct durable and transferable understanding.

Preferred page sequence:

```text
problem
  -> intuition
  -> visual model
  -> learner action
  -> feedback
  -> formal term / code / formula
  -> misconception check
  -> transfer
```

Quality emphasis:

- concrete problem first
- visual structure
- learner action
- explanatory feedback
- misconception diagnosis
- transfer task

### `professor_lecture_deck`

Purpose:

Help the learner quickly grasp the core content of a university or graduate
course through a structured Web Deck that feels like a strong professor's
lecture slides.

Preferred page sequence:

```text
course framing
  -> prerequisite map
  -> concept map
  -> key definitions
  -> method / theory structure
  -> worked example or derivation
  -> comparison / taxonomy
  -> discussion question
  -> reading guide
  -> homework / problem set
  -> lecture takeaway
```

Quality emphasis:

- course-level structure, not article summary
- professor-like framing of what matters and why
- canonical concepts and terminology
- method lineage, taxonomy, or theory map
- worked examples, derivations, or case analysis where appropriate
- classroom discussion prompts
- reading and homework path
- concise takeaways

## User Interaction

Before `learning_agent.prepare_learning_course`, Codex, Claude, or another
agent should clarify course intent when it is not obvious.

Recommended learner-facing question:

```text
你希望生成哪种 Web Deck？
1. 互动学习课：更适合建立心智模型和自学
2. 教授式课程讲义：更像大学/研究生课程讲义，适合快速掌握课程核心内容
```

Inference rules:

- If the user says "心智模型", "互动学习", "自学", "看懂机制", or "操作反馈",
  infer `build_mental_model`.
- If the user says "大学课程", "研究生课程", "教授 PPT", "lecture slides",
  "课程讲义", "像老师上课", or "快速掌握一门课核心内容", infer
  `professor_lecture_deck`.
- If both are requested, ask whether the professor-style deck should be the
  main course and mental-model interactions should appear only as checkpoints.

## Runtime Contract

Extend learner project input and brief with optional `courseIntent`.

Expected shape:

```ts
type CourseIntent = "build_mental_model" | "professor_lecture_deck";

type CreateLearnerProjectInput = {
  request: string;
  courseIntent?: CourseIntent;
  // existing fields: sourcePath, sourceKind, audience, difficultyLevel,
  // unitPages, strategy, selectedChapters, selectedTopics
};

type LearnerBrief = {
  courseIntent: CourseIntent;
  // existing fields
};
```

Default:

```text
courseIntent = build_mental_model
```

The default can be inferred from natural language, but it should never silently
override an explicit input.

## Authoring Context

`prepare_learning_course` should return authoring guidance that includes:

- `courseIntent`
- intent-specific global rules
- intent-specific page blueprint templates
- intent-specific quality expectations

For `professor_lecture_deck`, authoring guidance should tell Codex:

- write Chinese professor-style Web Deck pages
- preserve source grounding
- organize by course logic, not source order alone
- include prerequisite assumptions
- include concept map or course framework
- include definitions after context
- include worked examples, derivations, or case analysis
- include discussion questions and homework-style tasks
- include reading guide and lecture takeaway
- avoid generic summaries and motivational filler

## Page Blueprint Changes

The current content blueprint can remain the main mechanism, but it needs
intent-aware templates.

Suggested professor-mode page types:

- `lecture_framing`
- `prerequisite_map`
- `concept_framework`
- `definition_block`
- `method_structure`
- `worked_example`
- `derivation_or_proof`
- `comparison_taxonomy`
- `discussion_prompt`
- `reading_guide`
- `homework_task`
- `lecture_takeaway`

These page types can initially map onto the existing lesson page schema through
existing page types when necessary:

| Professor Page Type | Existing Compatible Page Type |
| --- | --- |
| `lecture_framing` | `problem_scene` |
| `prerequisite_map` | `structure_diagram` |
| `concept_framework` | `structure_diagram` |
| `definition_block` | `code_walkthrough` or `intuition_visual` |
| `method_structure` | `structure_diagram` |
| `worked_example` | `code_walkthrough` or `process_animation` |
| `derivation_or_proof` | `process_animation` |
| `comparison_taxonomy` | `structure_diagram` |
| `discussion_prompt` | `quiz` |
| `reading_guide` | `summary_card` |
| `homework_task` | `transfer_challenge` |
| `lecture_takeaway` | `summary_card` |

The first implementation should avoid broad schema churn. It can store
professor-specific intent in blueprint metadata and use existing renderable page
types until a richer schema is justified.

## Quality Rubric

Professor-style Web Decks should not be judged by the same density of
interactions as mental-model lessons.

Required checks:

- The deck has a course-level framing page.
- The deck states prerequisites and expected learner level.
- The deck exposes a concept framework, taxonomy, method map, or theory map.
- Key definitions are present but not isolated from context.
- At least one worked example, derivation, proof sketch, or case analysis is
  included when the source supports it.
- At least one comparison page distinguishes related methods, theories, or
  design choices.
- At least one discussion question asks for reasoning, critique, diagnosis, or
  design judgment.
- At least one homework or reading path is included.
- Each page has a clear lecture purpose and does not become a paragraph dump.
- Source-backed claims keep source anchors or explicit inferred/analogy labels.

Acceptable differences from `build_mental_model`:

- Not every page needs a learner manipulation.
- Feedback can be classroom-style answer notes rather than immediate UI
  feedback.
- More text is allowed, but each page must remain readable in one Web Deck
  viewport.
- Formal terms may appear earlier than in mental-model mode if the deck first
  gives course framing and prerequisites.

Blocking failures:

- The deck is only a summary of chapters or sections.
- The deck lacks course framing.
- The deck has no worked example, derivation, proof sketch, or case analysis
  when the source has enough material.
- The deck lacks discussion or homework tasks.
- The deck claims professor-level depth but stays at generic blog level.
- The deck uses PPT/file-export language instead of Web Deck language.

## Web Deck UI

No new renderer is required for the first implementation.

The Web Deck should show professor-mode content using existing page layouts
where possible. Minor copy and metadata changes are allowed:

- show course intent in project metadata
- label the mode as `教授式课程讲义`
- keep side navigation unchanged
- keep one-page-per-viewport behavior
- keep feedback and revision tools available

The UI should not expose a "download PPT" or "export slides" affordance as part
of this feature.

## MCP And Skills Surface

Default learner MCP profile remains unchanged.

`learning_agent.prepare_learning_course` should accept optional
`courseIntent`.

Skills should teach agents to ask for course intent when the user's goal is
ambiguous:

- interactive learning lesson
- professor-style Web Deck

`source-to-course` should route requests like professor PPT, lecture slides, or
course notes to `professor_lecture_deck`, while still stating that output is a
Web Deck.

`learning-agent-operator` should summarize the chosen intent in learner-facing
responses.

## Documentation Changes

Update product docs to say the product supports multiple Web Deck authoring
intents:

- interactive mental-model learning
- professor-style course lecture deck

README and runtime prompt docs should avoid implying that the product only
creates interaction-heavy lessons.

Seed prompts should include an example:

```text
请把这本书生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织。
我想快速掌握课程核心内容、关键概念、方法谱系、经典例题和课后阅读路径。
```

## Testing Strategy

Unit tests:

- parse/infer `courseIntent` from natural language
- require default `build_mental_model` when unspecified
- preserve explicit `courseIntent`
- include `courseIntent` in learner project JSON and project registry
- include professor-mode global rules in authoring context
- build professor-mode page blueprints
- validate professor-mode quality requirements separately from interaction-heavy
  lesson requirements
- expose `courseIntent` in MCP schema

Integration tests:

- call `prepare_learning_course` with `courseIntent=professor_lecture_deck`
- assert content blueprint includes professor lecture page requirements
- publish a minimal professor-style Web Deck fixture
- assert quality report does not fail only because every page lacks
  interaction
- assert quality report fails for chapter summaries that lack course framing,
  examples, discussion, and homework

Docs/skills tests:

- default workflow still uses learner MCP tools
- skills mention professor Web Deck as optional mode, not PPTX export
- no default docs suggest generating `.pptx`

## Acceptance Criteria

This feature is complete when:

- Users can request professor-style course Web Decks through natural language.
- `prepare_learning_course` records and returns `courseIntent`.
- Authoring context produces professor-mode blueprint rules.
- The published result is still a Web Deck.
- Quality checks recognize professor-mode expectations.
- Default mental-model mode remains unchanged.
- Missing/ambiguous intent is clarified by Codex/Claude when useful.
- No PPTX/export-to-slides path is introduced.
- `npm run test:ci` passes.

## Rollout Plan

Phase 1:

- Add `courseIntent` to learner input, brief, MCP schema, and natural-language
  inference.
- Add professor-mode authoring guidance and content blueprint templates.
- Update skills/docs.

Phase 2:

- Add professor-mode quality report checks.
- Add fixture tests for a professor-style Web Deck.
- Add revision targeting categories for "too summary-like", "lacks worked
  example", "not lecture-like", and "needs homework/reading path".

Phase 3:

- Improve Web Deck layouts for lecture-style pages if the existing layouts feel
  cramped.
- Add richer source-type-specific lecture structures for books, papers, patents,
  blogs, and documentation sets.

## Open Questions

- Should a single course pack be allowed to mix `build_mental_model` units and
  `professor_lecture_deck` units, or should intent be course-wide for v1?
- Should professor-mode decks have a recommended default page count higher than
  the current 6-12 page-per-unit range?
- Should research papers default to `research_seminar` later, or is
  `professor_lecture_deck` enough for the next release?

Recommended v1 decisions:

- Keep `courseIntent` course-wide.
- Keep existing user-specified page count.
- Use `professor_lecture_deck` for now; defer `research_seminar`.
