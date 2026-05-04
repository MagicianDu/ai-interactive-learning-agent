# Roadmap

For the current seed-ready product state, verified capabilities, and product gaps, see:

- `docs/product/current-product-state.md`

For the forward development plan centered on MCP plus skills, see:

- `docs/product/future-development-plan.md`

For the complete product target, user journeys, capability map, and acceptance milestones, see:

- `docs/superpowers/specs/2026-05-02-complete-learning-product-development-spec.md`

For the earlier full product delivery path, acceptance goals, and implementation slices, see:

- `docs/superpowers/plans/2026-04-29-full-product-delivery-roadmap.md`

For the current seed-ready implementation plan, see:

- `docs/superpowers/plans/2026-05-02-seed-ready-product.md`

## Current Seed-Ready Track

- Learner entrypoint is Codex/MCP natural language, not internal artifact approval.
- Default high-quality flow is `create_learning_project -> get_authoring_context -> publish_learning_course -> get_learning_preview`, with Codex/Claude authoring the course bundle and MCP validating/publishing it.
- `generate_grounded_course` remains available for deterministic quick drafts and smoke regression, not as the default high-quality authoring path.
- Feedback flow is `revise_learning_course -> apply_learning_revision -> get_learning_preview`.
- Export flow is `export_learning_course`.
- Long sources generate one overview unit plus multiple focused units while preserving chapter/topic/source mapping.
- Source regression covers book, paper, patent, and blog samples with generated unit count and semantic readiness status.

## Phase 0: Scaffold and Design

- Initialize repository structure.
- Capture product principles and quality rubric.
- Define lesson schema.
- Define agent skills.
- Create the first lesson design object.

## Phase 1: Web Deck MVP

- Add React, TypeScript, Vite, and Tailwind implementation.
- Implement reusable deck components.
- Implement visual, interaction, and assessment components.
- Render the database index lesson from structured data.
- Add local build and verification workflow.

## Phase 2: Canvas Knowledge Map

- Add spatial concept map renderer.
- Support concept dependencies and clickable nodes.
- Link map nodes to web deck pages and playgrounds.

## Phase 3: Interactive Playground

- Add sandbox-style experiments for topics such as indexes, caching, RAG, and gradient descent.
- Make cause and feedback central to every control.

## Phase 4: AI Tutor Mode

- Add conversational guidance around the visual objects.
- Diagnose misconceptions through learner responses.
- Avoid replacing the visual lesson with chat-only explanation.
- Let the tutor route learner feedback into targeted course revisions instead of exposing internal artifacts.

## Phase 5: Teacher Mode

- Generate instructor notes, pacing guidance, classroom questions, exercises, and review tasks.
