# interaction-design

## Description

Convert concepts into meaningful learner actions with explanatory feedback.

## When To Use

Use after the visual plan and before UI implementation.

## Product Contract

- Codex authors interaction specs and feedback in the final lesson bundle; MCP validates and publishes the course.
- Keep learner actions, option labels, observations, and feedback中文优先.
- Source-backed interaction pages should preserve `sourceAnchorIds` or explicit inferred/analogy grounding.
- 不要让学习者审批内部 artifacts; learners should interact with the preview, not review interaction-design JSON.

## Inputs

- Page sequence
- Visual plan
- Misconceptions
- Target interactions

## Outputs

```json
{
  "interactions": [
    {
      "pageId": "",
      "interactionType": "",
      "learnerAction": "",
      "expectedObservation": "",
      "feedback": "",
      "misconceptionAddressed": ""
    }
  ]
}
```

## Workflow

1. Define what the learner must do.
2. Define what they should notice.
3. Identify the misconception the action may reveal.
4. Define correct and incorrect feedback.
5. Connect the action to the page learning goal.
6. Remove interactions that only reveal text or decorate the page.

## Quality Checklist

- Learner action requires thinking.
- Result is immediate and visible.
- Feedback explains the mechanism.
- Interaction reveals cause and effect.
- Interaction improves the mental model.
