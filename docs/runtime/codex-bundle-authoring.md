# Codex Bundle Authoring Contract

This is the default authoring contract when Codex or Claude uses learner-facing MCP tools.

## Default Flow

```text
learning_agent.create_learning_project
  -> learning_agent.get_authoring_context
  -> Codex reads learner brief, source anchors, recommended units, and publish constraints
  -> Codex authors coursePack + lessons
  -> learning_agent.publish_learning_course
  -> learning_agent.get_learning_preview
```

Do not ask learners to approve internal artifacts in this default path.

## Required Bundle Shape

`publish_learning_course` expects:

```ts
{
  runId: string;
  coursePack: CoursePack;
  lessons: Lesson[];
}
```

Every `coursePack.units[]` item that has a lesson must reference a matching `lessonId`.

## Course Organization

Respect the learner brief fields:

- `strategy=overview_plus_topic`: create one overview lesson, then core topic lessons.
- `strategy=chapter_guided`: preserve chapter or section order; use chapter-style units and `chapterRefs`.
- `strategy=topic_guided`: rebuild lessons from concept clusters while keeping source mapping.
- `strategy=task_guided`: organize lessons around learner tasks and practice actions.
- `strategy=hybrid`: create a global overview, then pedagogical topic units with chapter mapping.

If `selectedChapters` or `selectedTopics` is present, treat it as a user constraint, not a suggestion.

For `courseIntent=student_self_study_textbook`, selected topics define the course scope. A request for overview plus three topics with `unitPages=10` should become one bundle with four units and about 40 pages. The default 100-page self-study budget applies to open-ended whole-book expansion only; do not redistribute selected topics into that budget unless the learner explicitly requested a total page count.

When authoring self-study textbook bundles, read `docs/runtime/self-study-golden-samples.md` before writing pages. It records accepted title density, non-repetition rules, and the expected student-facing compressed textbook tone.

## Lesson Requirements

Each lesson must be Chinese-first and include:

- `learningObjectives`
- `prerequisites`
- `pages`
- `misconceptions`
- `transferTasks`
- `summary`

Each lesson must include at least:

- 3 `visualSpec` pages
- 2 meaningful `interactionSpec` pages
- 2 `assessmentSpec` pages
- explanatory `feedbackSpec` on assessment pages
- 1 misconception check
- 1 transfer task

## Source Grounding

For book, paper, patent, blog, documentation, or notes-backed projects:

- add lesson-level `sourceContext.sourceAnchorIds`, or
- add page-level `sourceAnchorIds`, or
- mark inferred/analogy pages with `grounding.kind = "inferred"` or `"analogy"`.

If source grounding is missing, `publish_learning_course` returns `revision_required`.

## Publish Artifacts And Quality

Publishing writes machine-readable audit artifacts under `runs/<run-id>/artifacts/`:

- `course-ir.vN.json`: versioned Course IR for preview, revision, export, and future runtimes.
- `lesson-bundle.vN.json`: normalized submitted `coursePack` and `lessons`.
- `publish-validation.vN.json`: blocking publish validation issues.

It also writes `runs/<run-id>/quality/course-quality-report.json`.

The normal learner response should stay compact: preview URL, course shape, and `qualityReport.status/score/checks/issueSummary/topIssues`. Do not ask learners to approve these artifacts. Use `topIssues` to revise the bundle and call `publish_learning_course` again.

`export_learning_course` blocks export when `qualityReport.status` is `failed`. Use `expertOverrideReason` only for maintainer/debug exports, never as the default learner path.

## Feedback Quality

Feedback must explain the cause of the result. Avoid only saying "正确 / 错误". Good feedback names:

- what assumption the learner likely made
- why that assumption works or fails
- which rule or mental model should be updated

## Transfer

Every course should end with a task that asks learners to apply the same mechanism in a related but new context.
