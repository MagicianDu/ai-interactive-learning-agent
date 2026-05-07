import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { PrepareLearningCourseService } from "./prepare-learning-course-service.js";

describe("PrepareLearningCourseService", () => {
  test("creates a learner project and returns authoring context in one ready call", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "prepare-learning-course-"));
    const sourcePath = path.join(root, "agentic-notes.md");
    await writeFile(
      sourcePath,
      [
        "# Tool Feedback",
        "Tool feedback lets an agent observe whether a tool call worked before reflection and evaluation.",
        "Experiments show reliability improves when feedback is preserved.",
        "Limitations appear when feedback is missing."
      ].join("\n"),
      "utf8"
    );

    const result = await new PrepareLearningCourseService(root).prepare({
      request: `请用 "${sourcePath}" 生成中文学习课程，面向有编程基础的中文学习者，教学难度为大学高年级/研究生课程，每个单元 8 页，先总览再按核心 topic 拆课。`,
      runId: "prepare-agentic",
      sourcePath,
      sourceKind: "notes",
      audience: "有编程基础的中文学习者",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      strategy: "overview_plus_topic"
    });

    expect(result).toMatchObject({
      status: "authoring_context_ready",
      runId: "prepare-agentic",
      project: {
        status: "project_ready"
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course"
      },
      next: {
        recommendedTool: "learning_agent.publish_learning_course"
      },
      sourceSemantics: {
        keyTerms: expect.arrayContaining([expect.objectContaining({ term: "tool feedback" })]),
        limitationHints: expect.arrayContaining([expect.objectContaining({ statement: expect.stringContaining("Limitations appear") })])
      }
    });
  });

  test("returns learner-answerable clarifications instead of internal artifacts when request is incomplete", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "prepare-learning-course-"));

    const result = await new PrepareLearningCourseService(root).prepare({
      request: "请用 /tmp/book.pdf 生成中文学习课程。",
      runId: "prepare-clarify"
    });

    expect(result).toMatchObject({
      status: "clarification_required",
      runId: "prepare-clarify",
      clarificationQuestions: expect.arrayContaining([
        expect.stringContaining("面向谁"),
        expect.stringContaining("难度")
      ]),
      next: {
        recommendedTool: "learning_agent.prepare_learning_course"
      }
    });
    if (result.status !== "clarification_required") {
      throw new Error("expected clarification_required");
    }
    expect(result.clarificationQuestions.join("\n")).not.toContain("artifact");
  });
});
