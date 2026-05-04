# visual-pedagogy

## Description

Decide which concepts need diagrams, animations, comparisons, timelines, or visual metaphors.

## When To Use

Use after page sequencing and before component design.

## Product Contract

- Codex authors visual plans as part of the final lesson bundle; MCP validates and publishes the result.
- Keep diagram labels, captions, visual state names, and visual explanations中文优先.
- Source-backed visuals should preserve relevant `sourceAnchorIds` or mark analogy/inferred grounding.
- 不要让学习者审批内部 artifacts; visual planning is an internal authoring step, while learners review the final preview.

## Inputs

- Page sequence
- Learning goals
- Concepts and misconceptions

## Outputs

```json
{
  "visualPlan": [
    {
      "pageId": "",
      "visualType": "",
      "teachingPurpose": "",
      "elements": []
    }
  ]
}
```

## Workflow

1. Identify hidden structure, flow, state, or causality on each page.
2. Choose the smallest visual form that reveals that idea.
3. Define key elements and labels.
4. Define meaningful states if animation is needed.
5. Avoid decorative visuals.
6. Check that visuals reduce prose rather than repeat it.

## Quality Checklist

- Every visual has a teaching purpose.
- Labels are explicit.
- Diagrams have one dominant idea.
- Animation shows meaningful change.
- Visuals are not purely ornamental.
