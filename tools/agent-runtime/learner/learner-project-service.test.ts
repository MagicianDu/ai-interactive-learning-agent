import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { LearnerProjectService } from "./learner-project-service.js";

describe("LearnerProjectService", () => {
  test("asks learner-facing clarification questions when request is underspecified", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({ request: "我想学习这本书" });

    expect(result.status).toBe("clarification_required");
    if (result.status !== "clarification_required") {
      throw new Error("expected clarification_required");
    }
    expect(result.clarificationQuestions).toEqual(
      expect.arrayContaining([expect.stringContaining("资料路径"), expect.stringContaining("面向谁")])
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
