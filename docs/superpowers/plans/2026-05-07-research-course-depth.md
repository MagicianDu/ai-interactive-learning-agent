# Research Course Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make paper/book source courses feel closer to university or graduate seminar learning material, especially for research papers.

**Architecture:** Keep Codex as the authoring brain and MCP as the packaging/quality runtime. Strengthen the runtime contracts so Codex receives paper-specific authoring expectations, quality reports can reject shallow paper lessons, and deterministic trial paths demonstrate the expected shape without becoming the final author.

**Tech Stack:** TypeScript, Vitest, Vite, local MCP runtime, JSON lesson/course artifacts.

---

### Task 1: Paper Research Contract In Authoring Context

**Files:**
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.ts`
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.test.ts`

- [x] **Step 1: Write failing tests**

Add a test that creates a `paper` learner project with `difficultyLevel: "research"` and expects:
- `qualityContract.researchReadingContract.requiredMoves` to contain paper-specific moves: 研究问题, 论文贡献, 方法机制, 实验/证据, 局限/威胁, 迁移判断.
- `codexInstruction` to explicitly tell Codex to write a paper-reading seminar lesson, not a generic summary.
- `contentBlueprint.globalRules` and page `mustInclude` to contain paper-specific research moves.

Run:

```bash
npx vitest run tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/content-quality-blueprint.test.ts --pool threads
```

Expected: FAIL because the contract does not yet expose a typed paper research-reading section.

- [x] **Step 2: Implement the contract**

Add optional `researchReadingContract` to `AuthoringContextResult["qualityContract"]`, populated when `brief.sourceKind === "paper"` or `brief.difficultyLevel === "research"`.

For `content-quality-blueprint.ts`, append paper/research rules and per-page requirements:
- problem page: 研究问题 and 论文贡献 claim
- structure page: 方法机制 and assumptions
- quiz page: 实验/证据 path
- misconception page: 局限/威胁 and overclaim risk
- transfer page: migration boundary

- [x] **Step 3: Verify tests**

Run the same Vitest command and require PASS.

### Task 2: Paper Depth Quality Gate

**Files:**
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`
- Modify: `tools/agent-runtime/learner/learning-course-publisher.ts`

- [x] **Step 1: Write failing tests**

Add a quality report test where `authoringContext` includes:

```ts
{
  difficultyLevel: "research",
  sourceKind: "paper"
}
```

Use a publishable lesson that is structurally valid but lacks paper markers. Expect warning issue:

```text
quality.lesson.paper-research-depth-shallow
```

Also verify `LearningCoursePublisher.resolveQualityAuthoringContext` threads `sourceKind` from authoring-context / learner-project into `buildCourseQualityReport`.

- [x] **Step 2: Implement the gate**

Add `sourceKind?: string` to `CourseQualityAuthoringContext`. Add a paper research-depth heuristic requiring enough markers from:

```text
研究问题, 论文贡献, 方法机制, 方法假设, 实验, 评估, 证据链, 局限, 威胁, 反例, 迁移边界
```

Emit `quality.lesson.paper-research-depth-shallow` as a warning when a paper/research lesson lacks these.

- [x] **Step 3: Verify tests**

Run:

```bash
npx vitest run tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts --pool threads
```

Expected: PASS.

### Task 3: Codex-Authored Trial Uses Paper Seminar Language

**Files:**
- Modify: `tools/agent-runtime/learner/codex-authored-trial.ts`
- Modify: `tools/agent-runtime/learner/codex-authored-trial.test.ts`

- [x] **Step 1: Write failing tests**

Add a paper trial fixture and assert generated lesson text contains:

```text
研究问题, 论文贡献, 方法机制, 实验/证据, 局限边界, 迁移边界
```

Assert it does not contain authoring scaffolding phrases such as:

```text
本页围绕, 课堂 slide, 课堂材料需覆盖
```

- [x] **Step 2: Implement source-kind-aware page copy**

Pass `sourceKind` into `buildPage`. For `sourceKind === "paper"`, use paper seminar templates:
- problem_scene: research question and contribution claim
- structure_diagram: method mechanism and assumptions
- interactive_model: choose evidence-first vs definition-first interpretation
- quiz: identify evidence path
- misconception_check: distinguish contribution from proven reliability
- transfer_challenge: transfer only under compatible assumptions
- summary_card: research question / contribution / mechanism / evidence / limitation / transfer boundary

- [x] **Step 3: Verify tests**

Run:

```bash
npx vitest run tools/agent-runtime/learner/codex-authored-trial.test.ts --pool threads
```

Expected: PASS.

### Task 4: Real Paper Regression And Release Gate

**Files:**
- No source files expected unless tests reveal a concrete gap.
- Generated `runs/` artifacts remain ignored and must not be committed.

- [x] **Step 1: Run targeted test suite**

```bash
npx vitest run tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/codex-authored-trial.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts --pool threads
```

- [x] **Step 2: Run Talker-Reasoner paper trial**

Use source:

```text
/Users/dm/Documents/1.书籍资料/1.基础模型训练/推理/Agents Thinking Fast and Slow- A Talker-Reasoner Architecture.pdf
```

Expected:
- authored run status `preview_ready`
- quality report `passed`
- comparison `remainingGaps=[]`
- generated narratives contain research-seminar markers and no authoring scaffolding.

- [x] **Step 3: Run release check**

```bash
npm run release:check
git diff --check
```

Expected: both pass.

- [x] **Step 4: Commit**

```bash
git add tools/agent-runtime/learner/authoring-context-service.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/content-quality-blueprint.ts tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/quality/course-quality-report.ts tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/learning-course-publisher.ts tools/agent-runtime/learner/learning-course-publisher.test.ts tools/agent-runtime/learner/codex-authored-trial.ts tools/agent-runtime/learner/codex-authored-trial.test.ts docs/superpowers/plans/2026-05-07-research-course-depth.md
git commit -m "Deepen research paper course authoring"
```
