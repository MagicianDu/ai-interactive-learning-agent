# Product Core Pruning Design Spec

Date: 2026-05-07

## Final Goal

Reduce the default product surface to the smallest user-visible loop that helps a learner get from source material to an actual learning experience.

The project should still support authoring, grounding, quality checks, regression tests, operator gates, and future learning modes. Those capabilities should be hidden from the default learner path unless the user explicitly asks for expert or development mode.

## Product Principle

Use Occam's razor around the learning job.

The default product exists to help a learner:

1. Express what they want to learn.
2. Confirm source scope, audience, difficulty level, structure, and pages per unit.
3. Receive a Chinese, source-backed, page-based learning course.
4. Learn one screen at a time with visuals, learner actions, checks, and feedback.
5. Give feedback and receive a revised course.
6. Export or share the course when it is useful.

Anything that does not directly serve this loop is internal by default.

## Hidden-First Decision

This pruning pass should hide, profile, or archive non-core surfaces before deleting code.

Rationale:

- The repository contains useful operator and benchmark machinery that still protects quality.
- Deleting code now would mix product simplification with risky runtime removal.
- The immediate user problem is surface-area confusion, not binary size or runtime cost.
- Hidden profiles allow Codex and Claude to see a simpler tool set while maintainers keep advanced tools available.

## Default Learner Path

The default natural-language path for Codex, Claude, or similar clients is:

```text
learning_agent.prepare_learning_course
Codex or Claude authors coursePack and lessons
learning_agent.publish_learning_course
learning_agent.get_learning_preview
learning_agent.revise_learning_course
learning_agent.apply_learning_revision
learning_agent.export_learning_course
```

`learning_agent.list_learning_projects` and `learning_agent.archive_learning_project` are allowed learner utilities.

Default users should not see or approve:

- `source-map`
- `concept-map`
- `curriculum-plan`
- `critic-report`
- approval gates
- artifact versions
- child unit runs
- promotion commands
- deterministic draft tooling

## Tool Profiles

Introduce an explicit MCP tool profile model.

### Learner Profile

Default profile. It exposes only:

- `learning_agent.prepare_learning_course`
- `learning_agent.list_learning_projects`
- `learning_agent.archive_learning_project`
- `learning_agent.publish_learning_course`
- `learning_agent.get_learning_preview`
- `learning_agent.revise_learning_course`
- `learning_agent.apply_learning_revision`
- `learning_agent.export_learning_course`

### Authoring Profile

Used by maintainers and advanced agent flows that need source context and quality comparison.

It exposes learner tools plus:

- `learning_agent.create_learning_project`
- `learning_agent.get_authoring_context`
- `learning_agent.compare_authoring_quality`
- `learning_agent.create_quality_revision`
- `learning_agent.generate_grounded_course`

`learning_agent.generate_grounded_course` is a deterministic draft and benchmark aid. It is not a product-quality generation path.

### Operator Profile

Used for debugging, artifact inspection, review gates, and legacy workflow continuation.

It exposes all tools. This includes:

- `learning_agent.generate_quick_preview`
- `learning_agent.init_run`
- `learning_agent.plan_run`
- `learning_agent.init_from_plan`
- `learning_agent.status`
- `learning_agent.beta_status`
- `learning_agent.run_until_gate`
- `learning_agent.list_artifacts`
- `learning_agent.read_artifact`
- `learning_agent.submit_artifact`
- `learning_agent.approve_gate`
- `learning_agent.revise_gate`
- `learning_agent.list_units`
- `learning_agent.run_next`
- `learning_agent.run_course`
- `learning_agent.promote_units`
- `learning_agent.promote_lesson`

## Frontend Default Surface

The default UI should feel like a learning surface, not a product console.

Keep visible by default:

- Web deck learning page
- Course unit switcher
- Page progress
- Current page feedback
- Source evidence as a secondary view
- Project library as a secondary view

Hide or move to an experimental group:

- knowledge map
- tutor mode
- teacher mode
- playground mode
- standalone assessment mode

These future modes can remain implemented and tested, but they should not be advertised as first-class product capabilities until they materially improve the default learner loop.

## Documentation Surface

The default open-source narrative should describe one usable product path.

README should prioritize:

1. What the product does.
2. How to run the web lesson.
3. How to use the Codex MCP learner path.
4. What source types are supported now.
5. What is internal, experimental, or future.

Historical planning documents should move out of the main product path. They may remain in the repository under an archive folder, with a short index explaining that they are development history.

## Skills Surface

Default installed skills should teach the agent one path:

- `learning-agent-operator`
- `source-to-course`
- `learner-feedback-revision`

`learning-agent-runner` and older decomposition skills can remain internal. They should not be presented as the default learner workflow.

## Non-Goals

- Do not delete advanced runtime services in this pruning pass.
- Do not remove quality checks, regression fixtures, source grounding, or publishing validation.
- Do not redesign the lesson renderer.
- Do not build account, hosting, billing, telemetry, or sharing services.
- Do not make deterministic generation the high-quality product path.

## Acceptance Criteria

Product core pruning is complete when:

- `npm run mcp -- --list-tools` defaults to the learner profile.
- Operator tools remain available through an explicit profile.
- README and runtime docs describe the learner golden path first.
- Skills stop presenting artifact-gated flows as the default user path.
- The default UI navigation emphasizes learning, course units, sources, feedback, and project library.
- Future modes are hidden from default navigation or clearly marked experimental.
- Existing stable tests and build pass.
- No source-backed quality protection is removed.

