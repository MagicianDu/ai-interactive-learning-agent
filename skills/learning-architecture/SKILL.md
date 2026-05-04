# learning-architecture

## Description

Turn concepts into a coherent learning path that builds a mental model from problem to transfer.

## When To Use

Use after concept extraction and before visual or UI design.

## Product Contract

- Codex authors the learning path from the authoring context; MCP validates and publishes later.
- Keep page titles, learning goals, learner actions, feedback, and summaries中文优先.
- Preserve `sourceAnchorIds` or explicit inferred/analogy grounding when planning source-backed pages.
- 不要让学习者审批内部 artifacts; learner approval happens on the previewable course, not on source maps or curriculum internals.

## Inputs

- Concept list
- Prerequisites
- Audience
- Misconceptions
- Target lesson duration

## Outputs

```json
{
  "audience": "",
  "prerequisites": [],
  "learningObjectives": [],
  "pageSequence": []
}
```

## Workflow

1. Define the learner and prerequisite assumptions.
2. Write 3 to 6 learning objectives.
3. Start with a concrete problem.
4. Sequence pages from intuition to structure to manipulation to formalization.
5. Add prediction and misconception checks.
6. End with transfer and summary.
7. Ensure each page has one learning goal.

## Quality Checklist

- The path starts from a real problem.
- Formal terms appear after intuition.
- Each page contributes to the mental model.
- Transfer is built into the sequence.
- The sequence is not a blog outline.
