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
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.next.recommendedTool).toBe("learning_agent.get_authoring_context");
    expect(result.next.codexInstruction).toContain("learning_agent.get_authoring_context");
    expect(result.next.codexInstruction).not.toContain("learning_agent.generate_grounded_course");
    const manifest = JSON.parse(await readFile(path.join(root, "runs", "book-run", "learner-project.json"), "utf8")) as {
      request: string;
      brief: unknown;
      project?: {
        projectId: string;
        title: string;
        sourceKind: string;
        sourceRefs: string[];
        status: string;
      };
    };
    expect(manifest.request).toContain("有编程基础");
    expect(manifest.brief).toBeDefined();
    expect(manifest.project).toMatchObject({
      projectId: "book-run",
      sourceKind: "book",
      sourceRefs: ["/tmp/book.pdf"],
      status: "draft"
    });
  });

  test("preserves requested chapters and topics in learner brief and Codex instruction", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向有编程基础的学习者，每个单元 8 页，按章节推进。",
      runId: "chapter-run",
      strategy: "chapter_guided",
      selectedChapters: ["第 1 章", "第 3 章"],
      selectedTopics: ["planning", "tool use"]
    });

    expect(result).toMatchObject({
      status: "project_ready",
      brief: {
        strategy: "chapter_guided",
        selectedChapters: ["第 1 章", "第 3 章"],
        selectedTopics: ["planning", "tool use"]
      }
    });
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.next.codexInstruction).toContain("第 1 章");
    expect(result.next.codexInstruction).toContain("planning");
    expect(result.next.codexInstruction).toContain("learning_agent.get_authoring_context");
    await expect(readFile(path.join(root, "runs", "chapter-run", "learner-project.json"), "utf8")).resolves.toContain(
      "selectedChapters"
    );
  });

  test("infers chapter-guided strategy from a learner request", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向中文学习者，每个单元 8 页，按章节推进。第 1 章，第 2 章优先。"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.brief.strategy).toBe("chapter_guided");
    expect(result.next.codexInstruction).toContain("chapter_guided");
  });

  test("honors explicit strategy tokens in a learner request", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向中文学习者，每个单元 8 页，strategy=topic_guided。"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.brief.strategy).toBe("topic_guided");
  });
});
