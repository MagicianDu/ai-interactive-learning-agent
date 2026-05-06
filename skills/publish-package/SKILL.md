# publish-package

## Description

Package a lesson as a runnable static web experience.

## When To Use

Use after the lesson builds locally and has passed critique.

## Inputs

- Implemented lesson
- Build scripts
- README instructions
- Deployment target if any

## Outputs

- Build instructions
- Deployable artifacts
- README updates
- Demo route

## Workflow

1. Confirm local install, typecheck, lint, and build.
2. Confirm the target lesson route is reachable.
3. Verify navigation, visuals, interactions, and feedback.
4. Check `qualityReport.status`. If it is `failed`, revise first; use `expertOverrideReason` only for maintainer/debug exports.
5. Document how to run and extend.
6. Produce static build artifacts or deployment instructions.

## Quality Checklist

- Build is reproducible.
- Failed quality reports are not exported in the normal learner flow.
- Instructions are clear.
- Demo route is documented.
- Lesson remains data-driven.
- No unfinished implementation notes appear in the learner-facing UI.
