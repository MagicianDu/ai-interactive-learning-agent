# Product Beta Acceptance Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一次性完成真实内容试跑、bundle 生成约束、来源锚点展示、反馈迭代、多资料验收样例和种子用户试用包，让项目从 MCP beta 进入可控试用形态。

**Architecture:** 保持 learner-first MCP 作为默认入口，由 Codex/Claude 生成 course bundle，MCP 做持久化、校验、发布和反馈记录。新增内容以小型服务、前端展示组件和验收文档为主，真实资料派生内容只写入临时目录或 ignored `runs/`，不提交私有资料生成结果。

**Tech Stack:** TypeScript, Node.js ESM, MCP JSON-RPC stdio, React/Vite, Vitest, Testing Library, existing `tools/agent-runtime`.

---

### Task 1: Real Codex-Authored Trial Harness

**Files:**
- Create: `tools/agent-runtime/learner/codex-authored-trial.ts`
- Create: `tools/agent-runtime/learner/codex-authored-trial.test.ts`
- Modify: `tools/agent-runtime/index.ts`
- Modify: `docs/runtime/real-source-trials.md`

- [x] Build a temporary-workspace trial helper that creates a learner project for a real source path, publishes a small source-grounded Codex-authored bundle, returns `preview_ready`, and records no generated private content in the repo.
- [x] Verify with `npm run test -- tools/agent-runtime/learner/codex-authored-trial.test.ts`.

### Task 2: Bundle Authoring Spec

**Files:**
- Create: `docs/runtime/codex-bundle-authoring.md`
- Create: `tools/agent-runtime/learner/bundle-authoring-guidance.ts`
- Create: `tools/agent-runtime/learner/bundle-authoring-guidance.test.ts`
- Modify: `tools/agent-runtime/learner/learner-project-service.ts`

- [x] Define the required Codex output contract for `coursePack` and `lessons`.
- [x] Include Chinese-first, source grounding, interaction, feedback, misconception and transfer requirements in the `create_learning_project` next instruction.
- [x] Verify with `npm run test -- tools/agent-runtime/learner/bundle-authoring-guidance.test.ts tools/agent-runtime/learner/learner-project-service.test.ts`.

### Task 3: Source Anchors In Web Deck

**Files:**
- Modify: `src/schemas/lesson.schema.ts`
- Modify: `src/components/deck/DeckPage.tsx`
- Create: `src/components/deck/DeckPage.test.tsx`

- [x] Add optional lesson/page source grounding types.
- [x] Render learner-readable source anchors on deck pages.
- [x] Verify with `npm run test -- src/components/deck/DeckPage.test.tsx`.

### Task 4: Feedback Iteration Closure

**Files:**
- Modify: `tools/agent-runtime/learner/learning-revision-service.ts`
- Modify: `tools/agent-runtime/learner/learning-revision-service.test.ts`
- Modify: `tools/mcp-server/json-rpc-server.test.ts`

- [x] Revision brief should include current lesson paths, course pack path when available, previous feedback count, and a stronger republish instruction.
- [x] Verify with `npm run test -- tools/agent-runtime/learner/learning-revision-service.test.ts tools/mcp-server/json-rpc-server.test.ts`.

### Task 5: Multi-Source Acceptance Examples

**Files:**
- Create: `docs/runtime/source-type-acceptance.md`
- Modify: `docs/runtime/seed-user-prompts.md`

- [x] Document book, paper, patent and blog learner-first prompts, expected unit structure, source grounding rules and acceptance checks.

### Task 6: Seed User Trial Pack And Readiness

**Files:**
- Create: `docs/runtime/seed-user-quickstart.md`
- Modify: `README.md`
- Modify: `scripts/beta-seed-check.ts`

- [x] Add a short user-facing trial guide and failure handling path.
- [x] Add new tests to seed readiness.
- [x] Final verification: `npm run lint`, `npm run seed:check`, `npm run codex:mcp:check`.
