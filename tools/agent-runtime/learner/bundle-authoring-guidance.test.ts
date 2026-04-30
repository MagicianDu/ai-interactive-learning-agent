import { describe, expect, test } from "vitest";

import { buildBundleAuthoringGuidance } from "./bundle-authoring-guidance.js";
import { LearnerProjectService } from "./learner-project-service.js";

describe("bundle authoring guidance", () => {
  test("requires Chinese-first lessons, interactions, feedback, transfer tasks, and source anchors", () => {
    const guidance = buildBundleAuthoringGuidance({
      topic: "Agentic Design Patterns",
      sourcePath: "/tmp/book.pdf",
      sourceKind: "book",
      audience: "中文学习者",
      unitPages: 8,
      strategy: "overview_plus_topic",
      language: "zh-CN"
    });

    expect(guidance).toContain("中文");
    expect(guidance).toContain("sourceContext.sourceAnchorIds");
    expect(guidance).toContain("interactionSpec");
    expect(guidance).toContain("feedbackSpec");
    expect(guidance).toContain("transferTasks");
  });

  test("injects the guidance into project_ready Codex instruction", async () => {
    const service = new LearnerProjectService(await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp("/tmp/learner-guidance-")));
    const result = await service.createProject({
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向中文学习者，每个单元 8 页。",
      runId: "guidance-run"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.next.codexInstruction).toContain("sourceContext.sourceAnchorIds");
    expect(result.next.codexInstruction).toContain("learning_agent.publish_learning_course");
  });
});
