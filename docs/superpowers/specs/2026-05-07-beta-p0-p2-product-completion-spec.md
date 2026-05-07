# Beta P0-P2 Product Completion Spec

Date: 2026-05-07

## Final Goal

Ship a seed-user-ready beta path where a learner can start in Codex or Claude with natural language, provide a source or topic, choose audience/difficulty/structure, and quickly receive a Chinese, source-grounded, university-grade multi-unit web lesson preview.

The beta is complete when the default path no longer feels like a developer workflow or a deterministic sample generator:

1. Source semantics reflect real source content, not only generic source-kind labels.
2. Codex/Claude can prepare course authoring in one learner-facing MCP call after basic needs are clear.
3. Published authored courses can be compared against deterministic drafts with no blocking scope, grounding, academic-depth, learner-action, or transfer gaps.
4. Seed users and open-source adopters have a concise, reproducible path to install, run, author, preview, revise, export, and report issues.

## Product Priorities

### P0: Real Source Semantics Kernel

Goal: Course plans and page blueprints must carry source-specific teaching material.

Required behavior:

- Extract concept candidates from headings, repeated technical terms, source labels, and source quotes.
- Extract examples, limitations, claims or evidence hints, misconceptions, and teaching angles from the actual source text.
- Preserve source-kind defaults for books, papers, patents, blogs, notes, documentation, and topic-only requests.
- Expose these semantic hints in `learning_agent.get_authoring_context`.
- Feed unit-level semantic hints into `contentBlueprint.units[*]` so Codex can write concrete pages.

Acceptance:

- A markdown/PDF-like source mentioning concrete terms such as "tool feedback", "reflection", "evaluation", or "limitations" surfaces those terms in `sourceSemantics` and unit blueprints.
- Existing source-kind behavior remains stable.
- `authoring-context` artifacts persist the semantic hints.

### P1: Natural-Language Course Preparation Entry

Goal: Codex/Claude should need one learner-facing MCP call to prepare a course after the learner supplies enough information.

Required behavior:

- Add `learning_agent.prepare_learning_course`.
- Input mirrors `create_learning_project`.
- If clarification is required, return only learner-answerable questions.
- If ready, create/update the learner project and return authoring context in the same response.
- The response must include the recommended next tool: `learning_agent.publish_learning_course`.

Acceptance:

- Missing audience or difficulty returns `clarification_required`.
- A complete request returns `authoring_context_ready`, recommended units, content blueprint, source semantics, and Codex publishing instruction.
- Tool appears in MCP tool list, JSON-RPC, runtime tools, and bundle docs.

### P2: Seed-User / Open-Source Beta Acceptance

Goal: A new user can try the beta without reading internal runtime architecture docs.

Required behavior:

- Add a compact seed-user quickstart for the Codex/Claude route.
- Include source examples for book, paper, patent, blog, notes, documentation, and topic-only.
- Document the expected loop: prepare, author, publish, preview, compare, revise, export.
- Add automated checks that the quickstart and MCP/skills bundle mention the new prepare tool.

Acceptance:

- `npm run bundle:check` validates the new quickstart and prepare tool mentions.
- `npm run release:check` passes.
- A real source trial verifies authored-vs-draft comparison has no remaining gaps.

## Non-Goals

- Do not build full Canvas/Whiteboard, Playground, AI Tutor, or Teacher Mode in this slice.
- Do not replace existing `create_learning_project` or `get_authoring_context`; keep them available for advanced/explicit workflows.
- Do not commit private or copyrighted generated course content.
- Do not make deterministic generation the recommended high-quality authoring path.

## Test Plan

- Unit tests:
  - `tools/agent-runtime/learner/source-semantic-extractor.test.ts`
  - `tools/agent-runtime/learner/authoring-context-service.test.ts`
  - new `tools/agent-runtime/learner/prepare-learning-course-service.test.ts`
  - `tools/mcp-server/runtime-tools.test.ts`
  - `tools/mcp-server/json-rpc-server.test.ts`
  - `scripts/learning-agent-bundle.test.ts`
- Targeted commands:
  - `npx vitest run tools/agent-runtime/learner/source-semantic-extractor.test.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/prepare-learning-course-service.test.ts --pool threads`
  - `npx vitest run tools/mcp-server/runtime-tools.test.ts tools/mcp-server/json-rpc-server.test.ts scripts/learning-agent-bundle.test.ts --pool threads`
- Full gate:
  - `npm run release:check`

## Final Acceptance

The P0-P2 slice is done only when:

- The spec and implementation plan are checked into docs.
- Source semantics v2 is exposed in authoring context and content blueprint.
- `learning_agent.prepare_learning_course` works through direct service, runtime tools, JSON-RPC, and tool-list contracts.
- Seed-user quickstart and bundle checks include the prepare flow.
- A real source authored-vs-draft comparison reports `remainingGaps: []`.
- `npm run release:check` passes.
