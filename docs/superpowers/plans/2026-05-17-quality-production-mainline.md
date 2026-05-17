# Quality Production Mainline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 把真实资料到高质量 Web Deck 的主干生产能力做成可回归、可门禁、可由 Codex 顺滑执行的流程。

**Architecture:** 不扩展前端学习功能，也不强化来源 grounding 展示。新增一个生产质量 benchmark 服务聚合真实 run 的内容审核、imagegen、layout 和质量分；强化 content-review brief 的内容品味指标；让 imagegen batch 输出 Codex 可直接执行的 manifest 摘要；把 Codex 入口协议写进 skills/docs。

**Tech Stack:** TypeScript, Vitest, Node fs/promises, existing MCP runtime services.

---

## Scope

本轮只解决三类问题：

- 内容质量稳定性：同一类真实资料课程必须能被 benchmark 判定为 90+、3 轮 review、图片和 layout 全通过。
- imagegen 生产链路稳定性：每页图片任务要有 Codex 可执行说明、重试原因和最终校验路径。
- Codex 入口操作体验：用户自然语言给资料后，Codex 只问必要澄清，然后跑到 preview，不展示中间 artifacts。

明确不做：

- 来源 grounding 展示增强。
- 前端学习体验扩展，如笔记、收藏、知识地图、学习路径导航。

## File Map

- Create `tools/agent-runtime/learner/course-production-benchmark-service.ts`: 聚合多个真实 run 的生产质量状态。
- Create `tools/agent-runtime/learner/course-production-benchmark-service.test.ts`: TDD 覆盖 benchmark pass/fail/warning。
- Modify `tools/agent-runtime/index.ts`: 导出 benchmark 服务类型。
- Modify `tools/agent-runtime/learner/content-review-service.ts`: 增加内容品味指标和 automatic findings。
- Modify `tools/agent-runtime/learner/content-review-service.test.ts`: 先写失败测试，再实现指标。
- Modify `tools/agent-runtime/learner/imagegen-batch-state-service.ts`: 返回 Codex 可执行的 next item、retry summary 和 completion evidence。
- Modify `tools/agent-runtime/learner/imagegen-batch-state-service.test.ts`: 覆盖 manifest 摘要和失败重试摘要。
- Modify `tools/agent-runtime/learner/course-production-pipeline-service.ts`: 在 imagegen action 中使用 batch 的可执行摘要。
- Modify `skills/source-to-course/SKILL.md` and `skills/learning-agent-operator/SKILL.md`: 固化 Codex 入口协议。
- Modify `docs/runtime/one-shot-course-production.md`: 补充生产 benchmark、reviewer、imagegen batch 的验收说明。
- Modify `package.json`: 新增 `quality:production` 脚本，运行 benchmark service 的 fixture test 或 CLI。

## Task 1: Course Production Benchmark Service

**Files:**
- Create: `tools/agent-runtime/learner/course-production-benchmark-service.ts`
- Create: `tools/agent-runtime/learner/course-production-benchmark-service.test.ts`
- Modify: `tools/agent-runtime/index.ts`

- [x] **Step 1: Write failing tests**

Create tests that build temp `runs/<runId>` folders with:

- `quality/course-quality-report.json` containing score/status.
- `quality/content-review/content-review-state.json` containing completed rounds, latest verdict, latest score, concrete reports.
- `quality/imagegen/imagegen-batch-state.json` containing completed image items.
- `quality/layout-smoke/layout-smoke-report.json` containing passed/failed status.

Expected behavior:

- Two passed runs with score >= 90, review rounds >= 3, imagegen complete, layout passed return `status: "passed"`.
- Any run with score < 90 returns `status: "failed"` and a `blockingReasons` item.
- Missing second repeat for the same `sourceId` returns `status: "warning"` with `repeatCount` evidence.

Run:

```bash
npm test -- --run tools/agent-runtime/learner/course-production-benchmark-service.test.ts
```

Expected: FAIL because the service does not exist.

- [x] **Step 2: Implement service**

Service API:

```ts
export type CourseProductionBenchmarkTarget = {
  sourceId: string;
  runIds: string[];
  minScore?: number;
  minReviewRounds?: number;
};

export class CourseProductionBenchmarkService {
  constructor(private readonly workspaceRoot = process.cwd()) {}
  async evaluate(input: { targets: CourseProductionBenchmarkTarget[] }): Promise<CourseProductionBenchmarkReport>;
}
```

The service reads existing run artifacts only. It does not generate content.

- [x] **Step 3: Verify and commit**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/course-production-benchmark-service.test.ts
npm run typecheck
```

Commit:

```bash
git add tools/agent-runtime/learner/course-production-benchmark-service.ts tools/agent-runtime/learner/course-production-benchmark-service.test.ts tools/agent-runtime/index.ts
git commit -m "feat: add course production benchmark gate"
```

## Task 2: Content Taste Reviewer Metrics

**Files:**
- Modify: `tools/agent-runtime/learner/content-review-service.ts`
- Modify: `tools/agent-runtime/learner/content-review-service.test.ts`
- Modify: `tools/mcp-server/tool-contracts.ts`

- [x] **Step 1: Write failing test**

Add a content-review fixture with pages that look structurally valid but low taste:

- page title repeats `knowledgeBoard.coreProposition`.
- `knowledgeBoard.bottomLine` repeats the title.
- explanation text contains only generic study phrases.
- image alt/prompt says only “解释本页关键知识关系”.

Expected metrics:

- `titleCorePropositionOverlapCount`
- `bottomLineRepeatsTitleCount`
- `genericImageIntentCount`
- `weakKnowledgeClaimCount`

Expected automatic findings include `content_taste` or `knowledge_density` category.

Run:

```bash
npm test -- --run tools/agent-runtime/learner/content-review-service.test.ts
```

Expected: FAIL because metrics do not exist.

- [x] **Step 2: Implement metrics and issue categories**

Add categories:

- `content_taste`
- `knowledge_density`

Keep existing categories compatible. Metrics should be deterministic and based on preview JSON only.

- [x] **Step 3: Verify and commit**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/content-review-service.test.ts tools/mcp-server/skill-mcp-contract.test.ts
npm run typecheck
```

Commit:

```bash
git add tools/agent-runtime/learner/content-review-service.ts tools/agent-runtime/learner/content-review-service.test.ts tools/mcp-server/tool-contracts.ts
git commit -m "feat: strengthen content taste review metrics"
```

## Task 3: Imagegen Batch Execution Summary

**Files:**
- Modify: `tools/agent-runtime/learner/imagegen-batch-state-service.ts`
- Modify: `tools/agent-runtime/learner/imagegen-batch-state-service.test.ts`
- Modify: `tools/agent-runtime/learner/course-production-pipeline-service.ts`

- [x] **Step 1: Write failing test**

Expected batch result includes:

- `nextItem`: first pending or failed item.
- `executionChecklist`: short strings Codex can follow before calling imagegen.
- `retrySummary`: failed count and reasons.
- `evidencePaths`: manifest and state paths.

Run:

```bash
npm test -- --run tools/agent-runtime/learner/imagegen-batch-state-service.test.ts tools/agent-runtime/learner/course-production-pipeline-service.test.ts
```

Expected: FAIL because fields are missing.

- [x] **Step 2: Implement summary fields**

Add fields without changing existing status names. Pipeline action should include checklist text in `codexInstruction`.

- [x] **Step 3: Verify and commit**

Run:

```bash
npm test -- --run tools/agent-runtime/learner/imagegen-batch-state-service.test.ts tools/agent-runtime/learner/course-production-pipeline-service.test.ts
npm run typecheck
```

Commit:

```bash
git add tools/agent-runtime/learner/imagegen-batch-state-service.ts tools/agent-runtime/learner/imagegen-batch-state-service.test.ts tools/agent-runtime/learner/course-production-pipeline-service.ts
git commit -m "feat: add imagegen batch execution summary"
```

## Task 4: Codex Entry Protocol and Documentation

**Files:**
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `docs/runtime/one-shot-course-production.md`
- Modify: `package.json`

- [x] **Step 1: Write failing contract/docs test if needed**

Run current contract test first:

```bash
npm test -- --run tools/mcp-server/skill-mcp-contract.test.ts
```

If the current assertions do not cover the new protocol, update the test to require:

- one-shot pipeline is default for source-backed self-study.
- no intermediate artifact approval.
- final handoff calls `learning_agent.get_learning_preview`.
- imagegen batch execution summary is mentioned.

- [x] **Step 2: Update docs and scripts**

Add `quality:production` script:

```json
"quality:production": "vitest run --passWithNoTests --pool threads tools/agent-runtime/learner/course-production-benchmark-service.test.ts"
```

Docs should describe the benchmark evidence and Codex user flow in Chinese.

- [x] **Step 3: Verify and commit**

Run:

```bash
npm run quality:production
npm test -- --run tools/mcp-server/skill-mcp-contract.test.ts
npm run bundle:check
npm run typecheck
```

Commit:

```bash
git add package.json skills/source-to-course/SKILL.md skills/learning-agent-operator/SKILL.md docs/runtime/one-shot-course-production.md tools/mcp-server/skill-mcp-contract.test.ts
git commit -m "docs: script codex production workflow"
```

## Task 5: Full Verification

**Files:**
- Modify: this plan file, mark completed items.

- [x] **Step 1: Run full checks**

```bash
npm run test:ci
npm run test:regression
npm run codex:mcp:check
npm run pipeline:fixture
npm run quality:production
git diff --check
```

Expected: all pass.

- [x] **Step 2: Update verification record and commit**

Record the verification in `docs/runtime/one-shot-course-production.md` and this plan.

```bash
git add docs/runtime/one-shot-course-production.md docs/superpowers/plans/2026-05-17-quality-production-mainline.md
git commit -m "docs: record quality production verification"
```

## Acceptance

- Benchmark can prove a source has at least two production runs meeting 90+ / 3 review rounds / imagegen complete / layout passed.
- Content review brief catches low-taste pages even when schema and layout are valid.
- Imagegen action gives Codex a concrete next item and checklist, not just a raw manifest path.
- Skills tell Codex to run the one-shot pipeline to preview without exposing intermediate artifacts.
- Full verification passes.
