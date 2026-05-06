import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { LearnerProjectService } from "./learner-project-service.js";
import { LearningRevisionService } from "./learning-revision-service.js";
import { GroundedCourseService } from "./grounded-course-service.js";

describe("GroundedCourseService", () => {
  test("adapts generated lesson content to the requested teaching difficulty", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "grounded-course-difficulty-"));
    const sourcePath = path.join(root, "systems-notes.md");
    await writeFile(
      sourcePath,
      [
        "# 控制型智能体",
        "控制型智能体会把目标、状态、策略和反馈环连接起来。",
        "## 状态建模",
        "状态建模需要区分可观察信号、隐藏变量和决策约束。",
        "## 策略评估",
        "策略评估要比较收益、风险、可解释性和失效边界。"
      ].join("\n"),
      "utf8"
    );

    const levels = [
      {
        runId: "difficulty-intro",
        text: "教学难度为入门衔接",
        expected: ["入门衔接", "先用具体例子", "少术语"]
      },
      {
        runId: "difficulty-undergrad",
        text: "教学难度为本科核心课程",
        expected: ["本科核心课程", "核心概念", "标准判断"]
      },
      {
        runId: "difficulty-graduate",
        text: "教学难度为大学高年级/研究生课程",
        expected: ["大学高年级/研究生课程", "先修概念", "课后作业"]
      },
      {
        runId: "difficulty-research",
        text: "教学难度为研究论文精读/前沿讨论",
        expected: ["研究论文精读/前沿讨论", "研究问题", "证据链", "局限边界"]
      }
    ] as const;

    for (const level of levels) {
      await new LearnerProjectService(root).createProject({
        request: `请用 "${sourcePath}" 生成中文学习网页，面向有工程背景的中文学习者，${level.text}，每个单元 8 页。`,
        runId: level.runId,
        sourcePath,
        sourceKind: "notes",
        audience: "有工程背景的中文学习者",
        unitPages: 8,
        strategy: "overview_plus_topic"
      });

      const result = await new GroundedCourseService(root).generate({ runId: level.runId });
      expect(result.status).toBe("preview_ready");
      const lessonText = await readFile(path.join(root, "runs", level.runId, "preview", "lessons", `${level.runId}-overview.json`), "utf8");
      for (const phrase of level.expected) {
        expect(lessonText).toContain(phrase);
      }
    }
  });

  test("generates a source-grounded Chinese course bundle from a learner project", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "grounded-course-"));
    const sourcePath = path.join(root, "agent-notes.md");
    await writeFile(
      sourcePath,
      [
        "# 第一章 智能体系统",
        "智能体系统需要围绕目标进行观察、计划、行动和反馈。",
        "## 工具使用",
        "工具调用会扩大动作空间，但每次调用后都要验证结果。",
        "## 多智能体审核",
        "多智能体协作适合边界清晰、产物可审核的复杂任务。"
      ].join("\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 这本书生成中文课程：先给总览课，再按核心 topic 拆课。教学难度为大学高年级/研究生课程，每个单元 8 页，面向有编程基础但缺少智能体系统心智模型的中文学习者。`,
      runId: "grounded-agent",
      sourcePath,
      sourceKind: "book",
      audience: "有编程基础但缺少智能体系统心智模型的中文学习者",
      unitPages: 8,
      strategy: "hybrid",
      selectedTopics: ["工具使用", "多智能体审核"]
    });

    const result = await new GroundedCourseService(root).generate({ runId: "grounded-agent" });

    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") {
      throw new Error("expected grounded course preview to be ready");
    }
    expect(result).toMatchObject({
      runId: "grounded-agent",
      coursePackId: "grounded-agent",
      outputMode: "preview",
      sourceIngest: {
        anchorCount: expect.any(Number),
        warningCount: 0
      },
      sourceGraph: {
        status: "passed",
        sourceKind: "book",
        sourceUnitCount: expect.any(Number),
        conceptCount: expect.any(Number),
        misconceptionCount: expect.any(Number),
        candidateInteractionCount: expect.any(Number)
      },
      sourceEvidence: {
        status: "passed",
        unsupportedPages: 0
      },
      quality: {
        blockingIssueCount: 0
      },
      qualityReport: {
        status: "passed",
        checks: {
          sourceEvidence: "passed",
          chineseFirst: "passed"
        }
      }
    });
    expect(result.preview.instructions.join("\n")).toContain("npm run dev");
    expect(result.preview.localUrl).toContain("#/preview/grounded-agent");
    expect(result.lessonPaths.length).toBeGreaterThanOrEqual(3);
    expect(result.quality.checkedLessons).toBeGreaterThanOrEqual(3);
    expect(result.criticReports.length).toBe(result.lessonPaths.length);
    expect(result.criticReports.every((report) => report.status === "passed")).toBe(true);
    expect(result.criticReports.every((report) => report.sourceEvidence.status === "passed")).toBe(true);
    expect(result.criticReports.flatMap((report) => report.pageScores).every((score) => score.sourceSupport === "supported")).toBe(true);
    expect(result.sourceIngest.anchorCount).toBeGreaterThanOrEqual(3);
    expect(result.sourceGraph.sourceUnitCount).toBeGreaterThanOrEqual(3);
    expect(result.sourceGraph.conceptCount).toBeGreaterThanOrEqual(5);
    expect(result.sourceGraph.misconceptionCount).toBeGreaterThanOrEqual(2);
    expect(result.sourceGraph.candidateInteractionCount).toBeGreaterThanOrEqual(2);
    await expect(readFile(result.sourceIngest.artifactPath, "utf8")).resolves.toContain("candidateInteractions");
    await expect(readFile(result.sourceGraph.graphPath, "utf8")).resolves.toContain("\"sourceKind\": \"book\"");
    await expect(readFile(result.sourceGraph.anchorsPath, "utf8")).resolves.toContain("sourceAnchorIds");
    await expect(readFile(result.sourceGraph.conceptsPath, "utf8")).resolves.toContain("\"concepts\"");
    await expect(readFile(result.sourceGraph.coveragePath, "utf8")).resolves.toContain("\"sourceUnitCount\"");
    await expect(readFile(result.qualityReport.reportPath, "utf8")).resolves.toContain("\"coursePackId\": \"grounded-agent\"");
    const coursePack = JSON.parse(await readFile(result.coursePackPath, "utf8")) as { units: Array<{ unitId: string; lessonId?: string }> };
    const unitIds = coursePack.units.map((unit) => unit.unitId);
    expect(unitIds).toContain("unit-overview");
    expect(coursePack.units.filter((unit) => unit.lessonId).length).toBeGreaterThanOrEqual(3);
    const lessonText = await readFile(path.join(root, "runs", "grounded-agent", "preview", "lessons", "grounded-agent-overview.json"), "utf8");
    expect(lessonText).toContain("sourceContext");
    expect(lessonText).toContain("sourceAnchorIds");
    expect(lessonText).toContain("工具使用");
    const generatedLessonTexts = await Promise.all(result.lessonPaths.map((lessonPath) => readFile(lessonPath, "utf8")));
    expect(generatedLessonTexts.join("\n")).toContain("多智能体审核");
  });

  test("applies the latest learner feedback when regenerating a grounded course", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "grounded-course-feedback-"));
    const sourcePath = path.join(root, "rag-notes.md");
    await writeFile(sourcePath, "# Agentic RAG\nAgentic RAG 会先判断任务，再选择检索、工具或生成路径。", "utf8");
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 这篇博客生成中文学习网页，面向中文学习者，教学难度为入门衔接，每个单元 8 页。`,
      runId: "grounded-rag",
      sourcePath,
      sourceKind: "blog",
      audience: "中文学习者",
      unitPages: 8,
      strategy: "task_guided",
      selectedTopics: ["任务判断", "工具选择"]
    });
    await new GroundedCourseService(root).generate({ runId: "grounded-rag" });
    await new LearningRevisionService(root).requestRevision({
      runId: "grounded-rag",
      feedback: "太难了，请降低术语密度，并增加一个新手友好的行动提示。",
      focus: "difficulty"
    });

    const revised = await new GroundedCourseService(root).generate({ runId: "grounded-rag" });

    expect(revised).toMatchObject({
      status: "preview_ready",
      outputMode: "preview",
      revisionApplied: {
        revisionId: "revision-001",
        feedback: "太难了，请降低术语密度，并增加一个新手友好的行动提示。"
      }
    });
    const lessonText = await readFile(path.join(root, "runs", "grounded-rag", "preview", "lessons", "grounded-rag-overview.json"), "utf8");
    expect(lessonText).toContain("已根据最新反馈降低术语密度");
    expect(lessonText).toContain("新手行动提示");
  });
});
