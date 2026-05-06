import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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
        strategyReason: expect.stringContaining("任务"),
        unitPages: 8,
        acceptanceExpectations: expect.arrayContaining([
          expect.objectContaining({
            id: "overview-plus-focused-units",
            required: true
          }),
          expect.objectContaining({
            id: "task-transfer-ready",
            required: true
          })
        ]),
        recommendedUnits: expect.arrayContaining([
          expect.objectContaining({ unitId: "unit-overview", kind: "overview", targetPageCount: 8 }),
          expect.objectContaining({
            kind: "task",
            targetPageCount: 8,
            taskLabel: expect.stringContaining("任务："),
            transferExpectation: expect.stringContaining("迁移"),
            expectedInteractions: expect.arrayContaining(["debugging", "comparison"]),
            expectedAssessments: expect.arrayContaining(["misconception_check", "transfer_challenge"])
          })
        ])
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course",
        language: "zh-CN"
      },
      contentBlueprint: {
        version: "content-blueprint/v1",
        units: expect.arrayContaining([
          expect.objectContaining({
            unitId: "unit-overview",
            lessonId: "context-blog-overview",
            targetPageCount: 8,
            sourceRequirement: expect.stringContaining("sourceAnchorIds"),
            pageBlueprints: expect.arrayContaining([
              expect.objectContaining({
                pageNumber: 1,
                pageType: "problem_scene",
                learnerAction: expect.stringContaining("判断")
              }),
              expect.objectContaining({
                pageType: "interactive_model",
                feedbackRequirement: expect.stringContaining("因果")
              }),
              expect.objectContaining({
                pageType: "transfer_challenge",
                mustInclude: expect.arrayContaining([expect.stringContaining("迁移")])
              })
            ])
          })
        ])
      }
    });
    expect(context.codexInstruction).toContain("请由 Codex 创作 coursePack 和 lessons");
    expect(context.codexInstruction).toContain("learning_agent.publish_learning_course");
    expect(context.codexInstruction).toContain("contentBlueprint.units[*].pageBlueprints");
    expect(context.source.anchors.length).toBeLessThanOrEqual(4);
    expect(context.qualityContract).toMatchObject({
      language: "zh-CN",
      requiredPageTypes: expect.arrayContaining(["problem_scene", "interactive_model", "quiz", "misconception_check", "transfer_challenge"]),
      requiredLearningActions: expect.arrayContaining(["predict", "manipulate", "explain", "transfer"]),
      sourceKindGuidance: expect.objectContaining({
        sourceKind: "blog"
      }),
      supportedStrategies: expect.arrayContaining(["overview_plus_topic", "chapter_guided", "topic_guided", "task_guided", "hybrid"])
    });
    expect(context.qualityContract.feedbackRules.join("\n")).toContain("为什么");
    expect(context.qualityContract.groundingRules.join("\n")).toContain("sourceAnchorIds");
    expect(context.learnerClarificationHints).toEqual(
      expect.arrayContaining([expect.stringContaining("学习目标"), expect.stringContaining("课程组织")])
    );
    expect(context.artifacts).toMatchObject({
      coursePlanPath: expect.stringContaining("course-plan"),
      unitPlanPath: expect.stringContaining("unit-plan"),
      authoringContextPath: expect.stringContaining("authoring-context")
    });
    await expect(readFile(context.artifacts.coursePlanPath, "utf8")).resolves.toContain("acceptanceExpectations");
    await expect(readFile(context.artifacts.unitPlanPath, "utf8")).resolves.toContain("expectedInteractions");
    await expect(readFile(context.artifacts.authoringContextPath, "utf8")).resolves.toContain("content-blueprint/v1");
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
    expect(context.qualityContract.sourceKindGuidance.sourceKind).toBe("topic");
    expect(context.qualityContract.sourceKindGuidance.authoringFocus.join("\n")).toContain("心智模型");
    expect(context.contentBlueprint.units[0]?.pageBlueprints[0]?.sourceRequirement).toContain("不要伪造 sourceAnchorIds");
  });

  test("samples long book anchors from content pages instead of front matter", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-"));
    const sourcePath = path.join(root, "agentic-book.md");
    await writeFile(
      sourcePath,
      [
        "# Table of Contents",
        "Agentic Design Patterns Table of Contents total 424 pages Dedication Acknowledgment Foreword.",
        "# Dedication",
        "To my son Bruno and family.",
        "# Acknowledgment",
        "Thanks to reviewers and friends.",
        "# Preface",
        "Agentic systems evolve from reactive programs to autonomous systems.",
        "# What makes an AI system an Agent?",
        "An agent perceives its environment and takes actions to achieve a goal.",
        "# Why Patterns Matter in Agent Development",
        "Patterns help designers address state, tool use, communication, and feedback challenges.",
        "# Tool Use",
        "Tool use connects reasoning to external APIs and observable actions."
      ].join("\n\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 这本书生成中文互动学习网页，面向中文学习者，每个单元 4 页，先总览再按核心 topic 拆课。`,
      runId: "context-long-book",
      sourcePath,
      sourceKind: "book",
      audience: "中文学习者",
      unitPages: 4,
      strategy: "overview_plus_topic",
      selectedTopics: ["tool use"]
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "context-long-book", maxAnchors: 4 });
    const quoteText = context.source.anchors.map((anchor) => anchor.quote ?? anchor.label).join("\n");

    expect(context.source.anchors).toHaveLength(4);
    expect(context.source.anchors[0]?.quote).toMatch(/Tool use/iu);
    expect(quoteText).toContain("Patterns help designers");
    expect(quoteText).not.toContain("Table of Contents total 424 pages");
    expect(context.coursePlan.recommendedUnits[0]?.sourceAnchorIds).toContain(context.source.anchors[0]?.anchorId);
    expect(context.contentBlueprint.units[0]?.sourceAnchorIds).toContain(context.source.anchors[0]?.anchorId);
  });

  test.each([
    ["book", "章节映射"],
    ["paper", "研究问题"],
    ["patent", "权利要求"],
    ["blog", "实现模式"],
    ["notes", "用户原始结构"]
  ])("adds source-kind guidance for %s projects", async (sourceKind, expectedFocus) => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-"));
    await new LearnerProjectService(root).createProject({
      request: `请生成 ${sourceKind} 中文互动学习网页，面向中文学习者，每个单元 8 页。`,
      runId: `context-${sourceKind}`,
      sourceKind,
      audience: "中文学习者",
      unitPages: 8
    });

    const context = await new AuthoringContextService(root).getContext({ runId: `context-${sourceKind}` });

    expect(context.qualityContract.sourceKindGuidance).toMatchObject({
      sourceKind,
      authoringFocus: expect.arrayContaining([expect.stringContaining(expectedFocus)])
    });
  });
});
