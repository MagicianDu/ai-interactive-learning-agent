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
      expect.arrayContaining([expect.stringContaining("资料路径"), expect.stringContaining("面向谁"), expect.stringContaining("难度层级")])
    );
  });

  test("asks for teaching difficulty when source and audience are present but level is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向有编程基础的学习者，每个单元 8 页。"
    });

    expect(result.status).toBe("clarification_required");
    if (result.status !== "clarification_required") {
      throw new Error("expected clarification_required");
    }
    expect(result.clarificationQuestions).toEqual([
      expect.stringContaining("教学内容难度层级")
    ]);
    expect(result.clarificationQuestions[0]).toContain("入门");
    expect(result.clarificationQuestions[0]).toContain("本科");
    expect(result.clarificationQuestions[0]).toContain("研究生");
  });

  test("asks for unit pages when source audience and teaching difficulty are present but page count is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向有编程基础的学习者，教学难度定位为大学高年级/研究生课程。"
    });

    expect(result.status).toBe("clarification_required");
    if (result.status !== "clarification_required") {
      throw new Error("expected clarification_required");
    }
    expect(result.clarificationQuestions).toEqual([
      expect.stringContaining("每个单元")
    ]);
    expect(result.clarificationQuestions[0]).toContain("页");
  });

  test("writes a ready learner brief for a complete request", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request:
        "请用 /tmp/book.pdf 生成中文学习材料，面向有编程基础的学习者，教学难度定位为大学高年级/研究生课程，每个单元 8 页，先总览再按核心 topic 拆课。",
      runId: "book-run"
    });

    expect(result).toMatchObject({
      status: "project_ready",
      runId: "book-run",
      brief: {
        sourcePath: "/tmp/book.pdf",
        audience: "有编程基础的学习者",
        difficultyLevel: "upper_undergraduate_or_graduate",
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
    expect(result.next.codexInstruction).toContain("教学难度");
    expect(result.next.codexInstruction).toContain("大学高年级/研究生课程");
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
    expect(JSON.stringify(manifest.brief)).toContain("upper_undergraduate_or_graduate");
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
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向有编程基础的学习者，难度为本科核心课程，每个单元 8 页，按章节推进。",
      runId: "chapter-run",
      strategy: "chapter_guided",
      selectedChapters: ["第 1 章", "第 3 章"],
      selectedTopics: ["planning", "tool use"]
    });

    expect(result).toMatchObject({
      status: "project_ready",
      brief: {
        strategy: "chapter_guided",
        difficultyLevel: "undergraduate_core",
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
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向中文学习者，难度为大学高年级课程，每个单元 8 页，按章节推进。第 1 章，第 2 章优先。"
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
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向中文学习者，教学难度=research，每个单元 8 页，strategy=topic_guided。"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.brief).toMatchObject({
      strategy: "topic_guided",
      difficultyLevel: "research"
    });
  });

  test("records professor lecture deck intent from explicit input and natural language", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request:
        "请用 /tmp/book.pdf 生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织，面向有基础的学习者，教学难度为大学高年级/研究生课程，每个单元 10 页。",
      runId: "professor-deck"
    });

    expect(result).toMatchObject({
      status: "project_ready",
      brief: {
        courseIntent: "professor_lecture_deck",
        unitPages: 10
      }
    });
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.next.codexInstruction).toContain("教师/课堂 Web Deck");
    const manifest = JSON.parse(await readFile(path.join(root, "runs", "professor-deck", "learner-project.json"), "utf8")) as {
      brief: { courseIntent?: string };
      project?: { courseIntent?: string };
    };
    expect(manifest.brief.courseIntent).toBe("professor_lecture_deck");
    expect(manifest.project?.courseIntent).toBe("professor_lecture_deck");
  });

  test("keeps mental model intent as the default", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request:
        "请用 /tmp/book.pdf 生成中文互动学习材料，面向有基础的学习者，教学难度为本科核心课程，每个单元 8 页。"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.brief.courseIntent).toBe("build_mental_model");
  });

  test("uses default total pages for self-study textbook book projects and reminds the learner", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request:
        "请用 /tmp/book.pdf 做成学生自学 Web 教材，我不想读完整本书，面向有基础的学习者，教学难度为大学高年级/研究生课程。",
      runId: "self-study-default"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.brief).toMatchObject({
      courseIntent: "student_self_study_textbook",
      sourceKind: "book",
      unitPages: 10,
      unitPagesSpecified: false,
      targetTotalPages: 100,
      totalPagesSpecified: false
    });
    expect(result.next.codexInstruction).toContain("默认约 100 页");
  });

  test("preserves explicit total pages for self-study textbook projects", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learner-project-"));
    const service = new LearnerProjectService(root);

    const result = await service.createProject({
      request:
        "请用 /tmp/book.pdf 做成学生自学 Web 教材，总共 80 页，每个单元 8 页，面向有基础的学习者，教学难度为大学高年级/研究生课程。",
      runId: "self-study-explicit"
    });

    expect(result.status).toBe("project_ready");
    if (result.status !== "project_ready") {
      throw new Error("expected project_ready");
    }
    expect(result.brief).toMatchObject({
      courseIntent: "student_self_study_textbook",
      unitPages: 8,
      targetTotalPages: 80,
      totalPagesSpecified: true
    });
    expect(result.next.codexInstruction).toContain("总页数约 80 页");
    const manifest = JSON.parse(await readFile(path.join(root, "runs", "self-study-explicit", "learner-project.json"), "utf8")) as {
      brief?: { targetTotalPages?: number };
      project?: { targetTotalPages?: number };
    };
    expect(manifest.brief?.targetTotalPages).toBe(80);
    expect(manifest.project?.targetTotalPages).toBe(80);
  });
});
