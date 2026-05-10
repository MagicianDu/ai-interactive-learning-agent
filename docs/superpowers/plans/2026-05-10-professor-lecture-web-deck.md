# Professor Lecture Web Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional `courseIntent=professor_lecture_deck` support so Codex/Claude can generate professor-style university or graduate Web Decks while keeping the existing mental-model Web Deck path as the default.

**Architecture:** Add a small `course-intent` contract module and propagate it through learner briefs, natural-language intent parsing, MCP schemas, authoring context, content blueprints, quality reporting, skills, and docs. Keep the current Web Deck renderer and default learner MCP profile unchanged; only the authoring rules and quality rubric branch by intent.

**Tech Stack:** TypeScript, Vitest, local MCP JSON-RPC server, existing learner runtime, React/Vite Web Deck preview, Markdown docs and skills.

---

## Files

- Create: `tools/agent-runtime/learner/course-intent.ts`
- Create: `tools/agent-runtime/learner/course-intent.test.ts`
- Create: `tools/agent-runtime/quality/professor-lecture-rubric.ts`
- Create: `tools/agent-runtime/quality/professor-lecture-rubric.test.ts`
- Modify: `tools/agent-runtime/learner/learner-project-service.ts`
- Modify: `tools/agent-runtime/learner/learner-project-service.test.ts`
- Modify: `tools/agent-runtime/learner/project-registry.ts`
- Modify: `tools/agent-runtime/natural-language/run-intent.ts`
- Modify: `tools/agent-runtime/natural-language/run-intent.test.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.ts`
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.test.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `tools/mcp-server/json-rpc-server.test.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `docs/product/product-core.md`
- Modify: `docs/runtime/codex-user-trial-script.md`
- Modify: `docs/runtime/seed-user-prompts.md`
- Modify: `docs/runtime/mcp-skills-bundle.md`
- Modify: `README.md`
- Modify: `scripts/learning-agent-bundle.test.ts`

## Task 1: Course Intent Contract And Inference

**Purpose:** Introduce a reusable `CourseIntent` type and inference rules without changing publishing behavior yet.

**Files:**
- Create: `tools/agent-runtime/learner/course-intent.ts`
- Create: `tools/agent-runtime/learner/course-intent.test.ts`
- Modify: `tools/agent-runtime/learner/learner-project-service.ts`
- Modify: `tools/agent-runtime/learner/learner-project-service.test.ts`
- Modify: `tools/agent-runtime/natural-language/run-intent.ts`
- Modify: `tools/agent-runtime/natural-language/run-intent.test.ts`

- [ ] **Step 1: Write failing course-intent unit tests**

Create `tools/agent-runtime/learner/course-intent.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { courseIntentLabel, defaultCourseIntent, inferCourseIntent, normalizeCourseIntent } from "./course-intent.js";

describe("course-intent", () => {
  test("defaults to mental-model Web Decks", () => {
    expect(defaultCourseIntent).toBe("build_mental_model");
    expect(inferCourseIntent("请用 /tmp/book.pdf 生成中文学习材料")).toBe("build_mental_model");
  });

  test("infers professor lecture Web Deck wording from Chinese and English requests", () => {
    expect(inferCourseIntent("请生成像大学教授 PPT 一样的中文 Web Deck，帮助我快速掌握课程核心内容")).toBe(
      "professor_lecture_deck"
    );
    expect(inferCourseIntent("turn this book into graduate lecture slides, but keep the output as a web deck")).toBe(
      "professor_lecture_deck"
    );
    expect(inferCourseIntent("请做成研究生课程讲义，包含概念框架、经典例题和课后阅读路径")).toBe("professor_lecture_deck");
  });

  test("prefers explicit normalized course intent over ambiguous wording", () => {
    expect(normalizeCourseIntent("professor_lecture_deck")).toBe("professor_lecture_deck");
    expect(normalizeCourseIntent("build_mental_model")).toBe("build_mental_model");
    expect(normalizeCourseIntent("unknown")).toBeUndefined();
  });

  test("labels course intents for learner-facing Chinese text", () => {
    expect(courseIntentLabel("build_mental_model")).toBe("互动学习课");
    expect(courseIntentLabel("professor_lecture_deck")).toBe("教授式课程讲义 Web Deck");
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npx vitest run tools/agent-runtime/learner/course-intent.test.ts --pool threads
```

Expected:

```text
FAIL because ./course-intent.js does not exist.
```

- [ ] **Step 3: Add the course-intent module**

Create `tools/agent-runtime/learner/course-intent.ts`:

```ts
export type CourseIntent = "build_mental_model" | "professor_lecture_deck";

export const defaultCourseIntent: CourseIntent = "build_mental_model";

const courseIntentSet = new Set<CourseIntent>(["build_mental_model", "professor_lecture_deck"]);

export function normalizeCourseIntent(value: unknown): CourseIntent | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return courseIntentSet.has(value as CourseIntent) ? (value as CourseIntent) : undefined;
}

export function inferCourseIntent(request: string): CourseIntent {
  const normalized = request.toLocaleLowerCase();
  if (
    /教授\s*ppt|教授式|大学课程|研究生课程|课程讲义|像老师上课|快速掌握.*课程核心|lecture\s*slides?|lecture\s*deck|professor/i.test(
      normalized
    )
  ) {
    return "professor_lecture_deck";
  }
  if (/courseintent\s*[=＝:：]\s*professor_lecture_deck/i.test(normalized)) {
    return "professor_lecture_deck";
  }
  if (/courseintent\s*[=＝:：]\s*build_mental_model/i.test(normalized)) {
    return "build_mental_model";
  }
  return defaultCourseIntent;
}

export function courseIntentLabel(intent: CourseIntent): string {
  if (intent === "professor_lecture_deck") {
    return "教授式课程讲义 Web Deck";
  }
  return "互动学习课";
}
```

- [ ] **Step 4: Run the course-intent unit test to verify it passes**

Run:

```bash
npx vitest run tools/agent-runtime/learner/course-intent.test.ts --pool threads
```

Expected:

```text
1 test file passes.
```

- [ ] **Step 5: Add failing learner-project and run-intent tests**

Append to `tools/agent-runtime/learner/learner-project-service.test.ts`:

```ts
  test("records professor lecture deck intent from explicit input and natural language", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request:
        "请用 /tmp/book.pdf 生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织，面向有基础的学习者，教学难度为大学高年级/研究生课程，每个单元 10 页。",
      runId: "professor-deck"
    });

    expect(result).toMatchObject({
      status: "project_ready",
      brief: {
        courseIntent: "professor_lecture_deck",
        unitPages: 10
      }
    });
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.next.codexInstruction).toContain("教授式课程讲义 Web Deck");
    const manifest = JSON.parse(await readFile(path.join(root, "runs", "professor-deck", "learner-project.json"), "utf8")) as {
      brief: { courseIntent?: string };
      project?: { courseIntent?: string };
    };
    expect(manifest.brief.courseIntent).toBe("professor_lecture_deck");
    expect(manifest.project?.courseIntent).toBe("professor_lecture_deck");
  });

  test("keeps mental model intent as the default", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request:
        "请用 /tmp/book.pdf 生成中文互动学习材料，面向有基础的学习者，教学难度为本科核心课程，每个单元 8 页。"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.brief.courseIntent).toBe("build_mental_model");
  });
```

Append to `tools/agent-runtime/natural-language/run-intent.test.ts`:

```ts
  test("maps professor lecture deck requests into course intent", () => {
    const intent = parseRunIntent(
      "请把 /tmp/book.pdf 这本书生成教授式中文 Web Deck，像大学课程 PPT 一样组织，每个单元 10 页，面向研究生。"
    );

    expect(intent.courseIntent).toBe("professor_lecture_deck");
  });
```

- [ ] **Step 6: Run tests to verify they fail for missing propagation**

Run:

```bash
npx vitest run tools/agent-runtime/learner/learner-project-service.test.ts tools/agent-runtime/natural-language/run-intent.test.ts --pool threads
```

Expected:

```text
FAIL because brief/project/run intent do not include courseIntent yet.
```

- [ ] **Step 7: Propagate courseIntent in learner project and natural-language intent**

In `tools/agent-runtime/learner/learner-project-service.ts`, add:

```ts
import { courseIntentLabel, inferCourseIntent, normalizeCourseIntent, type CourseIntent } from "./course-intent.js";
```

Update `CreateLearnerProjectInput`:

```ts
  courseIntent?: CourseIntent;
```

Update `LearnerBrief`:

```ts
  courseIntent: CourseIntent;
```

Update the `ProjectRegistry.upsertProject` call:

```ts
      courseIntent: brief.courseIntent,
```

Update `buildAuthoringContextGuidance` after the language line:

```ts
    `课程形态：${courseIntentLabel(brief.courseIntent)}（${brief.courseIntent}）。`,
```

Update `buildBrief`:

```ts
    courseIntent: normalizeCourseIntent(input.courseIntent) ?? inferCourseIntent(request),
```

In `tools/agent-runtime/natural-language/run-intent.ts`, add:

```ts
import { inferCourseIntent, type CourseIntent } from "../learner/course-intent.js";
```

Update `RunIntent`:

```ts
  courseIntent: CourseIntent;
```

Update `parseRunIntent` return object:

```ts
    courseIntent: inferCourseIntent(rawRequest),
```

- [ ] **Step 8: Add courseIntent to project registry**

In `tools/agent-runtime/learner/project-registry.ts`, update `LearningProjectRecord`:

```ts
  courseIntent?: string;
```

In `readProject`, include:

```ts
      courseIntent: optionalString(brief.courseIntent),
```

In `normalizeProject`, include:

```ts
    courseIntent: optionalString(value.courseIntent),
```

- [ ] **Step 9: Run Task 1 tests**

Run:

```bash
npx vitest run tools/agent-runtime/learner/course-intent.test.ts tools/agent-runtime/learner/learner-project-service.test.ts tools/agent-runtime/natural-language/run-intent.test.ts --pool threads
```

Expected:

```text
All listed tests pass.
```

- [ ] **Step 10: Commit Task 1**

Run:

```bash
git add tools/agent-runtime/learner/course-intent.ts tools/agent-runtime/learner/course-intent.test.ts tools/agent-runtime/learner/learner-project-service.ts tools/agent-runtime/learner/learner-project-service.test.ts tools/agent-runtime/learner/project-registry.ts tools/agent-runtime/natural-language/run-intent.ts tools/agent-runtime/natural-language/run-intent.test.ts
git commit -m "Add course intent learner contract"
```

## Task 2: MCP Schema And Runtime Tool Propagation

**Purpose:** Allow clients to pass `courseIntent` through `prepare_learning_course` and verify it appears in MCP results.

**Files:**
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify: `tools/mcp-server/json-rpc-server.test.ts`
- Modify: `tools/mcp-server/runtime-tools.test.ts`

- [ ] **Step 1: Write failing MCP schema test**

Update `tools/mcp-server/json-rpc-server.test.ts` in the existing `prepare_learning_course schema exposes one-call learner inputs` test:

```ts
        courseIntent: { type: "string" },
```

Append this test:

```ts
  test("prepare_learning_course accepts professor lecture course intent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-professor-intent-"));
    const tools = new LearningAgentRuntimeTools(root);

    const prepared = await callMcpTool(tools, "learning_agent.prepare_learning_course", {
      request:
        "请用 /tmp/book.pdf 生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。",
      runId: "professor-intent-mcp",
      sourcePath: "/tmp/book.pdf",
      sourceKind: "book",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 10,
      courseIntent: "professor_lecture_deck"
    });

    expect(prepared).toMatchObject({
      status: "authoring_context_ready",
      runId: "professor-intent-mcp",
      brief: {
        courseIntent: "professor_lecture_deck",
        unitPages: 10
      }
    });
  });
```

- [ ] **Step 2: Run MCP JSON-RPC tests to verify failure**

Run:

```bash
npx vitest run tools/mcp-server/json-rpc-server.test.ts --pool threads
```

Expected:

```text
FAIL because courseIntent is not exposed in the schema or runtime input.
```

- [ ] **Step 3: Add courseIntent to MCP contracts**

In `tools/mcp-server/tool-contracts.ts`, add `courseIntent: stringSchema` to both `create_learning_project` and `prepare_learning_course` input schemas:

```ts
        courseIntent: stringSchema,
```

- [ ] **Step 4: Add courseIntent to runtime tool parsing**

In `tools/mcp-server/runtime-tools.ts`, pass `courseIntent` in both `create_learning_project` and `prepare_learning_course` tool handlers:

```ts
      courseIntent: optionalCourseIntent(options.courseIntent),
```

Add this helper near the other optional helpers:

```ts
function optionalCourseIntent(value: unknown): "build_mental_model" | "professor_lecture_deck" | undefined {
  return value === "build_mental_model" || value === "professor_lecture_deck" ? value : undefined;
}
```

- [ ] **Step 5: Add runtime-tools direct-call expectation**

Append to `tools/mcp-server/runtime-tools.test.ts`:

```ts
  test("prepare_learning_course direct runtime call preserves professor course intent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);

    const result = await tools.callTool("learning_agent.prepare_learning_course", {
      request:
        "请用 /tmp/book.pdf 生成教授式中文 Web Deck，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。",
      runId: "runtime-professor-intent",
      sourcePath: "/tmp/book.pdf",
      sourceKind: "book",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 10,
      courseIntent: "professor_lecture_deck"
    });

    expect(result).toMatchObject({
      status: "authoring_context_ready",
      brief: {
        courseIntent: "professor_lecture_deck"
      }
    });
  });
```

- [ ] **Step 6: Run MCP tests**

Run:

```bash
npx vitest run tools/mcp-server/json-rpc-server.test.ts tools/mcp-server/runtime-tools.test.ts --pool threads
```

Expected:

```text
Both test files pass.
```

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add tools/mcp-server/tool-contracts.ts tools/mcp-server/runtime-tools.ts tools/mcp-server/json-rpc-server.test.ts tools/mcp-server/runtime-tools.test.ts
git commit -m "Expose course intent through MCP"
```

## Task 3: Professor Intent In Authoring Context And Content Blueprint

**Purpose:** Make `prepare_learning_course` return professor-style authoring rules and page blueprints while preserving the current mental-model default.

**Files:**
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.ts`
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.test.ts`
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.ts`

- [ ] **Step 1: Write failing content blueprint test**

Append to `tools/agent-runtime/learner/content-quality-blueprint.test.ts`:

```ts
  test("builds professor lecture deck page blueprints when requested", () => {
    const blueprint = buildContentBlueprint({
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      sourceKind: "book",
      courseIntent: "professor_lecture_deck",
      units: [plannedUnit({ targetPageCount: 10, focusConcepts: ["Agentic Design Patterns"] })]
    });

    expect(blueprint.courseIntent).toBe("professor_lecture_deck");
    expect(blueprint.globalRules.join("\n")).toContain("教授式课程讲义 Web Deck");
    expect(blueprint.globalRules.join("\n")).toContain("不要生成 PPTX");
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.lectureRole)).toEqual([
      "lecture_framing",
      "prerequisite_map",
      "concept_framework",
      "definition_block",
      "method_structure",
      "worked_example",
      "comparison_taxonomy",
      "discussion_prompt",
      "homework_task",
      "lecture_takeaway"
    ]);
    expect(blueprint.units[0]?.pageBlueprints[0]).toMatchObject({
      pageType: "problem_scene",
      teachingMove: expect.stringContaining("课程定位"),
      learnerAction: expect.stringContaining("判断这门课要解决什么问题"),
      mustInclude: expect.arrayContaining([expect.stringContaining("课程框架")])
    });
    expect(blueprint.units[0]?.pageBlueprints[7]).toMatchObject({
      pageType: "quiz",
      lectureRole: "discussion_prompt",
      mustInclude: expect.arrayContaining([expect.stringContaining("课堂讨论题")])
    });
    expect(blueprint.units[0]?.pageBlueprints[8]).toMatchObject({
      pageType: "transfer_challenge",
      lectureRole: "homework_task",
      mustInclude: expect.arrayContaining([expect.stringContaining("课后作业")])
    });
  });
```

- [ ] **Step 2: Run content blueprint tests to verify failure**

Run:

```bash
npx vitest run tools/agent-runtime/learner/content-quality-blueprint.test.ts --pool threads
```

Expected:

```text
FAIL because BuildContentBlueprintInput has no courseIntent and page blueprints have no lectureRole.
```

- [ ] **Step 3: Extend content blueprint types and input**

In `tools/agent-runtime/learner/content-quality-blueprint.ts`, import:

```ts
import { defaultCourseIntent, type CourseIntent } from "./course-intent.js";
```

Update `ContentBlueprint`:

```ts
  courseIntent: CourseIntent;
```

Update `PageContentBlueprint`:

```ts
  lectureRole?: string;
```

Update `BuildContentBlueprintInput`:

```ts
  courseIntent?: CourseIntent;
```

Update `buildContentBlueprint`:

```ts
  const courseIntent = input.courseIntent ?? defaultCourseIntent;
  return {
    version: "content-blueprint/v1",
    courseIntent,
    globalRules: globalRules({ ...input, courseIntent }),
    units: input.units.map((unit) => buildUnitBlueprint(unit, input.sourceKind, input.difficultyLevel, input.sourceSemantics, courseIntent))
  };
```

- [ ] **Step 4: Add professor lecture templates**

In `tools/agent-runtime/learner/content-quality-blueprint.ts`, add:

```ts
function professorLectureTemplatesForPageCount(targetPageCount: number): PageTemplate[] {
  const templates: PageTemplate[] = [
    professorTemplate("lecture_framing", "problem_scene", "用一页说明这门课/本单元的课程定位、核心问题和学习收益。", "判断这门课要解决什么问题，以及哪些内容不是本讲重点。", "课程框架图或问题空间地图。", "用课堂讲义式答案说明为什么这些问题构成课程主线。", ["课程框架", "核心问题", "本讲边界"]),
    professorTemplate("prerequisite_map", "structure_diagram", "列出先修知识、符号、术语和学习者需要补齐的背景。", "标记自己已掌握、需要复习和可以跳过的先修点。", "先修知识依赖图。", "解释缺少哪些先修会影响后续理解。", ["先修要求", "术语准备", "学习路径"]),
    professorTemplate("concept_framework", "structure_diagram", "给出本讲概念地图、方法谱系或理论框架。", "指出核心概念之间的依赖、对比和层级。", "概念地图、分类树或方法谱系图。", "解释概念之间的关系，而不是逐条摘要。", ["概念框架", "方法谱系", "课程骨架"]),
    professorTemplate("definition_block", "intuition_visual", "在课程语境中引入关键定义、记号或正式术语。", "把定义和前面的课程问题对应起来。", "定义卡片加例子/反例。", "说明定义服务于哪个后续推理或方法。", ["关键定义", "术语", "例子/反例"]),
    professorTemplate("method_structure", "structure_diagram", "拆解核心方法、理论结构、机制或算法流程。", "沿结构图说明每个组成部分承担什么功能。", "方法结构图、流程图或系统图。", "说明结构中每一步的因果角色。", ["方法结构", "机制", "适用条件"]),
    professorTemplate("worked_example", "code_walkthrough", "用经典例题、案例、推导或 proof sketch 连接抽象和应用。", "跟随例题判断每一步为什么成立。", "例题分步板书、公式推导或案例表。", "解释例题暴露了什么通用解题模式。", ["经典例题", "推导", "case analysis"]),
    professorTemplate("comparison_taxonomy", "structure_diagram", "比较相关方法、理论分支、设计选择或常见路线。", "根据条件选择适合的方法，并说明权衡。", "对比表、二维坐标或 taxonomy。", "解释不同方法的适用边界和取舍。", ["方法比较", "taxonomy", "权衡"]),
    professorTemplate("discussion_prompt", "quiz", "提出课堂讨论题，要求学习者做诊断、批判或设计判断。", "给出自己的判断和依据。", "讨论题卡片和参考要点。", "提供课堂式参考答案，不只给对错。", ["课堂讨论题", "批判性问题", "参考要点"]),
    professorTemplate("homework_task", "transfer_challenge", "给出课后作业、阅读路径或小型 problem set。", "选择一道作业并说明需要回看哪些来源。", "作业列表、阅读路径或 problem set。", "说明作业如何巩固课程主线。", ["课后作业", "阅读路径", "problem set"]),
    professorTemplate("lecture_takeaway", "summary_card", "压缩本讲 takeaways、考试/研究/实践中最该带走的结构。", "复述三条 takeaway 并指出一条仍不清楚的点。", "takeaway 卡片和复习清单。", "说明这些 takeaway 如何指导后续学习。", ["本讲 takeaway", "复习清单", "下一讲衔接"])
  ];
  if (targetPageCount <= 6) {
    return [templates[0]!, templates[2]!, templates[4]!, templates[5]!, templates[7]!, templates[9]!];
  }
  if (targetPageCount <= 8) {
    return [templates[0]!, templates[1]!, templates[2]!, templates[4]!, templates[5]!, templates[6]!, templates[7]!, templates[9]!];
  }
  return templates.slice(0, Math.min(targetPageCount, templates.length));
}

function professorTemplate(
  lectureRole: string,
  pageType: string,
  teachingMove: string,
  learnerAction: string,
  visualRequirement: string,
  feedbackRequirement: string,
  mustInclude: string[]
): PageTemplate {
  return {
    lectureRole,
    pageType,
    teachingMove,
    learnerAction,
    visualRequirement,
    feedbackRequirement,
    mustInclude: () => mustInclude
  };
}
```

Update `buildUnitBlueprint` to use professor templates when requested:

```ts
  const templates = courseIntent === "professor_lecture_deck" ? professorLectureTemplatesForPageCount(unit.targetPageCount) : templatesForPageCount(unit.targetPageCount);
```

When mapping page blueprints, include:

```ts
      ...(template.lectureRole ? { lectureRole: template.lectureRole } : {}),
```

Update the `PageTemplate` type:

```ts
  lectureRole?: string;
```

Update `globalRules` to branch on professor mode:

```ts
    ...(input.courseIntent === "professor_lecture_deck"
      ? [
          "课程形态为教授式课程讲义 Web Deck：像大学/研究生课堂讲义一样组织课程框架、概念地图、方法谱系、经典例题、课堂讨论和课后作业。",
          "不要生成 PPTX、Slides 或文件导出话术；最终产物仍是 Web Deck。",
          "不要求每页都有操作型 interaction，但每页必须有清晰 lecture purpose、可见结构或课堂判断任务。"
        ]
      : [
          "不要把资料改写成摘要；每页必须有一个学习动作、一个可见结构或一个可检查判断。",
          "术语、公式、代码和定义必须放在直觉、视觉模型和 learner action 之后。",
          "反馈必须解释为什么，指出错误假设、因果机制和可迁移规则。"
        ]),
```

- [ ] **Step 5: Run content blueprint tests**

Run:

```bash
npx vitest run tools/agent-runtime/learner/content-quality-blueprint.test.ts --pool threads
```

Expected:

```text
All content blueprint tests pass.
```

- [ ] **Step 6: Write failing authoring-context test**

Append to `tools/agent-runtime/learner/authoring-context-service.test.ts`:

```ts
  test("returns professor lecture deck intent and authoring guidance", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-context-professor-"));
    const sourcePath = path.join(root, "lecture-book.md");
    await writeFile(
      sourcePath,
      [
        "# Agentic Design Patterns",
        "This chapter introduces planning, tool use, reflection, and evaluation.",
        "A graduate course should compare agent orchestration patterns and assign homework."
      ].join("\n"),
      "utf8"
    );
    const project = await new LearnerProjectService(root).createProject({
      request:
        `请用 "${sourcePath}" 生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。`,
      runId: "professor-authoring",
      courseIntent: "professor_lecture_deck"
    });
    expect(project.status).toBe("project_ready");

    const context = await new AuthoringContextService(root).getContext({ runId: "professor-authoring" });

    expect(context.brief.courseIntent).toBe("professor_lecture_deck");
    expect(context.contentBlueprint.courseIntent).toBe("professor_lecture_deck");
    expect(context.contentBlueprint.globalRules.join("\n")).toContain("教授式课程讲义 Web Deck");
    expect(context.contentBlueprint.units[0]?.pageBlueprints.some((page) => page.lectureRole === "worked_example")).toBe(true);
    expect(context.qualityContract.courseIntent).toBe("professor_lecture_deck");
    expect(context.codexInstruction).toContain("教授式课程讲义 Web Deck");
  });
```

- [ ] **Step 7: Propagate courseIntent through authoring context**

In `tools/agent-runtime/learner/authoring-context-service.ts`, import:

```ts
import { courseIntentLabel, defaultCourseIntent, type CourseIntent } from "./course-intent.js";
```

Update `LearnerProjectFile.brief`:

```ts
    courseIntent?: CourseIntent;
```

Update `AuthoringContextResult.brief`:

```ts
    courseIntent: CourseIntent;
```

Update `qualityContract` type:

```ts
    courseIntent: CourseIntent;
```

Add to `brief` construction:

```ts
      courseIntent: project.brief?.courseIntent ?? defaultCourseIntent,
```

Pass to `buildContentBlueprint`:

```ts
      courseIntent: brief.courseIntent,
```

In `authoringContract.requirements`, replace the interaction-heavy requirement with:

```ts
          brief.courseIntent === "professor_lecture_deck"
            ? "每个 lesson 必须中文优先，并包含课程框架、先修要求、概念地图、核心定义、经典例题、课堂讨论、课后作业或阅读路径。"
            : "每个 lesson 必须中文优先，并包含问题、视觉模型、学习动作、反馈、误区检查和迁移任务。",
```

In `buildQualityContract(brief)`, return:

```ts
    courseIntent: brief.courseIntent,
```

In `buildCodexInstruction`, include:

```ts
    `课程形态：${courseIntentLabel(brief.courseIntent)}（${brief.courseIntent}）。`,
```

For professor mode, add:

```ts
    brief.courseIntent === "professor_lecture_deck"
      ? "请写成教授式课程讲义 Web Deck：课程框架、概念地图、方法谱系、经典例题、课堂讨论、阅读路径和课后作业是重点；不要生成 PPTX 或 Slides。"
      : "请写成互动学习 Web Deck：问题、视觉模型、学习动作、反馈、误区检查和迁移任务是重点。",
```

- [ ] **Step 8: Update bundle authoring guidance**

In `tools/agent-runtime/learner/bundle-authoring-guidance.ts`, import:

```ts
import { courseIntentLabel } from "./course-intent.js";
```

Add after target learner:

```ts
    `课程形态：${courseIntentLabel(brief.courseIntent)}（${brief.courseIntent}）。`,
```

Replace generation requirements 3-6 with intent-aware text:

```ts
    ...(brief.courseIntent === "professor_lecture_deck"
      ? [
          "3. 教授式课程讲义不强制每页都有 interactionSpec；但每页必须有 lecture purpose、可见结构或课堂判断任务。",
          "4. 至少包含课程框架、先修要求、概念地图、经典例题/推导/案例、方法比较、课堂讨论题、课后作业或阅读路径。",
          "5. 讨论题和作业必须有参考要点或 answer notes，不能只列题目。",
          "6. 不要写 PPTX、Slides 或导出文件话术；产物仍是 Web Deck。"
        ]
      : [
          "3. 每个 lesson 至少包含 3 个 visualSpec、2 个 meaningful interactionSpec、2 个 assessmentSpec，并且 assessment 页面必须有 feedbackSpec。",
          "4. interactionSpec 必须说明 learnerAction、expectedObservation、cognitivePurpose；选项必须提供 explanation。",
          "5. feedbackSpec 不能只说对/错，必须解释学习者可能误解了什么，以及正确心智模型如何更新。",
          "6. transferTasks 必须把同一机制迁移到新但相关的场景，不能只是复述。"
        ]),
```

- [ ] **Step 9: Run authoring-context and blueprint tests**

Run:

```bash
npx vitest run tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/content-quality-blueprint.test.ts --pool threads
```

Expected:

```text
Both test files pass.
```

- [ ] **Step 10: Commit Task 3**

Run:

```bash
git add tools/agent-runtime/learner/authoring-context-service.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/content-quality-blueprint.ts tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/learner/bundle-authoring-guidance.ts
git commit -m "Add professor lecture authoring blueprint"
```

## Task 4: Professor Lecture Quality Rubric

**Purpose:** Judge professor-style decks by lecture quality instead of requiring the same interaction density as mental-model lessons.

**Files:**
- Create: `tools/agent-runtime/quality/professor-lecture-rubric.ts`
- Create: `tools/agent-runtime/quality/professor-lecture-rubric.test.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`

- [ ] **Step 1: Write professor lecture rubric tests**

Create `tools/agent-runtime/quality/professor-lecture-rubric.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { evaluateProfessorLectureRubric } from "./professor-lecture-rubric.js";
import { publishableLessonFixture } from "./test-fixtures.js";

describe("professor lecture rubric", () => {
  test("passes a professor-style lecture deck with framing, example, discussion, homework, and takeaway", () => {
    const lesson = publishableLessonFixture({ id: "professor-rich", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      feedbackSpec: undefined,
      narrative:
        index === 0
          ? "课程框架：本讲定位、核心问题、先修要求和学习边界。"
          : index === 1
            ? "概念地图：关键定义、术语、方法谱系和理论结构。"
            : index === 2
              ? "方法结构：比较 planning、tool use、reflection 的适用条件。"
              : index === 3
                ? "经典例题：用一个 agent orchestration case analysis 展开推导。"
                : index === 4
                  ? "方法比较：taxonomy、权衡、适用边界和反例。"
                  : index === 5
                    ? "课堂讨论题：批判一个设计选择并给出参考要点。"
                    : index === 6
                      ? "课后作业：阅读路径、problem set 和 homework。"
                      : "本讲 takeaway：三条复习清单和下一讲衔接。"
    }));

    const result = evaluateProfessorLectureRubric([lesson]);

    expect(result.status).toBe("passed");
    expect(result.missingMoves).toEqual([]);
  });

  test("warns when a professor deck is only a generic chapter summary", () => {
    const lesson = publishableLessonFixture({ id: "professor-summary", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page) => ({
      ...page,
      narrative: "本页总结本章内容，介绍核心概念，帮助学习者理解资料大意。"
    }));

    const result = evaluateProfessorLectureRubric([lesson]);

    expect(result.status).toBe("warning");
    expect(result.missingMoves.map((move) => move.id)).toEqual(
      expect.arrayContaining(["course_framing", "worked_example", "discussion_prompt", "homework_or_reading"])
    );
  });
});
```

- [ ] **Step 2: Run rubric tests to verify failure**

Run:

```bash
npx vitest run tools/agent-runtime/quality/professor-lecture-rubric.test.ts --pool threads
```

Expected:

```text
FAIL because professor-lecture-rubric.js does not exist.
```

- [ ] **Step 3: Implement professor lecture rubric**

Create `tools/agent-runtime/quality/professor-lecture-rubric.ts`:

```ts
import { isRecord } from "./validation-result.js";

export type ProfessorLectureMoveId =
  | "course_framing"
  | "prerequisites"
  | "concept_framework"
  | "definitions"
  | "worked_example"
  | "comparison"
  | "discussion_prompt"
  | "homework_or_reading"
  | "lecture_takeaway";

export type ProfessorLectureRubricResult = {
  status: "passed" | "warning";
  missingMoves: Array<{
    id: ProfessorLectureMoveId;
    label: string;
    requiredFix: string;
  }>;
};

const moveRequirements: Array<{
  id: ProfessorLectureMoveId;
  label: string;
  markers: string[];
  requiredFix: string;
}> = [
  {
    id: "course_framing",
    label: "course framing",
    markers: ["课程框架", "课程定位", "核心问题", "learning boundary", "course framing"],
    requiredFix: "Add a lecture framing page that states course position, core questions, and boundaries."
  },
  {
    id: "prerequisites",
    label: "prerequisites",
    markers: ["先修", "prerequisite", "背景知识", "术语准备"],
    requiredFix: "Add prerequisite assumptions and the background a learner should review first."
  },
  {
    id: "concept_framework",
    label: "concept framework",
    markers: ["概念地图", "概念框架", "方法谱系", "taxonomy", "理论结构"],
    requiredFix: "Add a concept framework, method taxonomy, or theory map."
  },
  {
    id: "definitions",
    label: "definitions",
    markers: ["关键定义", "定义", "术语", "formal term"],
    requiredFix: "Add key definitions and connect them to the lecture problem."
  },
  {
    id: "worked_example",
    label: "worked example",
    markers: ["经典例题", "worked example", "推导", "proof sketch", "case analysis", "案例分析"],
    requiredFix: "Add a worked example, derivation, proof sketch, or case analysis."
  },
  {
    id: "comparison",
    label: "comparison",
    markers: ["方法比较", "比较", "权衡", "适用边界", "反例"],
    requiredFix: "Add a comparison or taxonomy page that distinguishes related methods and tradeoffs."
  },
  {
    id: "discussion_prompt",
    label: "discussion prompt",
    markers: ["课堂讨论", "讨论题", "批判", "参考要点", "critique"],
    requiredFix: "Add a classroom discussion question with reasoning or critique notes."
  },
  {
    id: "homework_or_reading",
    label: "homework or reading path",
    markers: ["课后作业", "作业", "阅读路径", "problem set", "homework"],
    requiredFix: "Add homework, a problem set, or a reading path."
  },
  {
    id: "lecture_takeaway",
    label: "lecture takeaway",
    markers: ["takeaway", "本讲 takeaway", "复习清单", "下一讲衔接"],
    requiredFix: "Add a lecture takeaway page with durable review points."
  }
];

export function evaluateProfessorLectureRubric(lessons: unknown[]): ProfessorLectureRubricResult {
  const text = lessons.map(lessonText).join("\n").toLocaleLowerCase();
  const missingMoves = moveRequirements
    .filter((move) => !move.markers.some((marker) => text.includes(marker.toLocaleLowerCase())))
    .map(({ id, label, requiredFix }) => ({ id, label, requiredFix }));
  return {
    status: missingMoves.length === 0 ? "passed" : "warning",
    missingMoves
  };
}

function lessonText(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }
  return JSON.stringify(value);
}
```

- [ ] **Step 4: Run rubric tests**

Run:

```bash
npx vitest run tools/agent-runtime/quality/professor-lecture-rubric.test.ts --pool threads
```

Expected:

```text
Rubric tests pass.
```

- [ ] **Step 5: Add failing course-quality-report tests for professor mode**

Append to `tools/agent-runtime/quality/course-quality-report.test.ts`:

```ts
  test("does not fail professor lecture decks only because every page lacks interactions", () => {
    const lesson = publishableLessonFixture({ id: "professor-quality-rich", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      feedbackSpec: undefined,
      narrative:
        index === 0
          ? "课程框架、课程定位、核心问题和先修要求。"
          : index === 1
            ? "概念地图、关键定义、术语准备和方法谱系。"
            : index === 2
              ? "理论结构、方法比较、taxonomy 和适用边界。"
              : index === 3
                ? "经典例题、case analysis、推导和 proof sketch。"
                : index === 4
                  ? "方法比较、权衡、反例和适用条件。"
                  : index === 5
                    ? "课堂讨论题、批判性问题和参考要点。"
                    : index === 6
                      ? "课后作业、problem set、homework 和阅读路径。"
                      : "本讲 takeaway、复习清单和下一讲衔接。"
    }));

    const report = buildCourseQualityReport({
      runId: "professor-quality",
      coursePackId: "professor-quality",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck",
        difficultyLevel: "upper_undergraduate_or_graduate"
      }
    });

    expect(report.checks.professorLecture).toBe("passed");
    expect(report.issues.map((issue) => issue.issueId)).not.toContain("quality.interaction.cognitive-purpose-vague");
    expect(report.requiredFixes).toEqual([]);
  });

  test("warns when professor lecture decks are only summaries", () => {
    const lesson = publishableLessonFixture({ id: "professor-quality-summary", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page) => ({
      ...page,
      narrative: "本页总结本章内容，介绍核心概念，帮助学习者理解资料大意。"
    }));

    const report = buildCourseQualityReport({
      runId: "professor-summary",
      coursePackId: "professor-summary",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck",
        difficultyLevel: "upper_undergraduate_or_graduate"
      }
    });

    expect(report.status).toBe("warning");
    expect(report.checks.professorLecture).toBe("warning");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.professor-lecture.missing-worked-example",
          category: "lecture_structure",
          requiredFix: expect.stringContaining("worked example")
        }),
        expect.objectContaining({
          issueId: "quality.professor-lecture.missing-homework-or-reading",
          category: "lecture_structure"
        })
      ])
    );
  });
```

- [ ] **Step 6: Update course quality report types and checks**

In `tools/agent-runtime/quality/course-quality-report.ts`, import:

```ts
import {
  evaluateProfessorLectureRubric,
  type ProfessorLectureRubricResult
} from "./professor-lecture-rubric.js";
```

Update `CourseQualityIssueCategory`:

```ts
  | "lecture_structure"
```

Update `CourseQualityAuthoringContext`:

```ts
  courseIntent?: string;
```

Update `CourseQualityReport.checks`:

```ts
    professorLecture: CourseQualityStatus;
```

Update `CourseQualityReport`:

```ts
  professorLectureRubric?: ProfessorLectureRubricResult;
```

In `buildCourseQualityReport`, add after `depthRubric`:

```ts
  const professorLectureRubric =
    input.authoringContext?.courseIntent === "professor_lecture_deck" ? evaluateProfessorLectureRubric(input.lessons) : undefined;
  const professorLectureIssues = professorLectureRubricToIssues(professorLectureRubric);
```

Add `...professorLectureIssues` to the `issues` array.

Add to `checks`:

```ts
    professorLecture: professorLectureRubric ? professorLectureRubricStatusMap[professorLectureRubric.status] : "passed"
```

Add to return object:

```ts
    ...(professorLectureRubric ? { professorLectureRubric } : {})
```

Add helpers:

```ts
const professorLectureRubricStatusMap: Record<ProfessorLectureRubricResult["status"], CourseQualityStatus> = {
  passed: "passed",
  warning: "warning"
};

function professorLectureRubricToIssues(rubric: ProfessorLectureRubricResult | undefined): CourseQualityIssue[] {
  if (!rubric || rubric.status === "passed") {
    return [];
  }
  return rubric.missingMoves.map((move) => ({
    issueId: `quality.professor-lecture.missing-${move.id.replace(/_/gu, "-")}`,
    scope: "lesson",
    severity: "warning",
    category: "lecture_structure",
    reason: `professor lecture deck is missing ${move.label}`,
    requiredFix: move.requiredFix,
    rule: "professor-lecture",
    path: "lesson.professorLecture"
  }));
}
```

- [ ] **Step 7: Relax interaction quality for professor mode**

In `buildCourseQualityReport`, define:

```ts
  const professorMode = input.authoringContext?.courseIntent === "professor_lecture_deck";
```

Change `interactionQuality` check to:

```ts
    interactionQuality: professorMode
      ? "passed"
      : statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter(isInteractionIssue))),
```

When creating `issues`, filter interaction count/feedback issues in professor mode:

```ts
  const lessonIssues = lessonIssueGroups.flatMap((group) =>
    group.issues
      .filter((issue) => !(professorMode && isInteractionIssue(issue)))
      .map((issue) => toCourseQualityIssue(issue, group.lessonId))
  );
```

Then use `...lessonIssues` instead of recomputing `lessonIssueGroups.flatMap(...)`.

- [ ] **Step 8: Run course quality tests**

Run:

```bash
npx vitest run tools/agent-runtime/quality/professor-lecture-rubric.test.ts tools/agent-runtime/quality/course-quality-report.test.ts --pool threads
```

Expected:

```text
Both quality test files pass.
```

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add tools/agent-runtime/quality/professor-lecture-rubric.ts tools/agent-runtime/quality/professor-lecture-rubric.test.ts tools/agent-runtime/quality/course-quality-report.ts tools/agent-runtime/quality/course-quality-report.test.ts
git commit -m "Add professor lecture quality rubric"
```

## Task 5: Skills And Documentation

**Purpose:** Teach Codex/Claude that professor-style output is an optional Web Deck intent, not PPTX export.

**Files:**
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `docs/product/product-core.md`
- Modify: `docs/runtime/codex-user-trial-script.md`
- Modify: `docs/runtime/seed-user-prompts.md`
- Modify: `docs/runtime/mcp-skills-bundle.md`
- Modify: `README.md`
- Modify: `scripts/learning-agent-bundle.test.ts`

- [ ] **Step 1: Write failing bundle/docs tests**

Add these expectations to `scripts/learning-agent-bundle.test.ts`:

```ts
  test("bundle docs describe professor lecture Web Deck as optional mode without PPTX export", () => {
    const sourceToCourse = readFileSync("skills/source-to-course/SKILL.md", "utf8");
    const operator = readFileSync("skills/learning-agent-operator/SKILL.md", "utf8");
    const productCore = readFileSync("docs/product/product-core.md", "utf8");
    const trialScript = readFileSync("docs/runtime/codex-user-trial-script.md", "utf8");

    for (const text of [sourceToCourse, operator, productCore, trialScript]) {
      expect(text).toContain("professor_lecture_deck");
      expect(text).toContain("Web Deck");
    }
    expect(`${sourceToCourse}\n${operator}\n${productCore}\n${trialScript}`).not.toMatch(/生成\s*(PPTX|Slides)|导出\s*(PPTX|Slides)/iu);
  });
```

- [ ] **Step 2: Run bundle tests to verify failure**

Run:

```bash
npx vitest run scripts/learning-agent-bundle.test.ts --pool threads
```

Expected:

```text
FAIL because docs and skills do not mention professor_lecture_deck yet.
```

- [ ] **Step 3: Update source-to-course skill**

In `skills/source-to-course/SKILL.md`, add under the learner requirement clarification section:

```md
Ask for course intent when the learner's goal is ambiguous:

- `build_mental_model`: interactive Web Deck for mental model construction, self-study, learner actions, feedback, misconception checks, and transfer.
- `professor_lecture_deck`: professor-style Web Deck that feels like university or graduate lecture notes, with course framing, prerequisites, concept maps, method taxonomy, worked examples, discussion prompts, homework, reading path, and lecture takeaways.

If the learner says "教授 PPT", "lecture slides", "大学课程讲义", or similar, route to `professor_lecture_deck` but state that the output is still a Web Deck, not PPTX or Slides export.
```

Update the prepare tool example to include:

```json
{"method":"tools/call","params":{"name":"learning_agent.prepare_learning_course","arguments":{"request":"请用 /tmp/book.pdf 生成教授式中文 Web Deck，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。","sourcePath":"/tmp/book.pdf","sourceKind":"book","audience":"研究生","difficultyLevel":"upper_undergraduate_or_graduate","unitPages":10,"courseIntent":"professor_lecture_deck"}}}
```

- [ ] **Step 4: Update learning-agent-operator skill**

In `skills/learning-agent-operator/SKILL.md`, add to the default clarification list:

```md
- course intent: `build_mental_model` for interactive self-study, or `professor_lecture_deck` for professor-style university/graduate Web Decks.
```

Add to response guidance:

```md
When reporting a prepared or published course, summarize the chosen `courseIntent`. If it is `professor_lecture_deck`, describe it as a professor-style Web Deck and do not promise PPTX, Slides, or file export.
```

- [ ] **Step 5: Update docs and README**

In `docs/product/product-core.md`, add after the default loop:

```md
The core Web Deck can be authored with different course intents:

- `build_mental_model`: default interactive learning path for mental model construction.
- `professor_lecture_deck`: optional professor-style university or graduate course deck, still rendered as a Web Deck.
```

In `README.md`, add near the product description:

```md
The Web Deck supports multiple authoring intents. The default is `build_mental_model`; learners may also request `professor_lecture_deck` when they want a university or graduate lecture-style course deck. This still outputs a Web Deck, not PPTX or slide files.
```

In `docs/runtime/codex-user-trial-script.md`, add a section:

````md
## Professor Lecture Web Deck

```text
请把这本书生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织。
我想快速掌握课程核心内容、关键概念、方法谱系、经典例题、课堂讨论题和课后阅读路径。
资料路径：/tmp/book.pdf
```

Expected MCP path:

```text
learning_agent.prepare_learning_course with courseIntent=professor_lecture_deck
learning_agent.publish_learning_course
learning_agent.get_learning_preview
```
````

In `docs/runtime/seed-user-prompts.md`, add the same learner prompt under a `Professor Lecture Web Deck` heading.

In `docs/runtime/mcp-skills-bundle.md`, add `courseIntent` to the learner-visible requirements list and name both accepted values.

- [ ] **Step 6: Run bundle/docs tests**

Run:

```bash
npx vitest run scripts/learning-agent-bundle.test.ts tools/mcp-server/skill-mcp-contract.test.ts --pool threads
npm run bundle:check
```

Expected:

```text
Bundle and skill contract tests pass.
```

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add skills/source-to-course/SKILL.md skills/learning-agent-operator/SKILL.md docs/product/product-core.md docs/runtime/codex-user-trial-script.md docs/runtime/seed-user-prompts.md docs/runtime/mcp-skills-bundle.md README.md scripts/learning-agent-bundle.test.ts
git commit -m "Document professor lecture Web Deck intent"
```

## Task 6: Integration Verification And Release Gate

**Purpose:** Prove the feature works through the learner MCP path and does not break default mental-model behavior.

**Files:**
- Modify: `tools/agent-runtime/learner/prepare-learning-course-service.test.ts`
- Modify: `tools/agent-runtime/learner/learning-course-publisher.test.ts`
- No production file changes unless tests expose a missing propagation from earlier tasks.

- [ ] **Step 1: Add prepare service integration test**

Append to `tools/agent-runtime/learner/prepare-learning-course-service.test.ts`:

```ts
  test("prepares professor lecture Web Deck authoring context in one call", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "prepare-professor-"));
    const sourcePath = path.join(root, "lecture-source.md");
    await writeFile(
      sourcePath,
      "# Course Source\nPlanning, tool use, reflection, and evaluation form the core method taxonomy.\n",
      "utf8"
    );
    const service = new PrepareLearningCourseService(root);

    const result = await service.prepare({
      request:
        `请用 "${sourcePath}" 生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。`,
      runId: "prepare-professor",
      courseIntent: "professor_lecture_deck"
    });

    expect(result.status).toBe("authoring_context_ready");
    if (result.status !== "authoring_context_ready") {
      throw new Error("expected authoring_context_ready");
    }
    expect(result.brief.courseIntent).toBe("professor_lecture_deck");
    expect(result.contentBlueprint.courseIntent).toBe("professor_lecture_deck");
    expect(result.contentBlueprint.globalRules.join("\n")).toContain("教授式课程讲义 Web Deck");
    expect(result.next.recommendedTool).toBe("learning_agent.publish_learning_course");
  });
```

- [ ] **Step 2: Add publisher integration test for professor quality**

Append to `tools/agent-runtime/learner/learning-course-publisher.test.ts`:

```ts
  test("publishes professor lecture Web Decks without requiring interaction-heavy pages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "publisher-professor-"));
    const runId = "publisher-professor";
    await mkdir(path.join(root, "runs", runId, "artifacts"), { recursive: true });
    await writeFile(
      path.join(root, "runs", runId, "artifacts", "authoring-context.draft.json"),
      `${JSON.stringify(
        {
          artifact: {
            brief: {
              courseIntent: "professor_lecture_deck",
              difficultyLevel: "upper_undergraduate_or_graduate",
              sourceKind: "book"
            },
            contentBlueprint: {
              version: "content-blueprint/v1",
              courseIntent: "professor_lecture_deck",
              globalRules: ["教授式课程讲义 Web Deck"],
              units: []
            }
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const lesson = publishableLessonFixture({ id: "publisher-professor-overview", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      feedbackSpec: undefined,
      narrative:
        index === 0
          ? "课程框架、课程定位、核心问题和先修要求。"
          : index === 1
            ? "概念地图、关键定义、术语准备和方法谱系。"
            : index === 2
              ? "理论结构、方法比较、taxonomy 和适用边界。"
              : index === 3
                ? "经典例题、case analysis、推导和 proof sketch。"
                : index === 4
                  ? "方法比较、权衡、反例和适用条件。"
                  : index === 5
                    ? "课堂讨论题、批判性问题和参考要点。"
                    : index === 6
                      ? "课后作业、problem set、homework 和阅读路径。"
                      : "本讲 takeaway、复习清单和下一讲衔接。"
    }));

    const result = await new LearningCoursePublisher(root).publish({
      runId,
      ignoreContentBlueprint: true,
      coursePack: {
        id: runId,
        title: "教授式课程讲义",
        sourceKind: "book",
        strategy: "overview_plus_topic",
        units: [{ unitId: "unit-overview", title: "总览", kind: "overview", lessonId: lesson.id, targetPageCount: 8 }]
      },
      lessons: [lesson]
    });

    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") {
      throw new Error("expected preview_ready");
    }
    expect(result.qualityReport.checks.professorLecture).toBe("passed");
    expect(result.qualityReport.checks.interactionQuality).toBe("passed");
  });
```

- [ ] **Step 3: Run integration tests to verify failures, then fix propagation if needed**

Run:

```bash
npx vitest run tools/agent-runtime/learner/prepare-learning-course-service.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts --pool threads
```

Expected after Tasks 1-5:

```text
Both tests pass. If they fail, fix only the missing courseIntent propagation revealed by the failure.
```

Valid propagation fix locations:

- `tools/agent-runtime/learner/prepare-learning-course-service.ts`
- `tools/agent-runtime/learner/learning-course-publisher.ts`
- `tools/agent-runtime/quality/course-quality-report.ts`

Do not add renderer changes in this task.

- [ ] **Step 4: Run targeted full feature tests**

Run:

```bash
npx vitest run \
  tools/agent-runtime/learner/course-intent.test.ts \
  tools/agent-runtime/learner/learner-project-service.test.ts \
  tools/agent-runtime/natural-language/run-intent.test.ts \
  tools/mcp-server/json-rpc-server.test.ts \
  tools/mcp-server/runtime-tools.test.ts \
  tools/agent-runtime/learner/authoring-context-service.test.ts \
  tools/agent-runtime/learner/content-quality-blueprint.test.ts \
  tools/agent-runtime/quality/professor-lecture-rubric.test.ts \
  tools/agent-runtime/quality/course-quality-report.test.ts \
  tools/agent-runtime/learner/prepare-learning-course-service.test.ts \
  tools/agent-runtime/learner/learning-course-publisher.test.ts \
  scripts/learning-agent-bundle.test.ts \
  --pool threads
```

Expected:

```text
All listed test files pass.
```

- [ ] **Step 5: Verify MCP profile output still stays pruned**

Run:

```bash
npm run mcp -- --list-tools
npm run mcp -- --list-tools --profile authoring
npm run mcp -- --list-tools --profile operator
```

Expected:

```text
Default profile still exposes only learner tools.
prepare_learning_course schema includes courseIntent.
Authoring and operator profiles remain explicit.
```

- [ ] **Step 6: Run stable project gate**

Run:

```bash
npm run test:ci
npm run codex:mcp:check
git diff --check
git status --short --branch
```

Expected:

```text
test:ci passes.
codex:mcp:check passes.
git diff --check exits 0.
Only intentional professor lecture Web Deck changes are present before the final commit.
```

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add tools/agent-runtime/learner/prepare-learning-course-service.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts tools/agent-runtime/learner/prepare-learning-course-service.ts tools/agent-runtime/learner/learning-course-publisher.ts tools/agent-runtime/quality/course-quality-report.ts
git commit -m "Verify professor lecture Web Deck flow"
```

If no production files changed in Task 6, commit only the two integration test files:

```bash
git add tools/agent-runtime/learner/prepare-learning-course-service.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts
git commit -m "Verify professor lecture Web Deck flow"
```

## Final Verification

- [ ] Run targeted feature tests from Task 6 Step 4.
- [ ] Run `npm run test:ci`.
- [ ] Run `npm run codex:mcp:check`.
- [ ] Run `npm run bundle:check`.
- [ ] Run `git diff --check`.
- [ ] Run `git status --short --branch`.

## Final Acceptance

- Natural-language requests for professor-style courses infer `courseIntent=professor_lecture_deck`.
- Explicit `courseIntent` is preserved over inferred values.
- Unspecified intent defaults to `build_mental_model`.
- `prepare_learning_course` schema accepts `courseIntent`.
- Learner project manifests and project registry preserve `courseIntent`.
- Authoring context includes `brief.courseIntent`, `contentBlueprint.courseIntent`, professor-mode global rules, and professor lecture page blueprint roles.
- Professor-mode decks are still Web Decks, with no PPTX or Slides export path.
- Professor-mode quality checks require course framing, prerequisites, concept framework, definitions, worked example, comparison, discussion, homework or reading path, and lecture takeaway.
- Professor-mode quality checks do not fail only because each page lacks interactive manipulation.
- Existing mental-model default behavior remains unchanged.
- Default MCP profile remains learner-only.
- Skills and docs present professor-style Web Deck as an optional mode.
- `npm run test:ci` passes.
