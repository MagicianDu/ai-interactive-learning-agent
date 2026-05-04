# Natural Language Quality Skills Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default learner experience run through natural language, Codex-authored course content, hardened Chinese learning-quality constraints, durable skills, and usable sidebar product pages.

**Architecture:** Keep MCP as the stable tool layer and Codex/Claude as the authoring layer. Strengthen the learner-facing project/context contracts, update skills/docs to make the new flow unambiguous, and make sidebar views render course-derived structure, grounding, assessment, teacher, playground, and tutor surfaces without exposing internal artifacts.

**Tech Stack:** TypeScript, Vitest, React, Vite, Tailwind CSS, local stdio MCP runtime.

---

### Task 1: Natural Language Default Flow

**Files:**
- Modify: `tools/agent-runtime/learner/learner-project-service.ts`
- Modify: `tools/agent-runtime/learner/learner-project-service.test.ts`
- Modify: `README.md`

- [x] Add tests proving `create_learning_project` recommends `learning_agent.get_authoring_context`, not deterministic generation or direct publishing.
- [x] Update the learner project result contract and guidance so Codex/Claude first gathers authoring context, then authors and publishes.
- [x] Update README default MCP tool list, prompt, and manual smoke path to `create_learning_project -> get_authoring_context -> publish_learning_course -> get_learning_preview`.

### Task 2: Content Quality Authoring Context

**Files:**
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`

- [x] Add tests for an explicit `qualityContract` covering Chinese-first content, page-level cognitive load, page type mix, feedback depth, source grounding, and allowed course strategies.
- [x] Add source-kind-specific authoring guidance for books, papers, patents, blogs, notes, and topic-only courses.
- [x] Include learner-facing clarification hints and publish requirements so clients can guide users through a few natural-language turns before publishing.

### Task 3: Skills Hardening

**Files:**
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `skills/learning-architecture/SKILL.md`
- Modify: `skills/visual-pedagogy/SKILL.md`
- Modify: `skills/interaction-design/SKILL.md`
- Modify: `skills/assessment-design/SKILL.md`
- Modify: `skills/lesson-critic/SKILL.md`
- Modify: `tools/mcp-server/skill-mcp-contract.test.ts`

- [x] Add a contract test that fails if core skills do not mention Chinese-first, Codex-authored publishing, no internal artifact approval for learners, and source-backed grounding.
- [x] Update skills so they form a stable authoring chain from source request to learning path, visual plan, interaction plan, assessment plan, critic review, and publish.
- [x] Keep `generate_grounded_course` documented only as a quick deterministic draft/smoke tool.

### Task 4: Sidebar Product Pages

**Files:**
- Modify: `src/product/CourseWorkspace.tsx`
- Modify: `src/product/CourseWorkspace.test.tsx`
- Modify: `src/renderers/LearningProductRenderer.tsx`
- Modify: `src/renderers/LearningProductRenderer.test.tsx`
- Modify: `src/renderers/AssessmentProductView.tsx`
- Modify: `src/renderers/TeacherProductView.tsx`
- Modify: `src/renderers/PlaygroundProductView.tsx`
- Modify: `src/renderers/TutorProductView.tsx`

- [x] Add tests proving sidebar view changes keep the deck fixed-height and show useful product content for structure, sources, assessment, teacher, playground, and tutor.
- [x] Add a compact workspace header/status strip for current unit, source kind, strategy, and learning progress without returning to developer panels.
- [x] Make sources view show current page anchors plus course-level grounding and affected units.
- [x] Make assessment, teacher, playground, and tutor views feel like actionable learning pages rather than placeholders.

### Task 5: Verification

**Files:**
- No code files.

- [x] Run focused learner/MCP tests.
- [x] Run focused frontend tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run codex:mcp:check`.
- [x] Run `npm run seed:check`.
- [x] Report remaining untracked generated trial artifacts separately from committed source changes.
