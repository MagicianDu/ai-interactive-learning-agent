# Student Self-Study Web Textbook Design Spec

Date: 2026-05-12

## Goal

Introduce a learner-first course intent for converting large source materials
into a self-study Web textbook.

The target job is:

```text
I do not want to read an 800-page technical book from beginning to end.
I want to learn the core content through a configurable number of one-screen
Web pages.
Each page should teach one knowledge fragment well enough that I can continue
without a teacher explaining the slide.
```

This is not a professor's classroom slide deck. It is also not the existing
interaction-heavy mental-model lesson. It is a source-grounded Web textbook
for independent learners.

## Core Decision

Add a new course intent:

```ts
type CourseIntent =
  | "build_mental_model"
  | "professor_lecture_deck"
  | "student_self_study_textbook";
```

The new mode becomes the preferred route when the learner asks for:

- self-study from a long book
- a compressed Web textbook
- a configurable Web textbook page budget such as "80 pages", "100 pages", or
  "12 pages per unit"
- "I do not want to read the whole source"
- course-level understanding without teacher-facing materials

Keep `professor_lecture_deck` as a teacher or classroom-material mode. Do not
continue stretching that name to mean student self-study.

## Non-Goals

- Do not generate PPTX, Slides, Keynote, or exported slide files.
- Do not allow vertical scrolling inside a learning page.
- Do not expose internal artifacts, source maps, authoring rubrics, or approval
  queues to learners.
- Do not remove `build_mental_model`; it remains useful for interactive concept
  lessons.
- Do not delete `professor_lecture_deck`; it remains useful for teacher mode
  and future classroom materials.
- Do not weaken source grounding.

## Course Intent Semantics

### `build_mental_model`

Use when the learner wants to manipulate a concept, diagnose misconceptions, or
practice transfer through interaction.

Primary quality standard:

```text
problem -> visual model -> learner action -> feedback -> transfer
```

### `professor_lecture_deck`

Use when the user explicitly asks for teacher-facing lecture material, course
slides, classroom notes, discussion prompts, homework paths, or teaching aids.

Primary quality standard:

```text
course framing -> concept map -> definitions -> examples -> discussion -> homework
```

Visible words such as "lecture", "classroom", "homework", and "teacher notes"
are acceptable only in this mode.

### `student_self_study_textbook`

Use when the learner wants to learn from long source material without reading
all of it.

Primary quality standard:

```text
source claim -> learner question -> explanation -> example -> boundary -> takeaway
```

Every page must be understandable without a teacher. The page can use a board
layout, but the board must contain the explanation itself, not labels about
what a teacher would say.

## One-Screen Page Contract

Every learner-facing page in `student_self_study_textbook` must fit within one
browser viewport.

Rules:

- No vertical page scrolling during study.
- One page teaches one knowledge fragment.
- If a concept needs more explanation, split it into multiple pages.
- Dense source material should increase total page count, not page height.
- The renderer may use sidebars and navigation, but the study surface must stay
  one-screen.

For a long book, the system should propose a default total page budget instead
of treating any example number as mandatory.

Default policy:

```text
defaultTotalPages: 100 for long books
defaultUnitPages: 10
defaultRange: 80-120 pages for long books
```

If the learner does not specify a total page count, Codex/MCP should tell the
learner the default before authoring:

```text
我会先按默认约 100 页的一屏式 Web 教材规划；如果你希望更短或更长，可以直接说总页数或每个单元页数。
```

If the learner has no objection or continues without changing the number, use
the default. If the learner specifies a number, treat that learner-specified
budget as the source of truth.

Recommended default organization:

```text
overview unit: 8-12 pages
core topic units: 8-12 pages each
total target: about 80-120 pages unless the learner requests otherwise
```

The exact page count must remain learner-configurable. The planner should
track both `targetTotalPages` and `unitPages` when possible; if only one is
provided, derive the other conservatively from the planned unit count.

## Self-Study Page Model

Reuse `knowledgeBoard` as the structured page object, but change its meaning in
student mode.

```ts
type SelfStudyKnowledgePage = {
  id: string;
  type: LessonPage["type"];
  title: string;
  learningGoal: string;
  narrative: string;
  sourceAnchorIds: string[];
  knowledgeBoard: {
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
};
```

Interpretation:

- `headline`: a learner-facing knowledge question or statement.
- `coreProposition`: the answer this page teaches.
- `leftColumn`: concept, mechanism, causal chain, definition, or derivation.
- `rightColumn`: concrete example, counterexample, source evidence, or
  applicability boundary.
- `sourceTrace`: hidden evidence mapping for quality and optional source view.
- `bottomLine`: one durable sentence the learner can remember.

`title` and `narrative` remain compatibility fields, but the renderer should
prefer `knowledgeBoard` in `textbook_deck` display mode.

## Forbidden Student-Facing Patterns

Student self-study pages must not show teacher-facing or authoring-template
language.

Forbidden examples:

- 本讲定位
- 课堂讨论
- 教授讲义
- 课后作业
- 教学目标
- 教学设计
- 识别本页中的作用
- 帮助学习者理解资料大意
- 这一页应该讲
- lecture purpose
- teaching move
- homework path

Allowed replacements:

- "这个概念解决什么问题"
- "它如何工作"
- "看一个具体例子"
- "什么时候不适用"
- "为什么这个边界重要"
- "把它迁移到另一个场景"

## Page Sequence For A Long Book

For a long technical book compressed into a configurable Web textbook:

1. Overview unit, 8-12 pages
   - What problem domain does the book address?
   - What are the major knowledge clusters?
   - What should the learner ignore on first pass?
   - What reading path should the Web textbook follow?

2. Core topic units, usually 7-10 units
   - One unit per core topic, chapter cluster, method family, or pattern.
   - Each unit has 8-12 one-screen pages.
   - Each unit keeps chapter/source mapping, but does not mechanically follow
     chapters when topic-first learning is better.

3. Synthesis unit, optional
   - Compare the core topics.
   - Explain when each applies.
   - Give a final map the learner can use after leaving the course.

Default unit page sequence:

```text
1. problem question
2. source claim
3. concept definition
4. mechanism chain
5. worked example
6. evidence or figure interpretation
7. comparison
8. boundary / failure case
9. application scenario
10. summary map
```

The sequence is a guide, not a rigid template. A page can change role if the
source demands it, but every page must directly teach content.

## Authoring Flow

For `student_self_study_textbook`, Codex or another capable authoring agent
should do the following after `prepare_learning_course`:

1. Read authoring context, source semantics, chapter hints, and source anchors.
2. Build a course-level knowledge map:
   - core topics
   - dependencies
   - repeated mechanisms
   - examples and counterexamples
   - boundaries and failure modes
3. Allocate the requested total or per-unit page budget.
4. Write pages as self-contained textbook fragments.
5. Preserve `sourceAnchorIds` and `knowledgeBoard.sourceTrace`.
6. Publish only after quality gates pass.

MCP remains the validator and publisher. Codex remains responsible for actual
high-quality authoring.

## Natural Language Routing

Inference rules:

- If the learner says "自学", "不想读完整本书", "压缩成 80 页/100 页/若干页",
  "Web 教材",
  "快速掌握核心内容", or "自己看懂", infer
  `student_self_study_textbook`.
- If the learner says "教授 PPT", "课堂", "老师上课", "讲义", "课后作业",
  or "教师材料", infer `professor_lecture_deck`.
- If the learner says "交互", "操作", "心智模型", "反馈", "误区诊断", infer
  `build_mental_model`.
- If the request contains both self-study and professor wording, ask one
  clarification question:

```text
你更想要哪种形态？
1. 学生自学 Web 教材：每页直接讲内容，适合自己读完掌握核心知识。
2. 教师/教授课件：更像课堂讲授材料，适合老师拿来上课。
```

## Quality Gates

Add a `SelfStudyTextbookRubric` and use it only when
`courseIntent === "student_self_study_textbook"`.

The course should fail publication when:

- any page lacks `knowledgeBoard`
- a page contains forbidden teacher-facing phrases
- `coreProposition` is generic or only repeats the title
- both columns contain meta labels instead of teaching content
- a source-backed page lacks `sourceTrace`
- `sourceTrace.anchorId` does not match page-level `sourceAnchorIds`
- a page lacks at least one concrete example, counterexample, evidence note, or
  boundary
- a page is likely to exceed one viewport
- a long-source course compresses the source into too few pages without an
  explicit learner request

Warnings, not blockers:

- a page has no interaction
- a unit has no quiz
- a board has no visible source citations, because source trace is hidden by
  default

## Renderer Impact

No new renderer is required for the first implementation.

Use the existing `textbook_deck` display mode and `KnowledgeBoard` component,
but change the content contract:

- labels should be student-facing
- section items should be explanation content
- hidden source trace remains available for quality and future source view
- teacher-facing modules stay hidden

If the visual design still reads as a slide for instructors after the content
contract changes, refine `KnowledgeBoard` typography and spacing later. Do not
block the content-mode work on a new UI.

## Migration Strategy

Do not mutate `professor_lecture_deck` into the new meaning.

Implementation should:

1. Add `student_self_study_textbook` to `CourseIntent`.
2. Route self-study long-source requests to this new intent.
3. Add self-study blueprint templates.
4. Add self-study authoring guidance.
5. Add self-study quality gates.
6. Regenerate a successor preview from `Agentic_Design_Patterns.pdf`.
7. Keep the current `professor-agentic-design-depth-v2-20260511` preview as
   evidence of the old problem until the successor preview replaces it.

Recommended successor run id:

```text
self-study-agentic-design-textbook-20260512
```

## Acceptance Criteria

1. A learner request such as "我不想读 800 页书，想看 Web 教材掌握核心"
   infers `student_self_study_textbook`.
2. `prepare_learning_course` returns a course plan with an estimated total page
   budget around the learner's requested total, or the documented default when
   the learner did not specify one.
3. Authoring guidance forbids teacher-facing terms in student mode.
4. Published self-study pages include `knowledgeBoard` on every page.
5. Quality report fails when self-study pages contain teacher-facing template
   language.
6. Quality report passes a real source-backed self-study preview with no
   teacher-facing phrases.
7. Browser verification confirms:
   - at least one `knowledgeBoard` renders
   - forbidden teacher-facing text is absent
   - the current page fits one viewport
8. The final preview is reachable at:

```text
http://127.0.0.1:5173/#/preview/self-study-agentic-design-textbook-20260512
```

## Open Implementation Notes

- The first implementation can keep `unitPages` as the backward-compatible
  input shape, but long source planning should also expose
  `targetTotalPages`, `estimatedTotalPages`, and a user-facing default-page
  reminder when the learner did not specify a page budget.
- If a learner requests exactly 100 pages, the planner can distribute pages
  across units rather than forcing every unit to the same length.
- Existing `knowledgeBoard` type is sufficient for v1; do not add a second page
  schema until content quality proves the need.
- The quality gate should inspect learner-facing text, not only JSON fields.
