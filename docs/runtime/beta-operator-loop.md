# Beta Operator Loop

This document defines the first beta product shape for Codex, Claude, and future OpenClaw-style natural-language operators.

## Goal

The beta loop lets an operator start from a technical source or topic, produce a reviewed course plan, generate a total overview lesson plus focused topic lessons, and promote approved lesson artifacts into the web product.

The chat agent remains the natural-language interface. The local runtime remains the durable source of truth for run config, artifacts, approvals, and child unit state.

## Standard Flow

1. Call `learning_agent.plan_run` with the user's source, audience, language, page count per unit, and learning goal.
2. Show `summary` and `reviewItems` to the operator.
3. Call `learning_agent.init_from_plan` after approval.
4. Call `learning_agent.beta_status` before advancing a run or after any approval.
5. Advance parent gates with `learning_agent.run_until_gate`.
6. Review exact artifact versions with `learning_agent.read_artifact`.
7. Approve or revise `source-map`, `concept-map`, and `curriculum-plan`.
8. Call `learning_agent.run_course` for selected units or all units.
9. Review and approve each child unit's `learning-architecture`, `lesson`, and `critic-report`.
10. Call `learning_agent.promote_units` after approved child lessons and critic reports.

## Source Strategy

For book, paper, patent, blog, documentation, and folder-backed runs, the default beta strategy is `overview_plus_topic`.

- The overview unit keeps full source anchor coverage.
- Topic units receive focused source-anchor slices instead of the entire source.
- Concept coverage maps each core concept to the overview unit plus the most relevant topic unit.
- MCP and CLI status responses summarize source anchors; full anchor lists stay in `curriculum-plan`.

## Operator Rules

- Use `beta_status` to decide the next action.
- Use `read_artifact` only for the specific artifact under review.
- Approve an exact version such as `v1`; do not approve an implicit draft.
- Revise instead of approving when source extraction warnings, weak concept coverage, or poor pedagogy affect downstream lessons.
- Promote only after child lessons and critic reports are approved.

## Current Beta Limits

- `mock` is deterministic and used for automated checks.
- `codex-manual` creates durable prompts and waits for an operator-generated JSON artifact.
- Direct model API adapters are not implemented yet.
- The frontend renders promoted lessons and course packs, but the beta priority is the runtime and source-ingestion kernel.
