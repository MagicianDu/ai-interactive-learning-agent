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
    expect(guidance).toContain("100 页只是长书默认建议");
    expect(guidance).toContain("缺少自学教材结构");
    expect(guidance).not.toContain("缺互动");
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
