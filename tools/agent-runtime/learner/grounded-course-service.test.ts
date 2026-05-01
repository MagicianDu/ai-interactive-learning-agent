import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { LearnerProjectService } from "./learner-project-service.js";
import { LearningRevisionService } from "./learning-revision-service.js";
import { GroundedCourseService } from "./grounded-course-service.js";

describe("GroundedCourseService", () => {
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
      request: `请用 "${sourcePath}" 这本书生成中文课程：先给总览课，再按核心 topic 拆课。每个单元 8 页，面向有编程基础但缺少智能体系统心智模型的中文学习者。`,
      runId: "grounded-agent",
      sourcePath,
      sourceKind: "book",
      audience: "有编程基础但缺少智能体系统心智模型的中文学习者",
      unitPages: 8,
      strategy: "hybrid",
      selectedTopics: ["工具使用", "多智能体审核"]
    });

    const result = await new GroundedCourseService(root).generate({ runId: "grounded-agent" });

    expect(result).toMatchObject({
      status: "preview_ready",
      runId: "grounded-agent",
      coursePackId: "grounded-agent",
      sourceIngest: {
        anchorCount: expect.any(Number),
        warningCount: 0
      },
      quality: {
        checkedLessons: 2,
        blockingIssueCount: 0
      },
      criticReports: [expect.objectContaining({ status: "passed" }), expect.objectContaining({ status: "passed" })]
    });
    expect(result.sourceIngest.anchorCount).toBeGreaterThanOrEqual(3);
    await expect(readFile(result.sourceIngest.artifactPath, "utf8")).resolves.toContain("candidateInteractions");
    const lessonText = await readFile(path.join(root, "src", "lessons", "grounded-agent-overview", "lesson.ts"), "utf8");
    expect(lessonText).toContain("sourceContext");
    expect(lessonText).toContain("sourceAnchorIds");
    expect(lessonText).toContain("工具使用");
    await expect(readFile(path.join(root, "src", "lessons", "grounded-agent-topic-01", "lesson.ts"), "utf8")).resolves.toContain(
      "多智能体审核"
    );
  });

  test("applies the latest learner feedback when regenerating a grounded course", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "grounded-course-feedback-"));
    const sourcePath = path.join(root, "rag-notes.md");
    await writeFile(sourcePath, "# Agentic RAG\nAgentic RAG 会先判断任务，再选择检索、工具或生成路径。", "utf8");
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 这篇博客生成中文学习网页，面向中文学习者，每个单元 8 页。`,
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
      revisionApplied: {
        revisionId: "revision-001",
        feedback: "太难了，请降低术语密度，并增加一个新手友好的行动提示。"
      }
    });
    const lessonText = await readFile(path.join(root, "src", "lessons", "grounded-rag-overview", "lesson.ts"), "utf8");
    expect(lessonText).toContain("已根据最新反馈降低术语密度");
    expect(lessonText).toContain("新手行动提示");
  });
});
