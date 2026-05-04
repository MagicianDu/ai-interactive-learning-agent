# lesson-critic

## Description

Review a lesson against the learning principles and quality rubric.

## When To Use

Use before implementation, after implementation, and before publishing.

## Product Contract

- Codex uses the critique to revise the final `coursePack` and `lessons`; MCP should only publish after blocking issues are fixed.
- Critique learner-facing content for中文优先 quality, not only schema validity.
- Source-backed critique must check `sourceAnchorIds`, inferred/analogy grounding, and unsupported claims.
- 不要让学习者审批内部 artifacts; convert critic issues into learner-visible course revisions or concise operator notes.

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
