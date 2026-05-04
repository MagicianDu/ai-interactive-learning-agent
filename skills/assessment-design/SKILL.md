# assessment-design

## Description

Generate quizzes, prediction tasks, misconception checks, and transfer tasks.

## When To Use

Use after the learning path and interaction plan are clear.

## Product Contract

- Codex authors assessment pages, answer keys, and explanatory feedback before MCP publishing.
- Keep prompts, options, explanations, misconception checks, and transfer tasks中文优先.
- Source-backed assessment pages should preserve `sourceAnchorIds` or mark inferred/analogy grounding.
- 不要让学习者审批内部 artifacts; learner validation happens through quizzes, feedback, and preview revisions.

## Inputs

- Learning objectives
- Page sequence
- Misconceptions
- Transfer goals

## Outputs

```json
{
  "assessments": [
    {
      "type": "",
      "prompt": "",
      "options": [],
      "answer": "",
      "feedback": ""
    }
  ]
}
```

## Workflow

1. Create at least one recall or comprehension check.
2. Create at least one prediction check.
3. Create at least one misconception check.
4. Create at least one transfer challenge.
5. Write feedback for correct and incorrect answers.
6. Remove trivia questions.

## Quality Checklist

- Assessments test mental models.
- Wrong options reflect plausible misconceptions.
- Feedback explains why.
- Transfer uses a new but related context.
- The lesson includes recall, prediction, misconception, and transfer.
