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

## Feedback Quality

Feedback must explain the cause of the result. Avoid only saying "正确 / 错误". Good feedback names:

- what assumption the learner likely made
- why that assumption works or fails
- which rule or mental model should be updated

## Transfer

Every course should end with a task that asks learners to apply the same mechanism in a related but new context.
