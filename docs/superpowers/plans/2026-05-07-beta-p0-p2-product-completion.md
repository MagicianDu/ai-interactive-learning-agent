# Beta P0-P2 Product Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the beta P0-P2 path so Codex/Claude can prepare, author, publish, preview, compare, revise, and export a Chinese source-grounded multi-unit learning course from natural language.

**Architecture:** Keep `create_learning_project` and `get_authoring_context` as composable primitives, then add a learner-facing one-call preparation service on top. Enrich the existing source semantic extractor and content blueprint rather than introducing a new lesson schema.

**Tech Stack:** TypeScript, Node.js, Vitest, MCP JSON-RPC server, existing React/Vite preview runtime.

---

## File Map

- `tools/agent-runtime/learner/source-semantic-extractor.ts`: enrich real-source semantic extraction.
- `tools/agent-runtime/learner/source-semantic-extractor.test.ts`: lock source-specific semantic behavior.
- `tools/agent-runtime/learner/content-quality-blueprint.ts`: carry unit-level semantic hints into content blueprints.
- `tools/agent-runtime/learner/content-quality-blueprint.test.ts`: verify blueprint semantic hints.
- `tools/agent-runtime/learner/authoring-context-service.ts`: expose `sourceSemantics` and semantic hints in authoring context.
- `tools/agent-runtime/learner/authoring-context-service.test.ts`: verify persisted context and source-specific hints.
- `tools/agent-runtime/learner/prepare-learning-course-service.ts`: new one-call learner-facing prepare service.
- `tools/agent-runtime/learner/prepare-learning-course-service.test.ts`: red/green tests for ready and clarification paths.
- `tools/agent-runtime/index.ts`: export new service.
- `tools/mcp-server/tool-contracts.ts`: add `learning_agent.prepare_learning_course`.
- `tools/mcp-server/runtime-tools.ts`: route new tool.
- `tools/mcp-server/runtime-tools.test.ts`: verify runtime behavior.
- `tools/mcp-server/json-rpc-server.test.ts`: verify JSON-RPC tool call.
- `scripts/learning-agent-bundle.ts`: include new quickstart doc in bundle check.
- `scripts/learning-agent-bundle.test.ts`: verify prepare tool and quickstart are bundled.
- `scripts/install-codex-mcp.ts`: require prepare tool in Codex MCP check.
- `docs/runtime/seed-user-beta-quickstart.md`: concise seed-user/open-source usage path.
- `skills/source-to-course/SKILL.md`: recommend prepare-first flow.
- `skills/learning-agent-operator/SKILL.md`: include prepare-first flow and fallback primitives.

## Tasks

### Task 1: P0 Source Semantics V2

- [ ] Write failing tests in `source-semantic-extractor.test.ts` for extracting real terms, evidence hints, limitations, examples, and misconceptions from quotes/headings.
- [ ] Run `npx vitest run tools/agent-runtime/learner/source-semantic-extractor.test.ts --pool threads` and confirm the new tests fail because semantic fields are missing.
- [ ] Implement semantic fields in `source-semantic-extractor.ts`:
  - `keyTerms`
  - `evidenceHints`
  - `limitationHints`
  - `sourceSpecificTeachingMoves`
- [ ] Keep existing concept label defaults stable for book, paper, patent, blog, and unknown kinds.
- [ ] Re-run the targeted source semantic tests and confirm pass.

### Task 2: P0 Authoring Context and Blueprint Semantic Hints

- [ ] Write failing tests in `content-quality-blueprint.test.ts` and `authoring-context-service.test.ts` for `semanticHints`.
- [ ] Run the targeted tests and confirm failure.
- [ ] Extend `ContentBlueprint.units[*]` with `semanticHints`.
- [ ] Extend `AuthoringContextResult` with `sourceSemantics`.
- [ ] Feed semantic hints from `extractSourceSemantics` into `buildContentBlueprint`.
- [ ] Re-run targeted tests and confirm pass.

### Task 3: P1 One-Call Course Preparation Service

- [ ] Create failing tests in `prepare-learning-course-service.test.ts`:
  - complete request returns `authoring_context_ready`
  - incomplete request returns `clarification_required`
- [ ] Run targeted tests and confirm failure because the service is missing.
- [ ] Implement `PrepareLearningCourseService` using `LearnerProjectService` and `AuthoringContextService`.
- [ ] Export it from `tools/agent-runtime/index.ts`.
- [ ] Re-run targeted tests and confirm pass.

### Task 4: P1 MCP Tool Contract and JSON-RPC Wiring

- [ ] Add failing runtime and JSON-RPC tests for `learning_agent.prepare_learning_course`.
- [ ] Run targeted MCP tests and confirm failure.
- [ ] Add the tool to `tool-contracts.ts`.
- [ ] Route the tool in `runtime-tools.ts`.
- [ ] Update install check expectations.
- [ ] Re-run targeted MCP tests and confirm pass.

### Task 5: P2 Seed-User and Open-Source Quickstart

- [ ] Add `docs/runtime/seed-user-beta-quickstart.md`.
- [ ] Update `skills/source-to-course/SKILL.md` and `skills/learning-agent-operator/SKILL.md`.
- [ ] Update `scripts/learning-agent-bundle.ts` and bundle tests so quickstart and prepare flow are required.
- [ ] Run `npx vitest run scripts/learning-agent-bundle.test.ts --pool threads`.

### Task 6: Final Verification and Commit

- [ ] Run targeted unit tests for P0-P2.
- [ ] Run a real source trial with authored-vs-draft comparison and verify `remainingGaps: []`.
- [ ] Run `npm run release:check`.
- [ ] Run `git diff --check`.
- [ ] Commit with message `Complete beta P0-P2 preparation path`.

## Acceptance Metrics

- Source semantic tests prove at least four real terms and at least one limitation/evidence hint are extracted from a real-looking source.
- Authoring context includes `sourceSemantics.keyTerms`, `sourceSemantics.evidenceHints`, and `contentBlueprint.units[*].semanticHints`.
- `learning_agent.prepare_learning_course` is listed by the MCP server and callable through runtime tools and JSON-RPC.
- Bundle check requires the prepare-first quickstart.
- Real source comparison reports `remainingGaps: []`.
- `npm run release:check` exits 0.
