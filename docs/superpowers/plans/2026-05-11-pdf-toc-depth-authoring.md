# PDF TOC Depth Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make professor-style source-to-course runs sample long PDFs by real chapter/TOC structure and plan deeper chapter/core-pattern units instead of overfitting to introduction anchors.

**Architecture:** PDF normalization will emit chapter source nodes from detected chapter headings and TOC entries. Authoring context will pass chapter hints into balanced anchor sampling and course unit planning, so Codex sees per-chapter source anchors, chapter refs, and professor lecture blueprints.

**Tech Stack:** TypeScript, Vitest, local `learning_agent.prepare_learning_course` / `publish_learning_course`, PDF extraction via existing Python `pypdf` fallback path.

---

### Task 1: PDF Chapter Structure Extraction

**Files:**
- Modify: `tools/agent-runtime/source/source-normalizer.ts`
- Test: `tools/agent-runtime/source/source-normalizer.test.ts`

- [ ] Write a failing test that normalizing a readable PDF with `Chapter 1: Prompt Chaining` and `Chapter 2: Routing` emits `chapter` structure nodes.
- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/source/source-normalizer.test.ts
```

Expected: the new test fails because PDF sources currently emit page/paragraph nodes only.

- [ ] Implement chapter extraction by detecting first-page chapter headings and TOC chapter entries, creating heading anchors and chapter nodes with page-range anchor ids.
- [ ] Re-run the same test and verify it passes.

### Task 2: Balanced Chapter Sampling

**Files:**
- Modify: `tools/agent-runtime/learner/source-anchor-sampler.ts`
- Test: `tools/agent-runtime/learner/source-anchor-sampler.test.ts`

- [ ] Write a failing test where many high-scoring intro anchors compete with chapter groups; sampling must include representatives from multiple chapter groups.
- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/source-anchor-sampler.test.ts
```

Expected: the new test fails because sampling is currently global-score only.

- [ ] Add optional `chapterAnchorGroups` input and choose one representative per chapter before filling remaining slots by score.
- [ ] Re-run sampler tests and verify green.

### Task 3: Chapter-Aware Unit Planning

**Files:**
- Modify: `tools/agent-runtime/learner/course-unit-planner.ts`
- Test: `tools/agent-runtime/learner/course-unit-planner.test.ts`

- [ ] Write a failing test where `overview_plus_topic` book planning receives source chapter hints and produces focused units for chapter/core pattern titles with each unit using that chapter's source anchors.
- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/course-unit-planner.test.ts
```

Expected: the new test fails because planner ignores source chapter hints.

- [ ] Add `sourceChapters` to planner input and preserve per-chapter source anchors/node ids/chapter refs for focused units.
- [ ] Re-run planner tests and verify green.

### Task 4: Authoring Context Integration

**Files:**
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Test: `tools/agent-runtime/learner/authoring-context-service.test.ts`

- [ ] Write a failing test with a markdown book containing chapter headings. Context should expose `source.chapters`, sample anchors across chapters, and recommend units tied to chapter titles.
- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/authoring-context-service.test.ts
```

Expected: the new test fails because context does not expose or plan from source chapters.

- [ ] Extract chapter hints from normalized source nodes, pass them into the sampler and planner, and include them in the authoring context artifact.
- [ ] Re-run authoring context tests and verify green.

### Task 5: Real PDF Professor Seed Re-run

**Files:**
- Runtime artifacts only under ignored `runs/`

- [ ] Call `learning_agent.prepare_learning_course` for `Agentic_Design_Patterns.pdf` with `courseIntent=professor_lecture_deck`, `unitPages=10`, `strategy=overview_plus_topic`, and a larger `maxAnchors`.
- [ ] Verify the returned authoring context includes chapter/core pattern units such as Prompt Chaining, Routing, Reflection, Tool Use, or Planning rather than only intro topics.
- [ ] Publish a Codex-authored seed Web Deck and check `course-quality-report.json`.
- [ ] Verify preview in browser and ensure deck pages do not overflow at 1440x900.

### Task 6: Final Validation

**Files:**
- All modified tests and implementation files

- [ ] Run:

```bash
npm run test:unit -- tools/agent-runtime/source/source-normalizer.test.ts tools/agent-runtime/learner/source-anchor-sampler.test.ts tools/agent-runtime/learner/course-unit-planner.test.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/prepare-learning-course-service.test.ts tools/agent-runtime/quality/professor-lecture-rubric.test.ts
```

- [ ] Run a targeted `npm run typecheck` if signatures changed across modules.
- [ ] Clean non-ignored temporary artifacts and report run id, preview URL, quality status, and remaining gaps.
