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
