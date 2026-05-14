import { describe, expect, test } from "vitest";

import { buildBundleAuthoringGuidance } from "./bundle-authoring-guidance.js";
import { LearnerProjectService } from "./learner-project-service.js";

describe("bundle authoring guidance", () => {
  test("requires Chinese-first lessons, interactions, feedback, transfer tasks, and source anchors", () => {
    const guidance = buildBundleAuthoringGuidance({
      topic: "Agent Workflow Patterns",
      sourcePath: "/tmp/book.pdf",
      sourceKind: "book",
      audience: "中文学习者",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      strategy: "overview_plus_topic",
      language: "zh-CN",
      courseIntent: "build_mental_model"
    });

    expect(guidance).toContain("中文");
    expect(guidance).toContain("sourceContext.sourceAnchorIds");
    expect(guidance).toContain("imagegen");
    expect(guidance).toContain("教学插图");
    expect(guidance).toContain("interactionSpec");
    expect(guidance).toContain("feedbackSpec");
    expect(guidance).toContain("transferTasks");
  });

  test("keeps professor lecture guidance aligned with publisher baseline", () => {
    const guidance = buildBundleAuthoringGuidance({
      topic: "Agent Workflow Patterns",
      sourcePath: "/tmp/book.pdf",
      sourceKind: "book",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 10,
      strategy: "overview_plus_topic",
      language: "zh-CN",
      courseIntent: "professor_lecture_deck"
    });

    expect(guidance).toContain("教授式 Web Deck");
    expect(guidance).toContain("教材式知识链路");
    expect(guidance).toContain("知识节点");
    expect(guidance).toContain("关键链路");
    expect(guidance).toContain("knowledgeBoard");
    expect(guidance).toContain("imagegen");
    expect(guidance).toContain("允许短标签");
    expect(guidance).toContain("不要把页面标题、底部总结、长段落、表格、UI 文本框或页面卡片原文画进图片");
    expect(guidance).toContain("不要包含长段落文字、表格或 UI 文本框");
    expect(guidance).toContain("source proposition");
    expect(guidance).toContain("leftColumn");
    expect(guidance).toContain("rightColumn");
    expect(guidance).toContain("不要写 PPTX");
    expect(guidance).toContain("缺少可见结构");
    expect(guidance).toContain("缺少知识节点");
    expect(guidance).not.toContain("缺互动");
  });

  test("guides student self-study textbook authoring", () => {
    const guidance = buildBundleAuthoringGuidance({
      topic: "Agent Workflow Patterns",
      sourcePath: "/tmp/book.pdf",
      sourceKind: "book",
      audience: "研究生自学者",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 10,
      targetTotalPages: 100,
      totalPagesSpecified: false,
      strategy: "overview_plus_topic",
      language: "zh-CN",
      courseIntent: "student_self_study_textbook"
    });

    expect(guidance).toContain("学生自学 Web 教材");
    expect(guidance).toContain("每页直接讲内容");
    expect(guidance).toContain("不要写本讲定位");
    expect(guidance).toContain("knowledgeBoard");
    expect(guidance).toContain("imagegen");
    expect(guidance).toContain("教学插图");
    expect(guidance).toContain("允许短标签");
    expect(guidance).toContain("不是固定模板栏");
    expect(guidance).toContain("section label 必须是本页内容小标题");
    expect(guidance).toContain("不要使用“机制链”“正式术语”“例子 / 证据”“边界案例”");
    expect(guidance).toContain("标题必须是内容命题");
    expect(guidance).toContain("不要用页面角色当标题");
    expect(guidance).toContain("不要写“本页围绕");
    expect(guidance).toContain("100 页只是长书默认建议");
    expect(guidance).toContain("缺少自学教材结构");
    expect(guidance).not.toContain("缺互动");
  });

  test("guides selected self-study topics as one complete course bundle", () => {
    const guidance = buildBundleAuthoringGuidance({
      topic: "Agent Workflow Patterns",
      sourcePath: "/tmp/book.pdf",
      sourceKind: "book",
      audience: "研究生自学者",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 10,
      targetTotalPages: 100,
      totalPagesSpecified: false,
      strategy: "overview_plus_topic",
      selectedTopics: ["Prompt Chaining", "Tool Use", "Reflection"],
      language: "zh-CN",
      courseIntent: "student_self_study_textbook"
    });

    expect(guidance).toContain("docs/runtime/self-study-golden-samples.md");
    expect(guidance).toContain("一次性生成完整 coursePack.units");
    expect(guidance).toContain("3 个 selected topic units");
    expect(guidance).toContain("不要为每个 topic 建临时 run");
    expect(guidance).toContain("不要把已选单元拉伸到默认总页数");
  });

  test("project_ready points Codex to authoring context before publishing", async () => {
    const service = new LearnerProjectService(await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp("/tmp/learner-guidance-")));
    const result = await service.createProject({
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向中文学习者，教学难度为大学高年级/研究生课程，每个单元 8 页。",
      runId: "guidance-run"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.next.recommendedTool).toBe("learning_agent.get_authoring_context");
    expect(result.next.codexInstruction).toContain("learning_agent.get_authoring_context");
    expect(result.next.codexInstruction).not.toContain("learning_agent.generate_grounded_course");
  });
});
