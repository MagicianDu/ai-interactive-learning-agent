# Codex Authored Course And Viewport Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Codex the default course author while MCP provides source context, validation, publishing, and a fixed-viewport learning shell.

**Architecture:** Add a new MCP authoring-context service that prepares source anchors, course constraints, and Codex instructions without writing lesson prose. Update skills/docs so the default high-quality path is Codex-authored `publish_learning_course`, while deterministic generation remains a draft path. Refactor the frontend into a sidebar-driven fixed viewport shell where the teaching page fills the browser and does not require vertical scroll.

**Tech Stack:** TypeScript, React, Vite, Tailwind CSS, Vitest, MCP JSON-RPC tool contracts.

---

## Task 1: Authoring Context Tool

**Files:**
- Create: `tools/agent-runtime/learner/authoring-context-service.ts`
- Create: `tools/agent-runtime/learner/authoring-context-service.test.ts`
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`
- Modify: `tools/mcp-server/json-rpc-server.test.ts`
- Modify: `scripts/install-codex-mcp.ts`
- Modify: `scripts/learning-agent-bundle.ts`

- [ ] Add `learning_agent.get_authoring_context` to the MCP contracts.
- [ ] Implement a service that reads `runs/<run-id>/learner-project.json`, normalizes source anchors, plans recommended units, and returns a Codex authoring instruction.
- [ ] Keep the output compact: source anchor samples, strategy, unit page count, selected chapters/topics, and publish requirements.
- [ ] Add tests for a source-backed project and a topic-only project.
- [ ] Ensure MCP list-tools and Codex MCP checks include the new tool.

## Task 2: Default Workflow Docs And Skills

**Files:**
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `docs/runtime/codex-bundle-authoring.md`
- Modify: `docs/runtime/codex-mcp-trial.md`
- Modify: `docs/runtime/mcp-client-setup.md`
- Modify: `docs/runtime/mcp-skills-bundle.md`
- Modify: `docs/runtime/seed-user-guide.md`
- Modify: `docs/runtime/seed-user-prompts.md`
- Modify: `docs/runtime/seed-user-quickstart.md`
- Modify: `docs/runtime/source-type-acceptance.md`
- Modify: `docs/product/current-product-state.md`
- Modify: `docs/product/future-development-plan.md`

- [ ] Replace the default high-quality path with `create_learning_project -> get_authoring_context -> publish_learning_course -> get_learning_preview`.
- [ ] Label `generate_grounded_course` as fast deterministic draft/smoke preview.
- [ ] Keep learner-facing operation high-level and avoid internal artifact approval.
- [ ] Update skill contract tests so skills mention the new default tool.

## Task 3: Sidebar Learning Shell

**Files:**
- Create: `src/product/LearningSidebar.tsx`
- Modify: `src/product/CourseWorkspace.tsx`
- Modify: `src/product/CourseWorkspace.test.tsx`

- [ ] Introduce a persistent sidebar with project, unit, mode, source, and utility sections.
- [ ] Move course structure and project library into sidebar-controlled panels.
- [ ] Make the main area `h-screen min-h-0 overflow-hidden`.
- [ ] Keep route updates for course/unit/page navigation.
- [ ] Add tests that the app opens into learning mode and exposes sidebar functions.

## Task 4: Fixed Viewport Deck

**Files:**
- Modify: `src/components/deck/DeckShell.tsx`
- Modify: `src/components/deck/DeckPage.tsx`
- Modify: `src/components/deck/DeckPage.test.tsx`
- Modify: `src/renderers/WebDeckRenderer.tsx`
- Modify: `src/renderers/WebDeckRenderer.test.tsx`
- Modify: `src/styles/index.css`

- [ ] Remove duplicated sticky deck header from the main teaching page.
- [ ] Constrain deck page height to the available viewport.
- [ ] Move page source anchors out of the main page body.
- [ ] Use compact typography and grid rows so the page fits without body vertical scroll.
- [ ] Add a DOM-level viewport test for `document.body.scrollHeight <= window.innerHeight`.

## Task 5: Verification

**Commands:**

```bash
npm run test -- tools/agent-runtime/learner/authoring-context-service.test.ts tools/mcp-server/runtime-tools.test.ts tools/mcp-server/json-rpc-server.test.ts src/product/CourseWorkspace.test.tsx src/components/deck/DeckPage.test.tsx src/renderers/WebDeckRenderer.test.tsx
npm run typecheck
npm run lint
npm run codex:mcp:check
npm run seed:check
```

- [ ] Run focused tests after each implementation slice.
- [ ] Run full gates before committing.
- [ ] Do not stage generated real-source smoke preview folders unless explicitly requested.

