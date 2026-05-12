# Student Self-Study Web Textbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `student_self_study_textbook` as a first-class learner mode for source-backed, one-screen Web textbooks with configurable page budgets.

**Architecture:** Keep `build_mental_model` and `professor_lecture_deck` intact, then add a separate self-study route through intent parsing, learner briefs, authoring context, content blueprint, quality gates, and publish blocking. Treat 100 pages as a default long-book budget, not a hard requirement; the system must remind the learner of the default and let natural language override it.

**Tech Stack:** TypeScript, Vitest, existing agent runtime services, existing MCP publish path, existing `textbook_deck` renderer and `knowledgeBoard` schema.

---

## Scope Check

This plan implements the self-study textbook content kernel only. It does not redesign the UI, add a new renderer, change MCP transport, or delete professor-mode artifacts. The successor preview is generated only after the runtime can route, guide, validate, and publish the new mode.

## File Structure

- Modify: `tools/agent-runtime/learner/course-intent.ts`
  - Responsibility: add `student_self_study_textbook`, infer it from self-study long-source requests, and label it.
- Modify: `tools/agent-runtime/learner/course-intent.test.ts`
  - Responsibility: prove explicit and inferred self-study routing.
- Modify: `tools/agent-runtime/natural-language/run-intent.ts`
  - Responsibility: parse total page budgets from natural language without breaking existing per-unit page parsing.
- Modify: `tools/agent-runtime/natural-language/run-intent.test.ts`
  - Responsibility: verify requests such as "不想读完整本书，默认 Web 教材" and "压缩成 80 页".
- Modify: `tools/agent-runtime/corpus-types.ts`
  - Responsibility: add optional `targetTotalPages` to `CoursePackConfig`.
- Modify: `tools/agent-runtime/types.ts`
  - Responsibility: add optional `targetTotalPages` to `CliInitArgs`.
- Modify: `tools/agent-runtime/run-config.ts`
  - Responsibility: preserve total page budget in validated run config and course pack config.
- Modify: `tools/mcp-server/tool-contracts.ts`
  - Responsibility: expose `targetTotalPages` in learner-facing MCP tool schemas.
- Modify: `tools/mcp-server/runtime-tools.ts`
  - Responsibility: pass `targetTotalPages` from MCP calls into learner services.
- Modify: `tools/agent-runtime/learner/learner-project-service.ts`
  - Responsibility: store `targetTotalPages`, record whether the learner specified it, and include a default page reminder.
- Modify: `tools/agent-runtime/learner/project-registry.ts`
  - Responsibility: persist `targetTotalPages`.
- Modify: `tools/agent-runtime/learner/course-unit-planner.ts`
  - Responsibility: distribute total page budget across planned units while preserving one-screen unit sizes.
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.ts`
  - Responsibility: add self-study textbook page templates and global rules.
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.ts`
  - Responsibility: tell Codex to author student-facing textbook fragments, not teacher slides.
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
  - Responsibility: expose `targetTotalPages`, page-budget reminder, and self-study quality contract.
- Create: `tools/agent-runtime/quality/self-study-textbook-rubric.ts`
  - Responsibility: fail pages with teacher-facing phrases, shallow board content, missing examples/boundaries, missing source trace, or likely overflow.
- Create: `tools/agent-runtime/quality/self-study-textbook-rubric.test.ts`
  - Responsibility: prove strong self-study pages pass and teacher-slide artifacts fail.
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
  - Responsibility: include self-study rubric and blocking status in course reports.
- Modify: `tools/agent-runtime/learner/learning-course-publisher.ts`
  - Responsibility: block publish when self-study rubric has errors.
- Modify tests:
  - `tools/agent-runtime/learner/learner-project-service.test.ts`
  - `tools/agent-runtime/learner/project-registry.test.ts`
  - `tools/agent-runtime/learner/course-unit-planner.test.ts`
  - `tools/agent-runtime/learner/content-quality-blueprint.test.ts`
  - `tools/agent-runtime/learner/bundle-authoring-guidance.test.ts`
  - `tools/agent-runtime/learner/authoring-context-service.test.ts`
  - `tools/agent-runtime/quality/course-quality-report.test.ts`
  - `tools/agent-runtime/learner/learning-course-publisher.test.ts`
  - `tools/mcp-server/runtime-tools.test.ts`
  - `tools/mcp-server/json-rpc-server.test.ts`

## Task 1: Course Intent Routing

**Files:**
- Modify: `tools/agent-runtime/learner/course-intent.ts`
- Modify: `tools/agent-runtime/learner/course-intent.test.ts`
- Modify: `tools/agent-runtime/natural-language/run-intent.test.ts`

- [ ] **Step 1: Write failing intent tests**

Add these assertions to `tools/agent-runtime/learner/course-intent.test.ts`:

```ts
test("exports student self-study textbook as a canonical intent", () => {
  expect(courseIntentValues).toEqual(["build_mental_model", "professor_lecture_deck", "student_self_study_textbook"]);
});

test("infers student self-study textbook wording", () => {
  expect(inferCourseIntent("我不想读完整本书，想看 Web 教材快速掌握核心内容")).toBe("student_self_study_textbook");
  expect(inferCourseIntent("把这本 800 页的书压缩成 80 页一屏式自学教材")).toBe("student_self_study_textbook");
  expect(inferCourseIntent("courseIntent=student_self_study_textbook 请做成教授式难度，但给学生自学")).toBe(
    "student_self_study_textbook"
  );
});

test("labels the student self-study textbook intent", () => {
  expect(courseIntentLabel("student_self_study_textbook")).toBe("学生自学 Web 教材");
});
```

Add this assertion to `tools/agent-runtime/natural-language/run-intent.test.ts`:

```ts
test("maps self-study textbook requests into course intent", () => {
  const intent = parseRunIntent("请把 /tmp/book.pdf 这本书做成学生自学 Web 教材，我不想读完整本书。");

  expect(intent.courseIntent).toBe("student_self_study_textbook");
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tools/agent-runtime/learner/course-intent.test.ts tools/agent-runtime/natural-language/run-intent.test.ts
```

Expected: tests fail because `student_self_study_textbook` is not a valid `CourseIntent`.

- [ ] **Step 3: Implement intent value and inference**

Change `tools/agent-runtime/learner/course-intent.ts` to:

```ts
export type CourseIntent = "build_mental_model" | "professor_lecture_deck" | "student_self_study_textbook";

export const courseIntentValues = [
  "build_mental_model",
  "professor_lecture_deck",
  "student_self_study_textbook"
] as const satisfies readonly CourseIntent[];
```

Add explicit and inferred routing before professor routing:

```ts
if (/courseintent\s*[=＝:：]\s*student_self_study_textbook/i.test(normalized)) {
  return "student_self_study_textbook";
}
if (/自学|自己看懂|不想读完整本书|不想读完全书|压缩成\s*\d{1,3}\s*页|web\s*教材|web textbook|self-study|self study/i.test(normalized)) {
  return "student_self_study_textbook";
}
```

Update labels:

```ts
if (intent === "student_self_study_textbook") {
  return "学生自学 Web 教材";
}
if (intent === "professor_lecture_deck") {
  return "教师/课堂 Web Deck";
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tools/agent-runtime/learner/course-intent.test.ts tools/agent-runtime/natural-language/run-intent.test.ts
```

Expected: both test files pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-runtime/learner/course-intent.ts tools/agent-runtime/learner/course-intent.test.ts tools/agent-runtime/natural-language/run-intent.test.ts
git commit -m "feat: route student self-study textbook intent"
```

## Task 2: Configurable Page Budget

**Files:**
- Modify: `tools/agent-runtime/natural-language/run-intent.ts`
- Modify: `tools/agent-runtime/corpus-types.ts`
- Modify: `tools/agent-runtime/types.ts`
- Modify: `tools/agent-runtime/run-config.ts`
- Modify: `tools/agent-runtime/learner/learner-project-service.ts`
- Modify: `tools/agent-runtime/learner/project-registry.ts`
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Modify tests listed in File Structure

- [ ] **Step 1: Write failing budget tests**

Add to `tools/agent-runtime/natural-language/run-intent.test.ts`:

```ts
test("keeps total page budget separate from per-unit page count", () => {
  const intent = parseRunIntent("把 /tmp/book.pdf 做成学生自学 Web 教材，总共 80 页，每个单元 8 页。");

  expect(intent.unitPages).toBe(8);
  expect(intent.targetTotalPages).toBe(80);
});

test("does not treat the default self-study budget as learner-specified", () => {
  const intent = parseRunIntent("把 /tmp/book.pdf 做成学生自学 Web 教材，我不想读完整本书。");

  expect(intent.unitPages).toBe(10);
  expect(intent.targetTotalPages).toBeUndefined();
});
```

Add to `tools/agent-runtime/learner/learner-project-service.test.ts`:

```ts
expect(result.brief.targetTotalPages).toBe(100);
expect(result.brief.totalPagesSpecified).toBe(false);
expect(result.next.codexInstruction).toContain("默认约 100 页");
```

For an explicit request:

```ts
expect(result.brief.targetTotalPages).toBe(80);
expect(result.brief.totalPagesSpecified).toBe(true);
expect(result.next.codexInstruction).toContain("总页数约 80 页");
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tools/agent-runtime/natural-language/run-intent.test.ts tools/agent-runtime/learner/learner-project-service.test.ts tools/agent-runtime/learner/project-registry.test.ts tools/mcp-server/runtime-tools.test.ts tools/mcp-server/json-rpc-server.test.ts
```

Expected: `targetTotalPages` does not exist yet.

- [ ] **Step 3: Add budget fields**

Add optional fields:

```ts
// tools/agent-runtime/natural-language/run-intent.ts
targetTotalPages?: number;
```

```ts
// tools/agent-runtime/corpus-types.ts
targetTotalPages?: number;
```

```ts
// tools/agent-runtime/types.ts
targetTotalPages?: string;
```

```ts
// LearnerBrief in learner-project-service.ts
targetTotalPages?: number;
totalPagesSpecified?: boolean;
```

```ts
// LearningProjectRecord in project-registry.ts
targetTotalPages?: number;
```

Expose the same field in `tools/mcp-server/tool-contracts.ts` for both `learning_agent.create_learner_project` and `learning_agent.prepare_learning_course`:

```ts
targetTotalPages: numberSchema,
```

- [ ] **Step 4: Implement extraction and defaults**

In `run-intent.ts`, add:

```ts
function extractTargetTotalPages(request: string): number | undefined {
  const explicit = request.match(/(?:总共|总计|总页数|全部|整套|整体|压缩成)\s*(\d{1,3})\s*页/u)?.[1];
  const parsed = explicit ? Number(explicit) : undefined;
  if (parsed === undefined) {
    return undefined;
  }
  if (!Number.isInteger(parsed) || parsed < 5 || parsed > 300) {
    throw new Error("target total page count must be between 5 and 300");
  }
  return parsed;
}
```

Return it from `parseRunIntent`:

```ts
targetTotalPages: extractTargetTotalPages(rawRequest),
```

In `learner-project-service.ts`, add:

```ts
const selfStudyDefaultTotalPages = 100;

function inferTargetTotalPages(request: string): number | undefined {
  const match = /(?:总共|总计|总页数|全部|整套|整体|压缩成)\s*(?<pages>[1-9][0-9]{0,2})\s*页/u.exec(request);
  return match?.groups?.pages ? Number(match.groups.pages) : undefined;
}

function defaultTargetTotalPages(courseIntent: CourseIntent, sourceKind: string): number | undefined {
  return courseIntent === "student_self_study_textbook" && sourceKind === "book" ? selfStudyDefaultTotalPages : undefined;
}
```

In `buildBrief`, compute:

```ts
const courseIntent = normalizeCourseIntent(input.courseIntent) ?? inferCourseIntent(request);
const sourceKind = input.sourceKind ?? inferSourceKind(request);
const inferredTotalPages = inferTargetTotalPages(request);
const targetTotalPages = input.targetTotalPages ?? inferredTotalPages ?? defaultTargetTotalPages(courseIntent, sourceKind);
```

Set:

```ts
sourceKind,
targetTotalPages,
totalPagesSpecified: input.targetTotalPages !== undefined || inferredTotalPages !== undefined,
courseIntent
```

- [ ] **Step 5: Add user-facing default reminder**

In `buildAuthoringContextGuidance`, add:

```ts
brief.courseIntent === "student_self_study_textbook" && brief.totalPagesSpecified === false && brief.targetTotalPages
  ? `页数策略：我会先按默认约 ${brief.targetTotalPages} 页的一屏式 Web 教材规划；如果你希望更短或更长，可以直接说总页数或每个单元页数。`
  : brief.targetTotalPages
    ? `页数策略：总页数约 ${brief.targetTotalPages} 页，每个单元约 ${brief.unitPages} 页。`
    : undefined,
```

- [ ] **Step 6: Persist the fields**

Pass `targetTotalPages` to `ProjectRegistry.upsertProject`, and normalize it in `project-registry.ts`:

```ts
targetTotalPages: optionalNumber(value.targetTotalPages),
```

Also read from legacy brief:

```ts
targetTotalPages: optionalNumber(brief.targetTotalPages),
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- tools/agent-runtime/natural-language/run-intent.test.ts tools/agent-runtime/learner/learner-project-service.test.ts tools/agent-runtime/learner/project-registry.test.ts tools/agent-runtime/__tests__/run-config.test.ts tools/mcp-server/runtime-tools.test.ts tools/mcp-server/json-rpc-server.test.ts
```

Expected: tests pass.

- [ ] **Step 8: Commit**

```bash
git add tools/agent-runtime/natural-language/run-intent.ts tools/agent-runtime/natural-language/run-intent.test.ts tools/agent-runtime/corpus-types.ts tools/agent-runtime/types.ts tools/agent-runtime/run-config.ts tools/agent-runtime/learner/learner-project-service.ts tools/agent-runtime/learner/learner-project-service.test.ts tools/agent-runtime/learner/project-registry.ts tools/agent-runtime/learner/project-registry.test.ts tools/mcp-server/tool-contracts.ts tools/mcp-server/runtime-tools.ts tools/mcp-server/runtime-tools.test.ts tools/mcp-server/json-rpc-server.test.ts
git commit -m "feat: add configurable self-study page budget"
```

## Task 3: Unit Planning From Total Budget

**Files:**
- Modify: `tools/agent-runtime/learner/course-unit-planner.ts`
- Modify: `tools/agent-runtime/learner/course-unit-planner.test.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`

- [ ] **Step 1: Write failing planner tests**

Add to `course-unit-planner.test.ts`:

```ts
it("distributes self-study total page budgets across planned units", () => {
  const plan = planCourseUnits({
    runId: "self-study-book",
    topic: "Agentic Design Patterns",
    sourceKind: "book",
    strategy: "overview_plus_topic",
    courseIntent: "student_self_study_textbook",
    unitPageCount: 10,
    targetTotalPages: 80,
    selectedTopics: [],
    selectedChapters: [],
    concepts: ["全局地图", "Prompt Chaining", "Routing", "Parallelization", "Reflection"],
    sourceAnchorIds: Array.from({ length: 20 }, (_, index) => `book:p${index + 1}`),
    sourceNodeIds: ["book:root"],
    sourceChapters: [
      { title: "Prompt Chaining", sourceNodeId: "book:c1", sourceAnchorIds: ["book:p1"] },
      { title: "Routing", sourceNodeId: "book:c2", sourceAnchorIds: ["book:p2"] },
      { title: "Parallelization", sourceNodeId: "book:c3", sourceAnchorIds: ["book:p3"] },
      { title: "Reflection", sourceNodeId: "book:c4", sourceAnchorIds: ["book:p4"] }
    ]
  });

  expect(plan.sourceCoveragePlan.totalPageBudget).toBe(80);
  expect(plan.planningNotes.join("\n")).toContain("总页数约 80");
  expect(plan.units.every((unit) => unit.targetPageCount >= 8 && unit.targetPageCount <= 12)).toBe(true);
});
```

- [ ] **Step 2: Run failing planner test**

Run:

```bash
npm test -- tools/agent-runtime/learner/course-unit-planner.test.ts
```

Expected: TypeScript fails because `targetTotalPages` and `courseIntent` are not accepted by `CourseUnitPlanInput`.

- [ ] **Step 3: Extend planner input**

Add to `CourseUnitPlanInput`:

```ts
courseIntent?: CourseIntent;
targetTotalPages?: number;
```

Import `type CourseIntent` from `./course-intent.js`.

- [ ] **Step 4: Implement budget distribution**

Add helper:

```ts
function pageCountsForUnits(unitCount: number, defaultUnitPageCount: number, targetTotalPages: number | undefined): number[] {
  if (!targetTotalPages) {
    return Array.from({ length: unitCount }, () => defaultUnitPageCount);
  }
  const boundedTotal = Math.max(unitCount, Math.min(300, targetTotalPages));
  const base = Math.max(1, Math.floor(boundedTotal / unitCount));
  const remainder = boundedTotal - base * unitCount;
  return Array.from({ length: unitCount }, (_, index) => base + (index < remainder ? 1 : 0)).map((count) =>
    Math.max(1, Math.min(40, count))
  );
}
```

Use it after `focused` is known:

```ts
const unitPageCounts = pageCountsForUnits(focused.length + 1, input.unitPageCount, input.targetTotalPages);
```

Set overview `targetPageCount: unitPageCounts[0] ?? input.unitPageCount`, and focused unit page counts with `unitPageCounts[unitIndex] ?? input.unitPageCount`.

- [ ] **Step 5: Thread budget through authoring context**

In `AuthoringContextService`, pass:

```ts
courseIntent: project.brief?.courseIntent ?? defaultCourseIntent,
targetTotalPages: project.brief?.targetTotalPages
```

Expose in `coursePlan`:

```ts
targetTotalPages: project.brief?.targetTotalPages,
estimatedTotalPages: unitPlan.estimatedTotalPages,
pageBudgetReminder: pageBudgetReminder(brief)
```

Add:

```ts
function pageBudgetReminder(brief: { courseIntent: CourseIntent; targetTotalPages?: number; totalPagesSpecified?: boolean }): string | undefined {
  if (brief.courseIntent !== "student_self_study_textbook" || !brief.targetTotalPages) {
    return undefined;
  }
  return brief.totalPagesSpecified === false
    ? `默认约 ${brief.targetTotalPages} 页；学习者可以用自然语言调整总页数或每单元页数。`
    : `学习者指定总页数约 ${brief.targetTotalPages} 页。`;
}
```

- [ ] **Step 6: Run planner and context tests**

Run:

```bash
npm test -- tools/agent-runtime/learner/course-unit-planner.test.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/prepare-learning-course-service.test.ts
```

Expected: tests pass.

- [ ] **Step 7: Commit**

```bash
git add tools/agent-runtime/learner/course-unit-planner.ts tools/agent-runtime/learner/course-unit-planner.test.ts tools/agent-runtime/learner/authoring-context-service.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/prepare-learning-course-service.test.ts
git commit -m "feat: plan self-study textbook page budgets"
```

## Task 4: Self-Study Authoring Blueprint

**Files:**
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.ts`
- Modify: `tools/agent-runtime/learner/content-quality-blueprint.test.ts`
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.ts`
- Modify: `tools/agent-runtime/learner/bundle-authoring-guidance.test.ts`

- [ ] **Step 1: Write failing blueprint tests**

Add to `content-quality-blueprint.test.ts`:

```ts
test("builds student self-study textbook page blueprints", () => {
  const blueprint = buildContentBlueprint({
    audience: "研究生自学者",
    difficultyLevel: "upper_undergraduate_or_graduate",
    sourceKind: "book",
    courseIntent: "student_self_study_textbook",
    units: [plannedUnit({ targetPageCount: 10, focusConcepts: ["Agentic Design Patterns"] })]
  });

  expect(blueprint.courseIntent).toBe("student_self_study_textbook");
  expect(blueprint.globalRules.join("\n")).toContain("学生自学 Web 教材");
  expect(blueprint.globalRules.join("\n")).toContain("不要出现本讲定位");
  expect(blueprint.units[0]?.pageBlueprints).toHaveLength(10);
  expect(blueprint.units[0]?.pageBlueprints[0]).toMatchObject({
    pageType: "problem_scene",
    teachingMove: expect.stringContaining("学习问题"),
    learnerAction: expect.stringContaining("自己读懂")
  });
  expect(blueprint.units[0]?.pageBlueprints[0]?.mustInclude).toEqual(
    expect.arrayContaining(["knowledgeBoard", "learner-facing headline", "concrete explanation", "sourceTrace", "bottomLine"])
  );
  expect(blueprint.units[0]?.pageBlueprints.map((page) => page.lectureRole ?? "")).not.toContain("course_framing");
});
```

Add to `bundle-authoring-guidance.test.ts`:

```ts
expect(guidance).toContain("学生自学 Web 教材");
expect(guidance).toContain("每页直接讲内容");
expect(guidance).toContain("不要写本讲定位");
expect(guidance).toContain("knowledgeBoard");
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/learner/bundle-authoring-guidance.test.ts
```

Expected: self-study branch is not implemented.

- [ ] **Step 3: Add self-study global rules**

In `content-quality-blueprint.ts`, branch before professor rules:

```ts
input.courseIntent === "student_self_study_textbook"
  ? [
      "课程形态为学生自学 Web 教材：每页必须直接讲清楚一个知识片段，而不是给老师提示该讲什么。",
      "每页优先产出 page.knowledgeBoard；headline 是学习者问题或知识命题，coreProposition 是本页要讲清楚的答案。",
      "leftColumn 放概念、机制、因果链、定义或推导；rightColumn 放例子、反例、来源证据或适用边界。",
      "不要出现本讲定位、课堂讨论、教授讲义、课后作业、教学目标、教学设计、识别本页中的作用等教师视角话术。",
      "如果内容放不下一屏，必须拆成多页；不要通过长段落或纵向滚动承载密度。",
      "100 页只是长书默认建议，不是硬限制；用户指定页数优先。"
    ]
```

- [ ] **Step 4: Add self-study templates**

Add `selfStudyTemplatesForPageCount` using this base sequence:

```ts
const selfStudyBaseTemplates: PageTemplate[] = [
  selfStudyTemplate("problem_scene", "提出学习问题：这个来源片段解决什么理解问题？", "读完本页后能复述问题和为什么重要。", "用问题-答案-来源证据的板书结构。", "不需要交互反馈，但 bottomLine 必须说明本页带走什么。", ["knowledgeBoard", "learner-facing headline", "concrete explanation", "sourceTrace", "bottomLine"]),
  selfStudyTemplate("intuition_visual", "把来源命题翻译成直觉模型。", "自己用例子解释命题。", "用概念图、对比图或小流程图。", "指出直觉模型的适用范围。", ["直觉模型", "具体例子", "边界提醒"]),
  selfStudyTemplate("structure_diagram", "拆解核心概念结构。", "能指出概念内部的组成部分。", "用结构图或双栏板书。", "解释每个组成部分为什么必要。", ["概念结构", "关键术语", "来源证据"]),
  selfStudyTemplate("process_animation", "讲清楚机制如何一步步发生。", "能按顺序复述机制链。", "用步骤链或状态变化图。", "指出哪一步最容易误解。", ["机制链", "因果关系", "失败点"]),
  selfStudyTemplate("code_walkthrough", "把概念落到例子、公式、伪代码或工程情境。", "能把抽象命题映射到具体场景。", "用短例子或表格。", "说明例子支持哪个来源命题。", ["worked example", "sourceTrace", "适用条件"]),
  selfStudyTemplate("structure_diagram", "区分相邻概念、方法或模式。", "能说出 A 与 B 的边界。", "用对比表或左右栏。", "指出常见混淆。", ["对比维度", "反例", "边界"]),
  selfStudyTemplate("misconception_check", "说明什么时候不适用。", "能识别过度外推。", "用边界案例或失败模式。", "说明错误外推会导致什么误解。", ["失败模式", "反例", "来源局限"]),
  selfStudyTemplate("summary_card", "压缩成本单元的可记忆结构。", "能用自己的话复述主线。", "用总结图或概念链。", "给出下一单元的连接点。", ["summary map", "bottomLine", "下一步阅读路径"])
];
```

Implement `selfStudyTemplate` as a small helper returning `PageTemplate`.

- [ ] **Step 5: Update authoring guidance**

In `bundle-authoring-guidance.ts`, add a self-study branch:

```ts
brief.courseIntent === "student_self_study_textbook"
  ? [
      "3. 学生自学 Web 教材必须每页直接讲内容：标题提出知识问题，coreProposition 给出答案，左右栏展开机制、例子、证据和边界。",
      "4. 每页必须包含 knowledgeBoard，并且 source-backed 页面必须填写 sourceTrace。",
      "5. 不要写本讲定位、课堂讨论、教授讲义、课后作业、教学目标、教学设计、识别本页中的作用。",
      "6. 100 页只是长书默认建议；若 brief.targetTotalPages 存在，按该总页预算规划，否则按每单元页数规划。",
      "7. 页面必须一屏可读；内容太多时拆页。"
    ]
```

- [ ] **Step 6: Run blueprint and guidance tests**

Run:

```bash
npm test -- tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/learner/bundle-authoring-guidance.test.ts
```

Expected: tests pass.

- [ ] **Step 7: Commit**

```bash
git add tools/agent-runtime/learner/content-quality-blueprint.ts tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/learner/bundle-authoring-guidance.ts tools/agent-runtime/learner/bundle-authoring-guidance.test.ts
git commit -m "feat: guide student self-study textbook authoring"
```

## Task 5: Self-Study Quality Gate

**Files:**
- Create: `tools/agent-runtime/quality/self-study-textbook-rubric.ts`
- Create: `tools/agent-runtime/quality/self-study-textbook-rubric.test.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.ts`
- Modify: `tools/agent-runtime/quality/course-quality-report.test.ts`
- Modify: `tools/agent-runtime/learner/learning-course-publisher.ts`
- Modify: `tools/agent-runtime/learner/learning-course-publisher.test.ts`

- [ ] **Step 1: Write rubric tests**

Create `self-study-textbook-rubric.test.ts` with:

```ts
import { describe, expect, test } from "vitest";

import { evaluateSelfStudyTextbookRubric } from "./self-study-textbook-rubric.js";

describe("evaluateSelfStudyTextbookRubric", () => {
  test("passes dense student-facing knowledge board pages", () => {
    expect(evaluateSelfStudyTextbookRubric([selfStudyLesson()])).toMatchObject({
      status: "passed",
      failedPageCount: 0
    });
  });

  test("fails teacher-facing template language", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0].knowledgeBoard.headline = "本讲定位：识别本页中的作用";

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["teacher-facing language"]));
  });

  test("fails pages without examples evidence or boundaries", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0].knowledgeBoard.rightColumn = [{ label: "说明", items: ["概念很重要", "需要理解"] }];

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["example/evidence/boundary"]));
  });
});
```

Use a local fixture with one page containing `sourceAnchorIds`, `knowledgeBoard.sourceTrace`, concrete example text, and bottom line.

Add this fixture in the same test file:

```ts
function selfStudyLesson(): {
  id: string;
  pages: Array<Record<string, any>>;
} {
  return {
    id: "self-study-agentic-pattern",
    pages: [
      {
        id: "p1",
        type: "structure_diagram",
        title: "为什么 agent workflow 需要显式步骤？",
        learningGoal: "理解 workflow 把不可靠的大任务拆成可检查步骤。",
        narrative: "本页解释显式步骤如何降低失败不可见的问题。",
        sourceAnchorIds: ["book:p1"],
        knowledgeBoard: {
          boardKind: "mechanism_board",
          headline: "为什么一个大提示不如可检查的 workflow？",
          coreProposition: "Agent workflow 的核心价值不是把提示写长，而是把任务拆成多个可观察、可恢复、可调整的中间步骤。",
          leftColumn: [
            {
              label: "机制链",
              items: [
                "大任务先被拆成多个短步骤，每一步都有明确输入和输出。",
                "中间输出让系统能发现偏差，而不是等最终答案失败后才知道。",
                "失败恢复可以从具体步骤开始，而不是重跑整个任务。"
              ]
            }
          ],
          rightColumn: [
            {
              label: "例子与边界",
              items: [
                "例如资料学习流程可以拆成来源采样、章节映射、页面 authoring、质量审查。",
                "边界是：如果任务本身很短且没有中间状态，workflow 可能只是增加延迟。",
                "来源证据支持 workflow pattern 通常围绕可组合步骤展开。"
              ]
            }
          ],
          sourceTrace: [{ anchorId: "book:p1", supports: "来源描述了 workflow pattern 通过拆分步骤组织 agent 行为。" }],
          bottomLine: "自学时要记住：workflow 的作用是让复杂任务拥有可检查的中间状态。"
        }
      }
    ]
  };
}
```

- [ ] **Step 2: Run failing rubric tests**

Run:

```bash
npm test -- tools/agent-runtime/quality/self-study-textbook-rubric.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement rubric**

Create `self-study-textbook-rubric.ts` with exported types matching the existing knowledge board rubric shape:

```ts
export type SelfStudyTextbookRubricStatus = "passed" | "failed";
export type SelfStudyTextbookPageResult = {
  lessonId: string;
  pageId: string;
  status: SelfStudyTextbookRubricStatus;
  missingItems: string[];
  weakItems: string[];
};
export type SelfStudyTextbookRubricResult = {
  status: SelfStudyTextbookRubricStatus;
  requiredPageCount: number;
  satisfiedPageCount: number;
  failedPageCount: number;
  pageResults: SelfStudyTextbookPageResult[];
};
```

Use these checks:

```ts
const forbiddenTeacherPhrases = [
  "本讲定位",
  "课堂讨论",
  "教授讲义",
  "课后作业",
  "教学目标",
  "教学设计",
  "识别本页中的作用",
  "这一页应该讲",
  "lecture purpose",
  "teaching move",
  "homework path"
];

const exampleEvidenceBoundaryPattern = /例子|例如|反例|证据|来源|边界|不适用|失败|局限|case|example|evidence|boundary/i;
```

Evaluate all learner-facing board strings:

```ts
const boardText = collectBoardText(board).join("\n");
if (forbiddenTeacherPhrases.some((phrase) => boardText.includes(phrase))) {
  issues.push({ kind: "weak", item: "teacher-facing language" });
}
if (!exampleEvidenceBoundaryPattern.test(boardText)) {
  issues.push({ kind: "weak", item: "example/evidence/boundary" });
}
if (boardText.length > 2200) {
  issues.push({ kind: "weak", item: "one-screen density" });
}
```

Reuse `isRecord` from `validation-result.ts`.

- [ ] **Step 4: Wire course quality report**

In `course-quality-report.ts`, add:

```ts
import {
  evaluateSelfStudyTextbookRubric,
  type SelfStudyTextbookRubricResult
} from "./self-study-textbook-rubric.js";
```

Add category:

```ts
| "self_study_structure"
```

Add report field:

```ts
selfStudyTextbookRubric?: SelfStudyTextbookRubricResult;
```

Inside `buildCourseQualityReport`:

```ts
const selfStudyMode = input.authoringContext?.courseIntent === "student_self_study_textbook";
const selfStudyTextbookRubric = selfStudyMode ? evaluateSelfStudyTextbookRubric(input.lessons) : undefined;
const selfStudyTextbookIssues = selfStudyTextbookRubric ? selfStudyTextbookRubricToIssues(selfStudyTextbookRubric) : [];
```

Include `selfStudyTextbookIssues` in `issues`.

- [ ] **Step 5: Wire publisher blocking**

In `learning-course-publisher.ts`, update `collectBlockingIssues` so self-study mode blocks on:

```ts
if (authoringContext?.courseIntent === "student_self_study_textbook") {
  const rubric = evaluateSelfStudyTextbookRubric(lessons);
  for (const page of rubric.pageResults.filter((result) => result.status === "failed")) {
    issues.push({
      lessonId: page.lessonId,
      issue: {
        severity: "error",
        rule: "self-study-textbook",
        path: page.pageId,
        message: [...page.missingItems, ...page.weakItems].join(", ")
      }
    });
  }
}
```

- [ ] **Step 6: Run quality and publisher tests**

Run:

```bash
npm test -- tools/agent-runtime/quality/self-study-textbook-rubric.test.ts tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts
```

Expected: tests pass.

- [ ] **Step 7: Commit**

```bash
git add tools/agent-runtime/quality/self-study-textbook-rubric.ts tools/agent-runtime/quality/self-study-textbook-rubric.test.ts tools/agent-runtime/quality/course-quality-report.ts tools/agent-runtime/quality/course-quality-report.test.ts tools/agent-runtime/learner/learning-course-publisher.ts tools/agent-runtime/learner/learning-course-publisher.test.ts
git commit -m "feat: validate student self-study textbooks"
```

## Task 6: End-To-End Runtime Contract

**Files:**
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`
- Modify: `tools/agent-runtime/learner/prepare-learning-course-service.test.ts`
- Modify: `tools/agent-runtime/learner/content-blueprint-compliance.ts`
- Modify: `tools/agent-runtime/learner/content-blueprint-compliance.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add to `authoring-context-service.test.ts`:

```ts
expect(context.brief.courseIntent).toBe("student_self_study_textbook");
expect(context.coursePlan.targetTotalPages).toBe(100);
expect(context.coursePlan.pageBudgetReminder).toContain("默认约 100 页");
expect(context.contentBlueprint.courseIntent).toBe("student_self_study_textbook");
expect(context.qualityContract.publishChecklist.join("\n")).toContain("不要出现本讲定位");
expect(context.codexInstruction).toContain("学生自学 Web 教材");
```

Add to `content-blueprint-compliance.test.ts`:

```ts
it("extracts student self-study textbook content blueprints", () => {
  expect(extractContentBlueprint({ contentBlueprint: { ...blueprint(), courseIntent: "student_self_study_textbook" } })?.courseIntent).toBe(
    "student_self_study_textbook"
  );
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/prepare-learning-course-service.test.ts tools/agent-runtime/learner/content-blueprint-compliance.test.ts
```

Expected: context shape and blueprint extraction do not yet support the new mode.

- [ ] **Step 3: Update authoring contract**

In `AuthoringContextService`, add self-study requirements:

```ts
brief.courseIntent === "student_self_study_textbook"
  ? [
      "学生自学 Web 教材必须由 Codex/Claude 直接写出可读内容，不要输出给老师的授课提示。",
      "每页必须包含 knowledgeBoard，且标题、coreProposition、左右栏和 bottomLine 都要是学生能直接读懂的解释。",
      "source-backed 页面必须保留 page.sourceAnchorIds 和 knowledgeBoard.sourceTrace。",
      "禁止本讲定位、课堂讨论、教授讲义、课后作业、教学目标、教学设计等教师视角话术。",
      "默认页数只是建议；如果用户指定总页数或每单元页数，以用户指定为准。"
    ]
```

Add publish checklist items:

```ts
"确认每页能一屏读完；如果内容过长，拆成多页。",
"确认每页至少有例子、反例、证据或边界之一。",
"确认没有教师视角模板词。"
```

- [ ] **Step 4: Run contract tests**

Run:

```bash
npm test -- tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/prepare-learning-course-service.test.ts tools/agent-runtime/learner/content-blueprint-compliance.test.ts
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-runtime/learner/authoring-context-service.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/agent-runtime/learner/prepare-learning-course-service.test.ts tools/agent-runtime/learner/content-blueprint-compliance.ts tools/agent-runtime/learner/content-blueprint-compliance.test.ts
git commit -m "feat: expose self-study textbook authoring contract"
```

## Task 7: Real Source Seed Run

**Files:**
- Create or update: `runs/self-study-agentic-design-textbook-20260512/**`
- No source code changes expected unless quality gates expose implementation defects.

- [ ] **Step 1: Prepare from real book**

Use the Codex MCP tool `learning_agent.prepare_learning_course` with:

```json
{
  "runId": "self-study-agentic-design-textbook-20260512",
  "request": "请把 /Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf 这本书做成学生自学 Web 教材。我不想读完整本书，希望通过一屏式中文 Web 教材掌握核心内容。面向有基础 AI/软件工程经验的学习者，难度为大学高年级/研究生课程。先给总览课，再按核心 topic 拆课。如果我没有指定总页数，请按默认页数提醒并继续。",
  "sourcePath": "/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf",
  "sourceKind": "book",
  "audience": "有基础 AI/软件工程经验，希望通过中文自学 Web 教材掌握 agentic design patterns 的学习者",
  "difficultyLevel": "upper_undergraduate_or_graduate",
  "strategy": "overview_plus_topic",
  "courseIntent": "student_self_study_textbook",
  "unitPages": 10
}
```

Expected authoring context includes:

```text
courseIntent: student_self_study_textbook
targetTotalPages: 100
pageBudgetReminder: 默认约 100 页
```

- [ ] **Step 2: Author and publish with Codex**

Use the generated authoring context to create a course pack and lessons. Requirements:

```text
runId: self-study-agentic-design-textbook-20260512
courseIntent: student_self_study_textbook
displayMode: textbook_deck
every page has knowledgeBoard
no 本讲定位 / 课堂讨论 / 教授讲义 / 课后作业 / 教学目标 / 教学设计
sourceTrace aligns with sourceAnchorIds
```

Then call `learning_agent.publish_learning_course`.

- [ ] **Step 3: Run seed quality checks**

Run:

```bash
npm test -- tools/agent-runtime/quality/self-study-textbook-rubric.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 4: Browser verify**

Open:

```text
http://127.0.0.1:5173/#/preview/self-study-agentic-design-textbook-20260512
```

Check:

```text
knowledgeBoard visible
teacher-facing phrases absent
study page fits one viewport at 1280x900
source trace count is present in metadata but not exposed as learner scaffolding
```

- [ ] **Step 5: Commit seed artifacts**

Only commit seed artifacts if they are intended as checked-in product examples. If they are runtime output only, leave them ignored and record the preview path in the final report.

Suggested commit if tracked:

```bash
git add runs/self-study-agentic-design-textbook-20260512
git commit -m "chore: add self-study textbook seed preview"
```

## Final Verification

- [ ] Run targeted tests:

```bash
npm test -- \
  tools/agent-runtime/learner/course-intent.test.ts \
  tools/agent-runtime/natural-language/run-intent.test.ts \
  tools/agent-runtime/learner/learner-project-service.test.ts \
  tools/agent-runtime/learner/project-registry.test.ts \
  tools/agent-runtime/learner/course-unit-planner.test.ts \
  tools/agent-runtime/learner/content-quality-blueprint.test.ts \
  tools/agent-runtime/learner/bundle-authoring-guidance.test.ts \
  tools/agent-runtime/learner/authoring-context-service.test.ts \
  tools/agent-runtime/learner/content-blueprint-compliance.test.ts \
  tools/agent-runtime/quality/self-study-textbook-rubric.test.ts \
  tools/agent-runtime/quality/course-quality-report.test.ts \
  tools/agent-runtime/learner/learning-course-publisher.test.ts \
  tools/mcp-server/runtime-tools.test.ts \
  tools/mcp-server/json-rpc-server.test.ts
```

- [ ] Run full verification:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

- [ ] Browser acceptance:

```text
Preview URL: http://127.0.0.1:5173/#/preview/self-study-agentic-design-textbook-20260512
Viewport: 1280x900
Acceptance: no vertical study-page overflow, no forbidden teacher-facing phrases, each page directly teaches content.
```

## Self-Review

Spec coverage:

- New `CourseIntent`: Task 1.
- Configurable default page budget and reminder: Task 2.
- Total-page distribution: Task 3.
- Student-facing authoring contract: Task 4 and Task 6.
- Self-study quality gate: Task 5.
- Real source preview: Task 7.

No placeholders:

- Every task names files, commands, expected results, and concrete code snippets.
- Runtime artifact commit is conditional because generated `runs/**` may be ignored; the verification result must still be reported.

Type consistency:

- Use `targetTotalPages` for whole-course budget.
- Use `unitPages` / `unitPageCount` for per-unit page counts.
- Use `student_self_study_textbook` exactly as the course intent value.
