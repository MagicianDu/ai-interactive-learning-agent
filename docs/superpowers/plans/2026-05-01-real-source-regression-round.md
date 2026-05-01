# Real Source Regression Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repeatable four-source regression suite for book, paper, patent, and blog learner projects so seed-user trials are not one-off manual notes.

**Architecture:** Add a small learner-facing regression module that defines stable sample sources, validates project brief creation, and records non-network acceptance checks. Keep private/local source-derived content out of git; real source URLs and local paths are metadata only.

**Tech Stack:** TypeScript, Vitest, existing `LearnerProjectService`, existing MCP readiness gates.

---

### Task 1: Regression Sample Registry

**Files:**
- Create: `tools/agent-runtime/learner/real-source-regression.ts`
- Create: `tools/agent-runtime/learner/real-source-regression.test.ts`

- [x] **Step 1: Write failing tests**
  - Test that the registry contains `book`, `paper`, `patent`, and `blog`.
  - Test that each sample has source kind, source path/URL, strategy, unit page count, and acceptance notes.

- [x] **Step 2: Run test to verify it fails**
  - Command: `npm run test -- tools/agent-runtime/learner/real-source-regression.test.ts`
  - Expected before implementation: missing module failure.

- [x] **Step 3: Implement registry and project trial runner**
  - Export `realSourceRegressionSamples`.
  - Export `runRealSourceRegressionSuite(workspaceRoot)` that creates learner projects in an isolated workspace and returns compact results.

- [x] **Step 4: Run test to verify it passes**
  - Command: `npm run test -- tools/agent-runtime/learner/real-source-regression.test.ts`

### Task 2: CLI Check And Docs

**Files:**
- Create: `tools/agent-runtime/learner/real-source-regression-cli.ts`
- Modify: `package.json`
- Modify: `docs/runtime/real-source-trials.md`
- Modify: `docs/runtime/source-type-acceptance.md`

- [x] **Step 1: Add CLI script**
  - Script runs the regression suite and prints a JSON report.
  - Default check verifies learner project readiness and local source availability without committing generated content.

- [x] **Step 2: Add package script**
  - Add `source:regression`.

- [x] **Step 3: Document selected patent/blog sources**
  - Patent: Google Patents `WO2025085566A1`.
  - Blog: Microsoft Tech Community Agentic RAG article.

- [x] **Step 4: Verify**
  - Command: `npm run source:regression`

### Task 3: Readiness Gate

**Files:**
- Modify: `scripts/beta-seed-check.ts`

- [x] **Step 1: Add the deterministic regression test to seed readiness**
  - Include `tools/agent-runtime/learner/real-source-regression.test.ts`.

- [x] **Step 2: Run final checks**
  - `npm run lint`
  - `npm run seed:check`
  - `npm run codex:mcp:check`
