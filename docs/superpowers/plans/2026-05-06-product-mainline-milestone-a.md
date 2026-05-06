# Product Mainline Milestone A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Milestone A from the product mainline spec: Source Graph V2 plus Course Planning V2.

**Architecture:** Add source graph construction as a runtime contract shared by authoring context, grounded generation, and regression checks. Extend course planning output with strategy reasoning, source mapping, and acceptance expectations that downstream quality gates can consume.

**Tech Stack:** TypeScript, Vitest, Node fs runtime, existing MCP/runtime services.

---

## Development Goals

### Goal 1: Source Graph V2

Turn normalized source structure, anchors, and semantic extraction into a durable `SourceGraph` artifact.

Required outputs:

- `runs/<run-id>/artifacts/source-graph.v*.json`
- `runs/<run-id>/artifacts/source-anchors.v*.json`
- `runs/<run-id>/artifacts/source-concepts.v*.json`
- `runs/<run-id>/artifacts/source-coverage.v*.json`

Acceptance:

- Source graph contains source units, anchors, concept candidates, examples, misconceptions, candidate interactions, and source-kind metadata.
- Book sources preserve chapter-level source units when chapter headings exist.
- Paper sources can classify problem, method, experiment, conclusion, and limitation sections when present.
- Patent sources can classify claim, background, embodiment, and figure units when present.
- Blog sources preserve heading hierarchy and argument-flow units.
- Public fixture regression reports source graph status for book, paper, patent, and blog.

### Goal 2: Course Planning V2

Make course planning strategy explicit, explainable, and enforceable.

Required outputs:

- `runs/<run-id>/artifacts/course-plan.v*.json`
- authoring context `coursePlan.strategyReason`
- authoring context `coursePlan.acceptanceExpectations`
- unit-level expectations for interactions, assessments, transfer, and source coverage

Acceptance:

- Planner supports `overview_plus_topic`, `chapter_guided`, `topic_guided`, `task_guided`, and `hybrid`.
- If strategy is missing or unknown, planner records a recommendation reason instead of silently hiding the fallback.
- Long-source plans include overview plus focused units by default.
- Chapter-guided units preserve chapter references.
- Topic-guided and hybrid units preserve chapter/source references.
- Task-guided units include task/scenario labels and transfer expectations.

### Goal 3: Documentation And Operator Contracts

Keep Codex/MCP operation aligned with the new artifacts without exposing them to learner mode.

Acceptance:

- Runtime docs explain `sourceGraph` and `coursePlan` artifacts.
- Skills mention that learner mode should summarize course structure and quality, not ask users to approve source graph artifacts.
- Expert/operator mode can inspect the artifacts when requested.

## Todo List

### Task 1: Source Graph Contract And Tests

- [ ] Add failing tests for a `buildSourceGraph` contract covering book, paper, patent, and blog inputs.
- [ ] Verify tests fail because the source graph module does not exist.
- [ ] Implement `tools/agent-runtime/source/source-graph.ts`.
- [ ] Re-run source graph tests and confirm they pass.

Targeted test:

```bash
npm run test:unit -- tools/agent-runtime/source/source-graph.test.ts
```

### Task 2: Persist Source Graph Artifacts

- [ ] Add failing grounded course test asserting source graph artifact paths exist in `generate_grounded_course` output.
- [ ] Add failing regression test asserting every real-source sample has source graph status and artifact path.
- [ ] Update `GroundedCourseService` to build and persist source graph, anchors, concepts, and coverage artifacts.
- [ ] Update regression result types and summary checks.
- [ ] Re-run targeted tests.

Targeted tests:

```bash
npm run test:unit -- tools/agent-runtime/learner/grounded-course-service.test.ts
npm run test:regression
```

### Task 3: Course Planning V2 Contract

- [ ] Add failing planner tests for strategy recommendation, strategy reason, task labels, and acceptance expectations.
- [ ] Extend `planCourseUnits` with plan metadata and unit expectations.
- [ ] Re-run planner tests.

Targeted test:

```bash
npm run test:unit -- tools/agent-runtime/learner/course-unit-planner.test.ts
```

### Task 4: Authoring Context Course Plan Output

- [ ] Add failing authoring context test for `coursePlan.strategyReason` and `coursePlan.acceptanceExpectations`.
- [ ] Update `AuthoringContextService` to include the new planning contract.
- [ ] Re-run authoring context tests.

Targeted test:

```bash
npm run test:unit -- tools/agent-runtime/learner/authoring-context-service.test.ts
```

### Task 5: Docs And Skills Alignment

- [ ] Update `docs/runtime/artifact-contracts.md` with Source Graph V2 and Course Planning V2 artifacts.
- [ ] Update `docs/runtime/source-type-acceptance.md` with source graph acceptance.
- [ ] Update `skills/source-to-course/SKILL.md` and `skills/learning-agent-operator/SKILL.md` to route through the new contracts while keeping learner mode artifact-free.
- [ ] Run bundle and MCP contract checks.

Targeted checks:

```bash
npm run bundle:check
npm run codex:mcp:check
```

## Test Scheme

### Red-Green Tests

- Unit tests for source graph construction.
- Unit tests for grounded course source graph persistence.
- Unit tests for course planner metadata.
- Unit tests for authoring context output.
- Regression tests for book, paper, patent, and blog samples.

### Release Checks

Run after implementation:

```bash
npm run test:ci
npm run test:regression
npm run seed:check
npm run codex:mcp:check
npm run smoke:playwright
```

Run before public demo or final merge:

```bash
npm run release:check
```

## Milestone A Acceptance

- [ ] Source Graph V2 artifacts are written for grounded course generation.
- [ ] Real source regression reports source graph status for every public fixture.
- [ ] Course Planning V2 records strategy reason and acceptance expectations.
- [ ] Authoring context exposes course planning expectations to Codex.
- [ ] Learner-mode docs and skills do not ask users to approve internal artifacts.
- [ ] `npm run test:ci` passes.
- [ ] `npm run test:regression` passes.
- [ ] `npm run seed:check` passes.
