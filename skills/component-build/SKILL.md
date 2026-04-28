# component-build

## Description

Implement reusable React components for interactive learning experiences.

## When To Use

Use only after the structured lesson object and component boundaries are clear.

## Inputs

- Lesson schema
- Page type requirements
- Visual and interaction specs
- Existing component library if any

## Outputs

- Component files
- Example usage
- Props documentation
- Basic tests when a test setup exists

## Workflow

1. Identify reusable component categories: deck, visual, interaction, assessment.
2. Build the smallest reusable component that satisfies the lesson need.
3. Keep lesson-specific data outside generic components.
4. Support explanatory feedback states.
5. Check responsiveness for laptop and tablet layouts.
6. Add tests for stateful interactions when practical.

## Quality Checklist

- Components are reusable across lessons.
- Props match the lesson schema.
- Components do not hard-code one lesson's content.
- Interactions are accessible and keyboard-friendly where practical.
- Visual layout supports clear teaching hierarchy.

