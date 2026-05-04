import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { LearnerProjectService } from "./learner-project-service.js";
import { AuthoringContextService } from "./authoring-context-service.js";

describe("AuthoringContextService", () => {
  test("returns source-backed context for Codex-authored publishing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-"));
    const sourcePath = path.join(root, "agentic-rag.md");
    await writeFile(
      sourcePath,
      [
        "# Agentic RAG",
        "Agentic RAG starts from a practical question, decides whether retrieval is needed, and then chooses tools.",
        "The learner should compare when a fixed RAG pipeline is enough and when agentic routing is useful."
      ].join("\n\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 生成中文互动学习网页，面向有 RAG 基础的中文学习者，每个单元 8 页，按任务组织。`,
      runId: "context-blog",
      sourcePath,
      sourceKind: "blog",
      audience: "有 RAG 基础的中文学习者",
      unitPages: 8,
      strategy: "task_guided",
      selectedTopics: ["任务判断", "工具选择"]
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "context-blog", maxAnchors: 4 });

    expect(context).toMatchObject({
      status: "authoring_context_ready",
      runId: "context-blog",
      brief: {
        sourceKind: "blog",
        strategy: "task_guided",
        unitPages: 8
      },
      source: {
        sourceKind: "blog",
        anchorCount: expect.any(Number),
        anchors: expect.arrayContaining([
          expect.objectContaining({
            anchorId: expect.stringContaining("source-001")
          })
        ])
      },
      coursePlan: {
        strategy: "task_guided",
        unitPages: 8,
        recommendedUnits: expect.arrayContaining([
          expect.objectContaining({ unitId: "unit-overview", kind: "overview", targetPageCount: 8 }),
          expect.objectContaining({ kind: "task", targetPageCount: 8 })
        ])
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course",
        language: "zh-CN"
      }
    });
    expect(context.codexInstruction).toContain("请由 Codex 创作 coursePack 和 lessons");
    expect(context.codexInstruction).toContain("learning_agent.publish_learning_course");
    expect(context.source.anchors.length).toBeLessThanOrEqual(4);
  });

  test("returns topic-only context without requiring source approval artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-"));
    await new LearnerProjectService(root).createProject({
      request: "请生成哈希表中文互动学习网页，面向有编程基础的学习者，每个单元 8 页。",
      runId: "context-topic",
      audience: "有编程基础的学习者",
      unitPages: 8
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "context-topic" });

    expect(context).toMatchObject({
      status: "authoring_context_ready",
      runId: "context-topic",
      brief: {
        sourceKind: "topic",
        unitPages: 8,
        language: "zh-CN"
      },
      source: {
        sourceKind: "topic",
        anchorCount: 1
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course"
      }
    });
    expect(context.coursePlan.recommendedUnits[0]?.title).toContain("哈希表");
  });
});

