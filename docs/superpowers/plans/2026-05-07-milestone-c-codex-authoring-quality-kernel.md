# Milestone C Codex Authoring Quality Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first critical quality kernel for Codex-authored Chinese source-backed courses.

**Architecture:** Keep Codex/Claude as the primary author. Add protocol docs and machine-checkable quality heuristics around the existing MCP publish/compare pipeline, rather than replacing authoring with deterministic generation. Reuse `CourseQualityReport`, `AuthoringQualityComparisonService`, and real-source regression structures.

**Tech Stack:** TypeScript, Vitest, existing MCP/runtime services, Markdown docs, local JSON preview artifacts.

---

## Files

- Create: `docs/runtime/codex-authoring-protocol-v2.md`
- Create: `docs/runtime/real-source-quality-benchmark.md`
- Modify: `scripts/learning-agent-bundle.ts`
- Modify: `scripts/learning-agent-bundle.test.ts`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`
- Modify: `tools/agent-runtime/learner/authoring-quality-comparison.ts`
- Modify: `tools/agent-runtime/learner/authoring-quality-comparison.test.ts`
- Modify: `tools/agent-runtime/learner/real-source-regression.ts`
- Modify: `tools/agent-runtime/learner/real-source-regression.test.ts`

## Tasks

### Task 1: Codex Authoring Protocol V2

- [ ] Add `docs/runtime/codex-authoring-protocol-v2.md` with the authoring sequence, page contract, difficulty contract, source synthesis rules, visual/interaction rules, and revision rules.
- [ ] Add `docs/runtime/real-source-quality-benchmark.md` with source-kind expectations for book, paper, patent, blog, documentation, notes, and topic-only.
- [ ] Update `scripts/learning-agent-bundle.ts` so both docs are required in bundle checks.
- [ ] Update `scripts/learning-agent-bundle.test.ts` so the bundle must reference `learning_agent.prepare_learning_course`, `Codex Authoring Protocol V2`, and all benchmark source kinds.
- [ ] Update `skills/learning-agent-operator/SKILL.md` and `skills/source-to-course/SKILL.md` to require the protocol before Codex authors a course.
- [ ] Run `npx vitest run scripts/learning-agent-bundle.test.ts tools/mcp-server/skill-mcp-contract.test.ts --pool threads`.

### Task 2: Critical Course Quality Heuristics

- [ ] Add failing tests in `tools/agent-runtime/quality/course-quality-report.test.ts` for:
  - generic page with no source-specific mechanism
  - page with source anchors but no source-specific synthesis
  - graduate/research course with shallow academic depth
  - interaction with vague/decorative cognitive purpose
- [ ] Implement minimal heuristic checks in `tools/agent-runtime/quality/course-quality-report.ts`.
- [ ] Ensure issue categories map to `generic_page`, `source_evidence`, `learner_level_mismatch`, and `decorative_interaction`.
- [ ] Run `npx vitest run tools/agent-runtime/quality/course-quality-report.test.ts --pool threads`.

### Task 3: Authored-vs-Draft Quality Metrics

- [ ] Add failing tests in `tools/agent-runtime/learner/authoring-quality-comparison.test.ts` for:
  - generic authored content should create a `generic-content` remaining gap
  - weak source synthesis should create a `source-synthesis` remaining gap
  - strong authored content should report improvements in source synthesis and learner action
- [ ] Extend comparison metrics with generic page count, weak synthesis count, and cognitive interaction count.
- [ ] Update remaining gap and improvement builders.
- [ ] Run `npx vitest run tools/agent-runtime/learner/authoring-quality-comparison.test.ts --pool threads`.

### Task 4: Real Source Benchmark Expectations

- [ ] Extend `RealSourceRegressionSample` with `qualityFocus`.
- [ ] Populate quality focus expectations for book, paper, patent, and blog samples.
- [ ] Add benchmark-only expectations for documentation, notes, and topic-only in `docs/runtime/real-source-quality-benchmark.md`.
- [ ] Add tests in `tools/agent-runtime/learner/real-source-regression.test.ts` verifying each sample has quality dimensions and the benchmark docs mention all seven source/input kinds.
- [ ] Run `npx vitest run tools/agent-runtime/learner/real-source-regression.test.ts --pool threads`.

### Task 5: Final Verification

- [ ] Run targeted tests:
  - `npx vitest run scripts/learning-agent-bundle.test.ts tools/mcp-server/skill-mcp-contract.test.ts tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/authoring-quality-comparison.test.ts tools/agent-runtime/learner/real-source-regression.test.ts --pool threads`
- [ ] Run `npm run release:check`.
- [ ] Run `git diff --check`.
- [ ] Commit the milestone with message `Add Codex authoring quality kernel`.

## Acceptance Metrics

- Protocol and benchmark docs are bundled.
- Course quality checks detect generic content, weak source synthesis, shallow academic depth, and decorative interaction.
- Authored-vs-draft comparison can report the same risks.
- Real-source regression samples carry quality focus expectations.
- Full release gate passes.
