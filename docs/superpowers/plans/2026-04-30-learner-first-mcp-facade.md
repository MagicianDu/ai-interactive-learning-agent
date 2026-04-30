# Learner-First MCP Façade 中文开发计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前偏 operator 的 MCP 服务改造成学习者可用的 Codex 入口：几轮自然语言澄清后，快速生成可打开的中文网页学习材料，默认不要求学习者审批内部 artifacts。

**Architecture:** 在现有 runtime/MCP 之上增加一层 learner-facing façade。默认工具只暴露学习需求确认、课程包发布、预览和反馈迭代；现有 `plan_run`、`read_artifact`、`approve_gate` 等工具保留为 advanced/operator API。默认路径由 Codex 负责理解资料和生成最终课程 bundle，MCP 负责保存项目、校验 lesson/course pack、写入前端 registry 可发现目录并返回预览信息；同时保留一个本地 deterministic quick preview 用于无模型 smoke。

**Tech Stack:** TypeScript, Node.js ESM, MCP JSON-RPC stdio, existing `tools/agent-runtime`, existing lesson/course schemas, Vitest, Vite React registry.

---

## 0. 产品判断和边界

### 当前问题

1. 当前 MCP 工具链暴露了太多内部 artifacts：`source-map`、`concept-map`、`curriculum-plan`、`lesson`、`critic-report`。这些对系统调试和专家审查有价值，但学习者没有能力判断它们是否正确。
2. 当前默认路径太长。学习者通过 Codex 使用产品时，合理体验应该是：

```text
说清楚学习目标
  -> Codex 问 1-3 个澄清问题
  -> 生成中文课程网页
  -> 用户看预览并反馈“太难 / 加例子 / 多代码 / 拆细”
  -> 快速迭代
```

3. 内部可审计流水线应该保留，但不应成为默认学习者体验。

### 新默认体验

```text
用户在 Codex 里说：我想学习某本书/论文/专利/博客/主题
  -> Codex 使用 learning_agent.create_learning_project 记录学习 brief
  -> 如果信息不够，MCP 返回面向用户的 clarificationQuestions
  -> Codex 根据资料和 brief 生成一个 course bundle
  -> Codex 调用 learning_agent.publish_learning_course
  -> MCP 校验、写入 src/lessons 与 src/course-packs
  -> MCP 返回 npm run dev 与预览信息
  -> 用户打开网页学习
```

### 非目标

- 不删除现有 advanced/operator 工具。
- 不让前端直接调用 MCP。
- 不在这一轮实现完整 SaaS 后端、账号、云端任务队列。
- 不假装 MCP 服务能直接调用当前 Codex 模型。Codex-authored 路径由 Codex 在会话中生成 bundle，再交给 MCP 保存和发布。

---

## 1. 文件结构

### 新增文件

- `docs/runtime/learner-first-mcp.md`
  - 面向用户和 Codex operator 的新默认 MCP 使用说明。
- `tools/agent-runtime/learner/learner-project-service.ts`
  - 负责创建 learner project brief，判断是否需要澄清问题，写入 `runs/<runId>/learner-project.json`。
- `tools/agent-runtime/learner/learner-project-service.test.ts`
  - 覆盖信息不足、信息充分、写入项目 brief 三类行为。
- `tools/agent-runtime/learner/learning-course-publisher.ts`
  - 接收 Codex 生成的 `lessons` 与 `coursePack`，复用 lesson 质量校验，写入 `src/lessons/<lessonId>/lesson.ts` 与 `src/course-packs/<coursePackId>/coursePack.ts`。
- `tools/agent-runtime/learner/learning-course-publisher.test.ts`
  - 覆盖成功发布、非中文/质量不足阻断、安全路径校验。
- `tools/agent-runtime/learner/learning-preview-service.ts`
  - 从已发布 course pack 生成用户可读预览信息。
- `tools/agent-runtime/learner/learning-preview-service.test.ts`
  - 覆盖返回 dev 命令、本地 URL、course pack/lesson 路径。
- `tools/agent-runtime/learner/quick-preview-service.ts`
  - 可选本地 quick preview：用现有 mock runtime 自动流转内部 gates，用于 smoke 和低保真快速样例。
- `tools/agent-runtime/learner/quick-preview-service.test.ts`
  - 覆盖不需要用户 approve gate 也能生成 promoted course pack。

### 修改文件

- `tools/agent-runtime/index.ts`
  - 导出 learner-facing services。
- `tools/mcp-server/tool-contracts.ts`
  - 新增 learner-facing tools，并把 advanced/operator 工具描述改清楚。
- `tools/mcp-server/runtime-tools.ts`
  - 接入 learner-facing services。
- `tools/mcp-server/json-rpc-server.test.ts`
  - 增加 learner-first MCP smoke。
- `scripts/beta-seed-check.ts`
  - 纳入 learner tests。
- `docs/runtime/codex-mcp-trial.md`
  - 改成学习者默认路径。
- `docs/runtime/mcp-client-setup.md`
  - 区分 learner tools 与 advanced tools。
- `README.md`
  - 更新 MCP 使用顺序。

---

## 2. 新 MCP 工具设计

### 2.1 默认学习者工具

#### `learning_agent.create_learning_project`

用途：从自然语言学习需求创建 learner brief。只问用户能回答的问题，不暴露内部 artifacts。

Input:

```ts
{
  request: string;
  runId?: string;
  sourcePath?: string;
  sourceKind?: "book" | "paper" | "patent" | "blog" | "documentation" | "notes" | "topic";
  audience?: string;
  unitPages?: number;
  strategy?: "overview_plus_topic" | "chapter_guided" | "topic_guided" | "hybrid";
}
```

Output when clarification is needed:

```ts
{
  status: "clarification_required";
  runId: string;
  clarificationQuestions: string[];
  brief: {
    topic?: string;
    sourcePath?: string;
    sourceKind?: string;
    audience?: string;
    unitPages?: number;
    strategy: string;
    language: "zh-CN";
  };
}
```

Output when ready:

```ts
{
  status: "project_ready";
  runId: string;
  brief: {
    topic: string;
    sourcePath?: string;
    sourceKind: string;
    audience: string;
    unitPages: number;
    strategy: string;
    language: "zh-CN";
  };
  next: {
    recommendedTool: "learning_agent.publish_learning_course";
    codexInstruction: string;
  };
}
```

#### `learning_agent.publish_learning_course`

用途：Codex 根据资料和 brief 直接生成最终 course bundle 后调用此工具发布网页材料。

Input:

```ts
{
  runId: string;
  coursePack: CoursePack;
  lessons: Lesson[];
  publishNotes?: string;
}
```

Output:

```ts
{
  status: "preview_ready";
  runId: string;
  coursePackId: string;
  coursePackPath: string;
  lessonPaths: string[];
  preview: {
    devCommand: "npm run dev";
    localUrl: "http://127.0.0.1:5173/";
    instructions: string[];
  };
  quality: {
    checkedLessons: number;
    blockingIssueCount: 0;
  };
}
```

If quality fails:

```ts
{
  status: "revision_required";
  runId: string;
  userMessage: string;
  issues: Array<{ lessonId: string; rule: string; message: string }>;
  next: {
    recommendedAction: "Codex should revise the course bundle and call publish_learning_course again.";
  };
}
```

#### `learning_agent.get_learning_preview`

用途：让 Codex 随时拿到用户可理解的预览信息，而不是 artifact 列表。

Input:

```ts
{
  runId: string;
}
```

Output:

```ts
{
  status: "preview_ready" | "not_published";
  runId: string;
  preview?: {
    devCommand: "npm run dev";
    localUrl: "http://127.0.0.1:5173/";
    coursePackId: string;
    courseTitle: string;
    lessonCount: number;
  };
}
```

#### `learning_agent.generate_quick_preview`

用途：本地 deterministic 快速样例，用于 smoke、演示和用户想先看粗略形态时。该工具内部自动流转和系统审批 gates，不让学习者审批 artifacts。

Input:

```ts
{
  runId: string;
  maxSteps?: number;
}
```

Output:

```ts
{
  status: "preview_ready" | "quality_blocked";
  runId: string;
  autoApprovedGates: string[];
  preview?: {
    devCommand: "npm run dev";
    localUrl: "http://127.0.0.1:5173/";
    coursePackId: string;
  };
}
```

### 2.2 Advanced/operator 工具保留

以下工具继续存在，但描述中必须明确标注 `Advanced/operator tool`：

```text
learning_agent.plan_run
learning_agent.init_from_plan
learning_agent.beta_status
learning_agent.run_until_gate
learning_agent.read_artifact
learning_agent.approve_gate
learning_agent.revise_gate
learning_agent.run_course
learning_agent.promote_units
```

Codex 默认不应该向学习者展示这些工具的内部产物，除非用户明确要求“专家审查模式 / 查看内部 artifacts / debug runtime”。

---

## 3. 开发任务

### Task 1: Learner Project Brief

**Files:**
- Create: `tools/agent-runtime/learner/learner-project-service.ts`
- Create: `tools/agent-runtime/learner/learner-project-service.test.ts`
- Modify: `tools/agent-runtime/index.ts`

- [ ] **Step 1: 写失败测试：信息不足时返回学习者问题**

Create `tools/agent-runtime/learner/learner-project-service.test.ts`:

```ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { LearnerProjectService } from "./learner-project-service";

describe("LearnerProjectService", () => {
  test("asks learner-facing clarification questions when request is underspecified", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({ request: "我想学习这本书" });

    expect(result.status).toBe("clarification_required");
    expect(result.clarificationQuestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("资料路径"),
        expect.stringContaining("面向谁")
      ])
    );
  });

  test("writes a ready learner brief for a complete request", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向有编程基础的学习者，每个单元 8 页，先总览再按核心 topic 拆课。",
      runId: "book-run"
    });

    expect(result).toMatchObject({
      status: "project_ready",
      runId: "book-run",
      brief: {
        sourcePath: "/tmp/book.pdf",
        audience: "有编程基础的学习者",
        unitPages: 8,
        strategy: "overview_plus_topic",
        language: "zh-CN"
      }
    });
    await expect(readFile(path.join(root, "runs", "book-run", "learner-project.json"), "utf8")).resolves.toContain(
      "有编程基础"
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test -- tools/agent-runtime/learner/learner-project-service.test.ts
```

Expected: FAIL because `learner-project-service.ts` does not exist.

- [ ] **Step 3: 实现 `LearnerProjectService`**

Create `tools/agent-runtime/learner/learner-project-service.ts` with:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type CreateProjectInput = {
  request: string;
  runId?: string;
  sourcePath?: string;
  sourceKind?: string;
  audience?: string;
  unitPages?: number;
  strategy?: string;
};

type LearnerBrief = {
  topic?: string;
  sourcePath?: string;
  sourceKind: string;
  audience?: string;
  unitPages: number;
  strategy: string;
  language: "zh-CN";
};

export class LearnerProjectService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async createProject(input: CreateProjectInput) {
    const runId = input.runId ?? slugFromText(input.request);
    const brief = buildBrief(input);
    const clarificationQuestions = buildClarificationQuestions(brief);

    await this.writeBrief(runId, brief, input.request);

    if (clarificationQuestions.length > 0) {
      return { status: "clarification_required" as const, runId, clarificationQuestions, brief };
    }

    return {
      status: "project_ready" as const,
      runId,
      brief,
      next: {
        recommendedTool: "learning_agent.publish_learning_course",
        codexInstruction:
          "请基于 learner brief 和用户资料生成 coursePack 与 lessons，然后调用 learning_agent.publish_learning_course。"
      }
    };
  }

  private async writeBrief(runId: string, brief: LearnerBrief, request: string): Promise<void> {
    const runPath = path.join(this.workspaceRoot, "runs", runId);
    await mkdir(runPath, { recursive: true });
    await writeFile(path.join(runPath, "learner-project.json"), JSON.stringify({ runId, request, brief }, null, 2), "utf8");
  }
}

function buildBrief(input: CreateProjectInput): LearnerBrief {
  const request = input.request;
  return {
    topic: inferTopic(request),
    sourcePath: input.sourcePath ?? inferPath(request),
    sourceKind: input.sourceKind ?? inferSourceKind(request),
    audience: input.audience ?? inferAudience(request),
    unitPages: input.unitPages ?? inferPages(request) ?? 8,
    strategy: input.strategy ?? "overview_plus_topic",
    language: "zh-CN"
  };
}

function buildClarificationQuestions(brief: LearnerBrief): string[] {
  const questions: string[] = [];
  if (!brief.sourcePath && !brief.topic) {
    questions.push("请提供资料路径、URL，或明确要学习的主题。");
  }
  if (!brief.audience) {
    questions.push("这套材料面向谁？例如：有编程基础但缺少系统心智模型的中文学习者。");
  }
  return questions;
}
```

Implementation must include helper functions `slugFromText`, `inferPath`, `inferSourceKind`, `inferAudience`, `inferPages`, and `inferTopic` in the same file. Keep them deterministic and small.

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
npm run test -- tools/agent-runtime/learner/learner-project-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: 导出服务并提交**

Modify `tools/agent-runtime/index.ts`:

```ts
export { LearnerProjectService } from "./learner/learner-project-service.js";
```

Commit:

```bash
git add tools/agent-runtime/learner tools/agent-runtime/index.ts
git commit -m "Add learner project brief service"
```

---

### Task 2: Direct Course Publisher

**Files:**
- Create: `tools/agent-runtime/learner/learning-course-publisher.ts`
- Create: `tools/agent-runtime/learner/learning-course-publisher.test.ts`
- Modify: `tools/agent-runtime/index.ts`

- [ ] **Step 1: 写失败测试：Codex 一次提交 course bundle 后写入前端 registry 可发现目录**

Create `tools/agent-runtime/learner/learning-course-publisher.test.ts`:

```ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { publishableLessonFixture } from "../quality/test-fixtures";
import { LearningCoursePublisher } from "./learning-course-publisher";

describe("LearningCoursePublisher", () => {
  test("publishes a Codex-authored course bundle into lessons and course-packs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const lesson = publishableLessonFixture({ id: "hash-table-overview", title: "哈希表：总览课", targetPageCount: 8 });
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "hash-course",
      lessons: [lesson],
      coursePack: {
        id: "hash-course",
        title: "哈希表：课程包",
        parentRunId: "hash-course",
        sourceKind: "topic",
        strategy: "overview_plus_topic",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "hash-table-overview",
            targetPageCount: 8,
            conceptIds: ["hash-table"]
          }
        ]
      }
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      coursePackId: "hash-course",
      quality: { checkedLessons: 1, blockingIssueCount: 0 }
    });
    await expect(readFile(path.join(root, "src", "lessons", "hash-table-overview", "lesson.ts"), "utf8")).resolves.toContain(
      "generatedLesson"
    );
    await expect(readFile(path.join(root, "src", "course-packs", "hash-course", "coursePack.ts"), "utf8")).resolves.toContain(
      "generatedCoursePack"
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test -- tools/agent-runtime/learner/learning-course-publisher.test.ts
```

Expected: FAIL because publisher does not exist.

- [ ] **Step 3: 实现 publisher**

Implementation requirements:

- Reuse existing quality validators:
  - `validateLessonQuality`
  - `validateChineseFirstLesson`
  - `validateSourceGrounding` when source context exists
- Reuse the module rendering conventions from `LessonPromotionService`:
  - Lesson module exports `generatedLesson`
  - Course pack module exports `generatedCoursePack`
- Enforce safe ids:
  - Lesson id: `/^[a-z][a-z0-9-]{0,63}$/`
  - Course pack id: same pattern
- Do not require `approve_gate`.
- On validation failure, return `revision_required` instead of throwing for ordinary content quality issues.
- Throw only for unsafe path attempts or malformed tool input.

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
npm run test -- tools/agent-runtime/learner/learning-course-publisher.test.ts
```

Expected: PASS.

- [ ] **Step 5: 导出服务并提交**

Modify `tools/agent-runtime/index.ts`:

```ts
export { LearningCoursePublisher } from "./learner/learning-course-publisher.js";
```

Commit:

```bash
git add tools/agent-runtime/learner tools/agent-runtime/index.ts
git commit -m "Add direct learner course publisher"
```

---

### Task 3: Learner-Facing MCP Tools

**Files:**
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `tools/mcp-server/json-rpc-server.test.ts`

- [ ] **Step 1: 写失败测试：tools/list 中 learner tools 排在 advanced tools 前面**

Append to `tools/mcp-server/json-rpc-server.test.ts`:

```ts
test("lists learner-facing tools before advanced operator tools", async () => {
  const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

  const response = await handleMcpRequest({ jsonrpc: "2.0", id: "tools", method: "tools/list" }, tools);
  const listedTools = (response as { result: { tools: Array<{ name: string; description: string }> } }).result.tools;

  expect(listedTools.slice(0, 4).map((tool) => tool.name)).toEqual([
    "learning_agent.create_learning_project",
    "learning_agent.publish_learning_course",
    "learning_agent.get_learning_preview",
    "learning_agent.generate_quick_preview"
  ]);
  expect(listedTools.find((tool) => tool.name === "learning_agent.approve_gate")?.description).toMatch(
    /Advanced\/operator tool/
  );
});
```

- [ ] **Step 2: 写失败测试：Codex-authored course bundle 可通过 MCP 发布**

Append to `tools/mcp-server/json-rpc-server.test.ts`:

```ts
test("publishes a learner-facing course through MCP without artifact approvals", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "learning-agent-learner-mcp-"));
  const tools = new LearningAgentRuntimeTools(root);
  const project = await callMcpTool(tools, "learning_agent.create_learning_project", {
    request: "请生成哈希表中文学习材料，面向有编程基础的学习者，每个单元 8 页。",
    runId: "learner-hash"
  });

  expect(project).toMatchObject({ status: "project_ready", runId: "learner-hash" });

  const lesson = publishableLessonFixture({ id: "learner-hash-overview", title: "哈希表：总览课", targetPageCount: 8 });
  const published = await callMcpTool(tools, "learning_agent.publish_learning_course", {
    runId: "learner-hash",
    lessons: [lesson],
    coursePack: {
      id: "learner-hash",
      title: "哈希表：课程包",
      parentRunId: "learner-hash",
      sourceKind: "topic",
      strategy: "overview_plus_topic",
      units: [
        {
          unitId: "unit-overview",
          title: "哈希表：总览课",
          kind: "overview",
          lessonId: "learner-hash-overview",
          targetPageCount: 8,
          conceptIds: ["hash-table"]
        }
      ]
    }
  });

  expect(published).toMatchObject({
    status: "preview_ready",
    preview: { devCommand: "npm run dev", localUrl: "http://127.0.0.1:5173/" }
  });
});
```

- [ ] **Step 3: 修改 tool contracts**

Add these names to `LearningAgentToolName`:

```ts
| "learning_agent.create_learning_project"
| "learning_agent.publish_learning_course"
| "learning_agent.get_learning_preview"
| "learning_agent.generate_quick_preview"
```

Insert their contracts at the beginning of `learningAgentToolContracts`.

Prefix existing advanced tool descriptions:

```ts
description: "Advanced/operator tool. ..."
```

- [ ] **Step 4: 修改 runtime-tools dispatcher**

In `LearningAgentRuntimeTools.callTool`, route new tools:

```ts
case "learning_agent.create_learning_project":
  return this.createLearningProject(input);
case "learning_agent.publish_learning_course":
  return this.publishLearningCourse(input);
case "learning_agent.get_learning_preview":
  return this.getLearningPreview(input);
case "learning_agent.generate_quick_preview":
  return this.generateQuickPreview(input);
```

Implement private methods by calling learner services.

- [ ] **Step 5: 运行 MCP 测试**

Run:

```bash
npm run test -- tools/mcp-server/json-rpc-server.test.ts
```

Expected: PASS.

- [ ] **Step 6: 提交**

```bash
git add tools/mcp-server tools/agent-runtime
git commit -m "Add learner-facing MCP tools"
```

---

### Task 4: Quick Preview Auto-Gated Path

**Files:**
- Create: `tools/agent-runtime/learner/quick-preview-service.ts`
- Create: `tools/agent-runtime/learner/quick-preview-service.test.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`

- [ ] **Step 1: 写失败测试：无需用户 approve artifacts 也能生成 preview**

Create `tools/agent-runtime/learner/quick-preview-service.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { LearnerProjectService } from "./learner-project-service";
import { QuickPreviewService } from "./quick-preview-service";

describe("QuickPreviewService", () => {
  test("auto-advances internal gates and returns preview without learner approval", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "quick-preview-"));
    const sourcePath = path.join(root, "notes.md");
    await writeFile(sourcePath, "# 哈希表\n哈希表通过 key 到 bucket 的映射减少搜索空间。", "utf8");
    await new LearnerProjectService(root).createProject({
      request: `请用 ${sourcePath} 生成中文学习材料，面向有编程基础的学习者，每个单元 8 页。`,
      runId: "quick-hash"
    });

    const result = await new QuickPreviewService(root).generate({ runId: "quick-hash", maxSteps: 80 });

    expect(result).toMatchObject({
      status: "preview_ready",
      runId: "quick-hash",
      preview: { devCommand: "npm run dev", localUrl: "http://127.0.0.1:5173/" }
    });
    expect(result.autoApprovedGates).toEqual(
      expect.arrayContaining(["source-map", "concept-map", "curriculum-plan", "learning-architecture", "lesson", "critic-report"])
    );
  });
});
```

- [ ] **Step 2: 实现自动 gate runner**

Implementation rules:

- Use existing `RunPlanService`, `RunStore`, `AgentWorkflow`, `ApprovalService`, `CoursePackService`.
- Convert learner brief into existing run config with adapter `mock`.
- Parent gates:
  - run until approval gate
  - inspect generated artifact
  - auto-approve only if minimum structural checks pass
- Child gates:
  - call `CoursePackService.orchestrateCourse`
  - auto-approve `learning-architecture` and `lesson` when structural checks pass
  - auto-approve `critic-report` only when critic status is `passed`
- If critic status is `revision_required`, return:

```ts
{
  status: "quality_blocked",
  runId,
  userMessage: "自动质量检查发现阻塞问题，需要重新生成或切换 Codex-authored 发布路径。",
  blockingIssues: [...]
}
```

- [ ] **Step 3: 接入 `learning_agent.generate_quick_preview`**

`runtime-tools.ts` should call:

```ts
return new QuickPreviewService(this.workspaceRoot).generate({
  runId: requiredString(options, "runId"),
  maxSteps: optionalNumber(options.maxSteps) ?? 80
});
```

- [ ] **Step 4: 运行测试**

Run:

```bash
npm run test -- tools/agent-runtime/learner/quick-preview-service.test.ts tools/mcp-server/json-rpc-server.test.ts
```

Expected: PASS.

- [ ] **Step 5: 提交**

```bash
git add tools/agent-runtime/learner tools/mcp-server
git commit -m "Add auto-gated quick preview flow"
```

---

### Task 5: Codex Trial Documentation Rewrite

**Files:**
- Modify: `docs/runtime/codex-mcp-trial.md`
- Modify: `docs/runtime/mcp-client-setup.md`
- Modify: `docs/runtime/seed-user-prompts.md`
- Modify: `README.md`

- [ ] **Step 1: 更新 Codex 默认试用 prompt**

`docs/runtime/codex-mcp-trial.md` must show this default user prompt:

```text
请使用 learningAgent MCP 服务帮我生成中文学习网页。
资料是：/absolute/path/to/source.pdf
我希望先有总览课，再按核心 topic 拆课。每个单元 8 页。
请先问我最多 3 个你必须知道的问题。明确后，不要让我审批 source-map、concept-map、curriculum-plan 这些内部 artifacts。
你可以直接生成 course bundle，然后调用 learning_agent.publish_learning_course 发布网页。
发布后告诉我运行 npm run dev，并说明我应该打开哪个页面查看。
```

- [ ] **Step 2: 明确 advanced 模式**

Add this rule to docs:

```text
只有当用户明确说“专家审查模式 / 查看内部 artifacts / 调试生成流程”时，Codex 才使用 plan_run、read_artifact、approve_gate、run_course 这些 advanced/operator tools。
```

- [ ] **Step 3: 更新 seed prompt pack**

Add a learner-first prompt for:

```text
Book -> learner-first publish
Paper -> learner-first publish
Patent -> learner-first publish
Quick local preview -> generate_quick_preview
Expert review mode -> advanced tools
```

- [ ] **Step 4: 文档检查**

Run:

```bash
rg "source-map|concept-map|approve_gate|Advanced/operator|publish_learning_course|generate_quick_preview" README.md docs/runtime
```

Expected:

- `publish_learning_course` appears in default Codex trial docs.
- `approve_gate` only appears in advanced/operator sections.

- [ ] **Step 5: 提交**

```bash
git add README.md docs/runtime
git commit -m "Document learner-first MCP trial flow"
```

---

### Task 6: Seed Readiness Gate

**Files:**
- Modify: `scripts/beta-seed-check.ts`
- Test commands only.

- [ ] **Step 1: 扩展 readiness tests**

Add these test paths to `scripts/beta-seed-check.ts`:

```ts
"tools/agent-runtime/learner/learner-project-service.test.ts",
"tools/agent-runtime/learner/learning-course-publisher.test.ts",
"tools/agent-runtime/learner/learning-preview-service.test.ts",
"tools/agent-runtime/learner/quick-preview-service.test.ts"
```

- [ ] **Step 2: 跑完整 seed check**

Run:

```bash
npm run seed:check
```

Expected:

- All product tests pass.
- All learner MCP façade tests pass.
- MCP tool list includes learner-facing tools.
- Typecheck and build pass.

- [ ] **Step 3: 跑 Codex MCP check**

Run:

```bash
npm run codex:mcp:check
```

Expected:

```text
[codex:mcp] learningAgent config is installed
[codex:mcp] MCP tool list includes learning_agent.plan_run and learning_agent.beta_status
```

After Task 3, update this check to also require:

```text
learning_agent.create_learning_project
learning_agent.publish_learning_course
```

- [ ] **Step 4: 提交**

```bash
git add scripts package.json
git commit -m "Add learner MCP readiness checks"
```

---

## 4. 验收标准

### 学习者体验验收

- 用户不需要审批 `source-map`、`concept-map`、`curriculum-plan`。
- Codex 默认最多问 3 个学习需求问题。
- 信息充分后，Codex 可以调用 `publish_learning_course` 一次发布网页材料。
- MCP 返回 `npm run dev` 和 `http://127.0.0.1:5173/`。
- 用户后续反馈用自然语言表达，例如“太难了”“加代码”“多举例”，不需要理解 artifacts。

### 技术验收

Run:

```bash
npm run seed:check
npm run codex:mcp:check
npm run lint
git diff --check
```

Expected: all pass.

### Codex 手工验收

重启 Codex 或开新会话后，输入：

```text
请使用 learningAgent MCP 服务帮我生成中文学习网页。主题是哈希表，面向有编程基础但缺少数据结构心智模型的中文学习者。每个单元 8 页。不要让我审批内部 artifacts，直接生成可打开的网页材料。
```

Expected Codex behavior:

1. 调用 `learning_agent.create_learning_project`。
2. 若信息足够，生成 `coursePack` 和 `lessons`。
3. 调用 `learning_agent.publish_learning_course`。
4. 告诉用户运行 `npm run dev` 并打开 `http://127.0.0.1:5173/`。
5. 不要求用户审批 `source-map`、`concept-map`、`curriculum-plan`。

---

## 5. 风险和取舍

### 风险 1: Codex-authored bundle 可能结构不合格

Mitigation:

- `publish_learning_course` 必须跑现有 lesson validators。
- 返回 `revision_required`，让 Codex 自己修 bundle 后重试。
- 不把 validation error 暴露成内部 artifact 审批，只用学习者能理解的文案总结。

### 风险 2: 快速生成质量低于专家流水线

Mitigation:

- 默认学习者路径优化速度和可见结果。
- Advanced/operator path 保留给教师、专家和内容生产者做深度审查。
- 质量不足时返回“需要修订”，不发布坏 lesson。

### 风险 3: MCP tools 太多导致 Codex 选错

Mitigation:

- `tools/list` 中 learner tools 排前面。
- Advanced tools description 统一以 `Advanced/operator tool` 开头。
- 文档明确默认只用 learner tools。

---

## 6. 自检

- Spec coverage: 本计划覆盖两个核心反馈：学习者不审批内部 artifacts、几轮沟通后快速看到网页。
- Placeholder scan: 本计划没有使用 TBD/TODO，也没有要求补未定义细节。
- Type consistency: 工具名在设计、任务和验收中保持一致：`create_learning_project`、`publish_learning_course`、`get_learning_preview`、`generate_quick_preview`。
