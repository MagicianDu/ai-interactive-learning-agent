# lesson-critic

## Description

Review a lesson against the learning principles and quality rubric.

## When To Use

Use before implementation, after implementation, and before publishing.

## Inputs

- Lesson object
- Rendered lesson screenshots or preview if available
- Quality rubric

## Outputs

```json
{
  "score": 0,
  "strengths": [],
  "issues": [],
  "requiredFixes": [],
  "optionalImprovements": []
}
```

## Workflow

1. Check learning path coherence.
2. Check visual teaching value.
3. Check interaction purpose and feedback quality.
4. Check assessment coverage.
5. Check transfer quality.
6. Identify required fixes before implementation or release.
7. Separate blocking issues from optional polish.

## Quality Checklist

- Findings are specific and actionable.
- Required fixes map to learning or product risk.
- Feedback does not only comment on visual styling.
- The critique protects the mental model goal.

