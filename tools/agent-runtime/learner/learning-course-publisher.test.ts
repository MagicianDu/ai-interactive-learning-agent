import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ArtifactStore } from "../artifact-store.js";
import { professorBoardLessonFixture, publishableLessonFixture } from "../quality/test-fixtures.js";
import { isRecord } from "../quality/validation-result.js";
import { LearnerProjectService } from "./learner-project-service.js";
import { LearningCoursePublisher } from "./learning-course-publisher.js";

describe("LearningCoursePublisher", () => {
  test("publishes a Codex-authored course bundle into the clean preview runtime by default", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const lesson = publishableLessonFixture({ id: "hash-table-overview", title: "哈希表：总览课", targetPageCount: 8 });
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "hash-course",
      lessons: [lesson],
      coursePack: {
        id: "hash-course",
        title: "哈希表：课程包",
        parentRunId: "hash-course",
        sourceKind: "topic",
        strategy: "overview_plus_topic",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "hash-table-overview",
            targetPageCount: 8,
            conceptIds: ["hash-table"]
          }
        ]
      }
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      coursePackId: "hash-course",
      outputMode: "preview",
      qualityReport: {
        status: "passed",
        score: 100,
        requiredFixCount: 0
      },
      publishValidation: {
        status: "passed",
        issueCount: 0,
        errorCount: 0,
        warningCount: 0
      },
      quality: { checkedLessons: 1, blockingIssueCount: 0 }
    });
    if (result.status !== "preview_ready") {
      throw new Error("expected preview_ready");
    }
    expect(result.coursePackPath).toBe(path.join(root, "runs", "hash-course", "preview", "course-pack.json"));
    expect(result.lessonPaths).toEqual([path.join(root, "runs", "hash-course", "preview", "lessons", "hash-table-overview.json")]);
    await expect(readFile(result.coursePackPath, "utf8")).resolves.toContain("\"id\": \"hash-course\"");
    await expect(readFile(result.lessonPaths[0] as string, "utf8")).resolves.toContain("\"id\": \"hash-table-overview\"");
    await expect(readFile(result.lessonPaths[0] as string, "utf8")).resolves.toContain(
      "/__learning-preview/test-course/images/test-lesson/p1-imagegen-v1.png"
    );
    await expect(readFile(result.lessonPaths[0] as string, "utf8")).resolves.not.toContain(".svg");
    await expect(readFile(path.join(root, "runs", "hash-course", "preview", "images", "hash-table-overview", "p1.svg"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(path.join(root, "runs", "hash-course", "preview", "manifest.json"), "utf8")).resolves.toContain(
      "\"coursePackPath\": \"course-pack.json\""
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "learning-preview.json"), "utf8")).resolves.toContain(
      "#/preview/hash-course"
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "quality", "course-quality-report.json"), "utf8")).resolves.toContain(
      "\"status\": \"passed\""
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "artifacts", "course-ir.v1.json"), "utf8")).resolves.toContain(
      "\"irVersion\": \"course-ir/v1\""
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "artifacts", "lesson-bundle.v1.json"), "utf8")).resolves.toContain(
      "\"lessons\""
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "artifacts", "publish-validation.v1.json"), "utf8")).resolves.toContain(
      "\"status\": \"passed\""
    );
    await expect(readFile(path.join(root, "src", "lessons", "hash-table-overview", "lesson.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(path.join(root, "src", "course-packs", "hash-course", "coursePack.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("returns revision_required when a visual page lacks an imagegen teaching asset", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-imagegen-"));
    const lesson = publishableLessonFixture({ id: "missing-imagegen", title: "缺少图片生成资产", targetPageCount: 8 });
    const pages = lesson.pages.map((page) => {
      if (!isRecord(page.visualSpec)) {
        return page;
      }
      return {
        ...page,
        visualSpec: {
          kind: page.visualSpec.kind,
          description: page.visualSpec.description,
          keyElements: page.visualSpec.keyElements
        }
      };
    });
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "missing-imagegen-course",
      lessons: [{ ...lesson, pages }],
      coursePack: coursePackFixture("missing-imagegen-course", "missing-imagegen")
    });

    expect(result.status).toBe("revision_required");
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "publish.page.imagegen-asset-missing",
          message: expect.stringContaining("imagegen")
        })
      ])
    );
    await expect(readFile(path.join(root, "runs", "missing-imagegen-course", "preview", "images", "missing-imagegen", "p1.svg"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("can explicitly publish maintainer TypeScript fixtures when requested", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-source-"));
    const lesson = publishableLessonFixture({ id: "hash-table-overview", title: "哈希表：总览课", targetPageCount: 8 });
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "hash-source",
      outputMode: "source",
      lessons: [lesson],
      coursePack: coursePackFixture("hash-source", "hash-table-overview")
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      coursePackId: "hash-source",
      outputMode: "source"
    });
    await expect(readFile(path.join(root, "src", "lessons", "hash-table-overview", "lesson.ts"), "utf8")).resolves.toContain(
      "generatedLesson"
    );
    await expect(readFile(path.join(root, "src", "course-packs", "hash-source", "coursePack.ts"), "utf8")).resolves.toContain(
      "generatedCoursePack"
    );
  });

  test("threads learner project sourceKind into paper research quality checks", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-paper-quality-"));
    await new LearnerProjectService(root).createProject({
      request: "请生成一篇论文的中文研究生精读课，面向研究生，教学难度为研究论文精读，每个单元 8 页。",
      runId: "paper-quality",
      sourceKind: "paper",
      audience: "研究生",
      difficultyLevel: "research",
      unitPages: 8
    });
    const lesson = publishableLessonFixture({ id: "paper-quality-overview", title: "论文精读：总览课", targetPageCount: 8 });
    const result = await new LearningCoursePublisher(root).publish({
      runId: "paper-quality",
      lessons: [lesson],
      coursePack: {
        id: "paper-quality",
        title: "论文精读：课程包",
        parentRunId: "paper-quality",
        sourceKind: "paper",
        strategy: "overview_plus_topic",
        units: [
          {
            unitId: "unit-overview",
            title: "论文精读：总览课",
            kind: "overview",
            lessonId: "paper-quality-overview",
            targetPageCount: 8,
            conceptIds: ["paper-reading"]
          }
        ]
      }
    });

    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") {
      return;
    }
    expect(result.qualityReport).toMatchObject({
      status: "warning",
      topIssues: expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.lesson.paper-research-depth-shallow",
          lessonId: "paper-quality-overview"
        })
      ])
    });
  });

  test("returns revision_required when the Codex-authored lesson is not Chinese-first", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const lesson = {
      ...publishableLessonFixture({ id: "english-lesson", title: "Hash tables", targetPageCount: 8 }),
      audience: "English learners",
      learningObjectives: ["Explain hash table access paths"],
      summary: ["Hash tables reduce search space."]
    };
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "english-course",
      lessons: [lesson],
      coursePack: coursePackFixture("english-course", "english-lesson")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "english-course",
      qualityReport: {
        status: "failed",
        checks: {
          chineseFirst: "failed"
        }
      },
      userMessage: "课程还不能发布：需要 Codex 先修订中文学习内容和质量问题。"
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues.some((issue) => issue.rule === "chinese-first")).toBe(true);
  });

  test("returns revision_required when publish validation finds malformed authored pages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-validation-"));
    const lesson = {
      ...publishableLessonFixture({ id: "bad-page-lesson", title: "坏页面课程", targetPageCount: 8 }),
      pages: [
        {
          ...publishableLessonFixture({ id: "bad-page-lesson", title: "坏页面课程", targetPageCount: 8 }).pages[0],
          learningGoal: ""
        }
      ]
    };
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "bad-page-course",
      lessons: [lesson],
      coursePack: coursePackFixture("bad-page-course", "bad-page-lesson")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "bad-page-course",
      qualityReport: {
        status: "failed"
      },
      publishValidation: {
        status: "failed",
        issueCount: 1,
        errorCount: 1
      }
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "publish.page.learning-goal-missing",
          message: expect.stringContaining("Set page.learningGoal")
        })
      ])
    );
    await expect(readFile(path.join(root, "runs", "bad-page-course", "artifacts", "publish-validation.v1.json"), "utf8")).resolves.toContain(
      "\"status\": \"failed\""
    );
  });

  test("requires source grounding when publishing a source-backed learner project", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const sourcePath = path.join(root, "source.pdf");
    const publisher = new LearningCoursePublisher(root);
    await new LearnerProjectService(root).createProject({
      request: `请用 ${sourcePath} 这本书生成中文学习材料，面向有编程基础的学习者，教学难度为大学高年级/研究生课程，每个单元 8 页。`,
      runId: "source-course"
    });

    const ungrounded = await publisher.publish({
      runId: "source-course",
      lessons: [publishableLessonFixture({ id: "source-lesson", title: "资料总览课", targetPageCount: 8 })],
      coursePack: coursePackFixture("source-course", "source-lesson")
    });

    expect(ungrounded).toMatchObject({ status: "revision_required", runId: "source-course" });
    if (ungrounded.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(ungrounded.issues.some((issue) => issue.rule === "source-grounding")).toBe(true);

    const groundedLesson = {
      ...publishableLessonFixture({ id: "source-lesson", title: "资料总览课", targetPageCount: 8 }),
      sourceContext: {
        sourceAnchorIds: ["source-001:page-1"],
        sourcePath
      },
      pages: publishableLessonFixture({ id: "source-lesson", title: "资料总览课", targetPageCount: 8 }).pages.map((page) => ({
        ...page,
        sourceAnchorIds: ["source-001:page-1"]
      }))
    };

    const grounded = await publisher.publish({
      runId: "source-course",
      lessons: [groundedLesson],
      coursePack: coursePackFixture("source-course", "source-lesson", ["source-001:page-1"])
    });

    expect(grounded).toMatchObject({
      status: "preview_ready",
      coursePackId: "source-course"
    });
  });

  test("returns revision_required when a persisted content blueprint detects authored page drift", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-blueprint-"));
    const publisher = new LearningCoursePublisher(root);
    const lesson = blueprintCompliantLessonFixture();
    const driftedLesson = {
      ...lesson,
      pages: lesson.pages.map((page, index) => {
        if (index === 1) {
          return { ...page, type: "structure_diagram" };
        }
        if (index === 2) {
          return { ...page, type: "intuition_visual" };
        }
        return page;
      })
    };
    await new ArtifactStore(path.join(root, "runs", "blueprint-course")).writeDraft("authoring-context", {
      artifactId: "authoring-context",
      roleId: "learning-architecture",
      runId: "blueprint-course",
      contentBlueprint: contentBlueprintFixture()
    });

    const result = await publisher.publish({
      runId: "blueprint-course",
      lessons: [driftedLesson],
      coursePack: coursePackFixture("blueprint-course", "hash-lesson")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "blueprint-course",
      qualityReport: {
        status: "passed"
      },
      publishValidation: {
        status: "failed",
        errorCount: 2
      }
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "publish.blueprint.page-type-mismatch",
          message: expect.stringContaining("contentBlueprint")
        })
      ])
    );
    await expect(readFile(path.join(root, "runs", "blueprint-course", "artifacts", "publish-validation.v1.json"), "utf8")).resolves.toContain(
      "publish.blueprint.page-type-mismatch"
    );
  });

  test("uses persisted authoring context to warn about generic Codex-authored pages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-quality-context-"));
    const publisher = new LearningCoursePublisher(root);
    const lesson = publishableLessonFixture({ id: "generic-source-lesson", title: "资料总览课", targetPageCount: 8 });
    lesson.learningObjectives = ["理解资料大意"];
    lesson.pages[0] = {
      ...lesson.pages[0],
      sourceAnchorIds: ["source-001:section-1"],
      title: "核心概念总览",
      learningGoal: "了解整体内容",
      narrative: "本页介绍核心概念，帮助学习者理解资料大意。"
    };
    await new ArtifactStore(path.join(root, "runs", "generic-source-course")).writeDraft("authoring-context", {
      artifactId: "authoring-context",
      roleId: "learning-architecture",
      runId: "generic-source-course",
      brief: {
        difficultyLevel: "upper_undergraduate_or_graduate"
      },
      sourceSemantics: {
        keyTerms: [{ term: "tool feedback" }, { term: "reflection loop" }, { term: "evaluation boundary" }]
      }
    });

    const result = await publisher.publish({
      runId: "generic-source-course",
      lessons: [lesson],
      coursePack: coursePackFixture("generic-source-course", "generic-source-lesson", ["source-001:section-1"])
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      qualityReport: {
        status: "warning",
        issueSummary: {
          byCategory: {
            generic_page: 1,
            source_evidence: 1
          }
        }
      }
    });
    if (result.status !== "preview_ready") {
      throw new Error("expected preview_ready");
    }
    expect(result.qualityReport.topIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.page.generic-source-page",
          pageId: "p1"
        })
      ])
    );
  });

  test("publishes professor lecture decks without blocking only on missing interactions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-professor-"));
    const publisher = new LearningCoursePublisher(root);
    const lesson = professorBoardLessonFixture({ id: "professor-lecture-overview", title: "Agent 编排：教授讲义", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      narrative:
        index === 0
          ? "本讲定位：核心问题和覆盖边界。"
          : index === 1
            ? "先修要求：需要理解基本 agent、prompt 和工具调用。"
          : index === 2
              ? "知识节点：方法谱系、理论结构、关键定义和正式术语。"
          : index === 3
                ? "关键链路：从输入状态到工具调用，再到观察和评估。经典例题：用一个 agent orchestration case analysis 展开推导。"
          : index === 4
                  ? "方法比较：taxonomy、权衡、适用边界和反例。"
          : index === 5
                    ? "边界案例：相邻场景、保留条件和断裂条件。"
          : index === 6
                      ? "应用案例：具体场景和判断依据。"
                      : "总结图：三条总结要点和下一单元衔接。"
    }));
    await new LearnerProjectService(root).createProject({
      request: "请生成教授式课程讲义 Web Deck，主题是 Agent 编排，面向研究生，教学难度为大学高年级/研究生课程，每个单元 8 页。",
      runId: "professor-course",
      sourceKind: "topic",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      courseIntent: "professor_lecture_deck"
    });
    await expect(readFile(path.join(root, "runs", "professor-course", "learner-project.json"), "utf8")).resolves.toContain(
      "\"courseIntent\": \"professor_lecture_deck\""
    );

    const result = await publisher.publish({
      runId: "professor-course",
      lessons: [lesson],
      coursePack: coursePackFixture("professor-course", "professor-lecture-overview")
    });

    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") {
      expect(result.issues.map((issue) => issue.rule)).not.toContain("interaction-count");
      throw new Error("expected preview_ready");
    }
    expect(result.qualityReport).toMatchObject({
      checks: {
        interactionQuality: "passed",
        professorLecture: "passed"
      }
    });
    expect(result.qualityReport.topIssues.map((issue) => issue.issueId)).not.toContain("quality.lesson.interaction-count");
    await expect(readFile(path.join(root, "runs", "professor-course", "quality", "course-quality-report.json"), "utf8")).resolves.toContain(
      "\"professorLecture\": \"passed\""
    );
    await expect(readFile(path.join(root, "runs", "professor-course", "quality", "course-quality-report.json"), "utf8")).resolves.not.toContain(
      "interaction-count"
    );
  });

  test("returns revision_required when professor lecture decks omit page knowledge boards", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-professor-board-"));
    const publisher = new LearningCoursePublisher(root);
    await new LearnerProjectService(root).createProject({
      request: "请生成教授式课程讲义 Web Deck，主题是 Agent 编排，面向研究生，每个单元 8 页。",
      runId: "professor-board-course",
      sourceKind: "topic",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      courseIntent: "professor_lecture_deck"
    });

    const result = await publisher.publish({
      runId: "professor-board-course",
      lessons: [publishableLessonFixture({ id: "professor-board-overview", title: "Agent 编排：教授讲义", targetPageCount: 8 })],
      coursePack: coursePackFixture("professor-board-course", "professor-board-overview")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "professor-board-course",
      qualityReport: {
        status: "failed",
        checks: {
          professorLecture: "failed"
        }
      }
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: "professor-board-overview",
          rule: "knowledge-board",
          message: expect.stringContaining("knowledgeBoard")
        })
      ])
    );
    await expect(readFile(path.join(root, "runs", "professor-board-course", "quality", "course-quality-report.json"), "utf8")).resolves.toContain(
      "quality.knowledge-board.missing"
    );
  });

  test("publishes student self-study textbooks without requiring quiz or interaction pages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-self-study-"));
    const publisher = new LearningCoursePublisher(root);
    await new LearnerProjectService(root).createProject({
      request: "请生成学生自学 Web 教材，主题是 Agent workflow，面向研究生自学者，默认总页数即可。",
      runId: "self-study-course",
      sourceKind: "topic",
      audience: "研究生自学者",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      courseIntent: "student_self_study_textbook"
    });

    const result = await publisher.publish({
      runId: "self-study-course",
      lessons: [selfStudyTextbookLessonFixture("self-study-overview")],
      coursePack: coursePackFixture("self-study-course", "self-study-overview")
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      qualityReport: {
        status: "passed",
        checks: {
          interactionQuality: "passed",
          assessmentCoverage: "passed",
          transferCoverage: "passed",
          selfStudyTextbook: "passed"
        }
      }
    });
  });

  test("returns revision_required when a student self-study textbook page misses visualSpec", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-self-study-visual-"));
    const publisher = new LearningCoursePublisher(root);
    await new LearnerProjectService(root).createProject({
      request: "请生成学生自学 Web 教材，主题是 Agent workflow，面向研究生自学者，默认总页数即可。",
      runId: "self-study-visual-course",
      sourceKind: "topic",
      audience: "研究生自学者",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      courseIntent: "student_self_study_textbook"
    });
    const lesson = selfStudyTextbookLessonFixture("self-study-visual-overview");
    const pageWithoutVisual = { ...(lesson.pages[2] as Record<string, unknown>) };
    delete pageWithoutVisual.visualSpec;
    lesson.pages[2] = pageWithoutVisual as (typeof lesson.pages)[number];

    const result = await publisher.publish({
      runId: "self-study-visual-course",
      lessons: [lesson],
      coursePack: coursePackFixture("self-study-visual-course", "self-study-visual-overview")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "self-study-visual-course"
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: "self-study-visual-overview",
          rule: "page-visual-required",
          message: expect.stringContaining("visualSpec")
        })
      ])
    );
  });

  test("returns revision_required when student self-study textbooks contain teacher-facing board language", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-self-study-bad-"));
    const publisher = new LearningCoursePublisher(root);
    await new LearnerProjectService(root).createProject({
      request: "请生成学生自学 Web 教材，主题是 Agent workflow，面向研究生自学者。",
      runId: "self-study-bad-course",
      sourceKind: "topic",
      audience: "研究生自学者",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      courseIntent: "student_self_study_textbook"
    });
    const lesson = selfStudyTextbookLessonFixture("self-study-bad-overview");
    lesson.pages[0] = {
      ...lesson.pages[0],
      knowledgeBoard: {
        ...lesson.pages[0]!.knowledgeBoard,
        headline: "本讲定位：识别本页中的作用"
      }
    };

    const result = await publisher.publish({
      runId: "self-study-bad-course",
      lessons: [lesson],
      coursePack: coursePackFixture("self-study-bad-course", "self-study-bad-overview")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "self-study-bad-course",
      qualityReport: {
        status: "failed",
        checks: {
          selfStudyTextbook: "failed"
        }
      }
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: "self-study-bad-overview",
          rule: "self-study-textbook",
          message: expect.stringContaining("teacher-facing language")
        })
      ])
    );
    await expect(readFile(path.join(root, "runs", "self-study-bad-course", "quality", "course-quality-report.json"), "utf8")).resolves.toContain(
      "quality.self-study-textbook.weak-page"
    );
  });

  test("rejects unsafe lesson and course pack ids before writing files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const publisher = new LearningCoursePublisher(root);

    await expect(
      publisher.publish({
        runId: "unsafe-course",
        lessons: [publishableLessonFixture({ id: "../bad", targetPageCount: 8 })],
        coursePack: coursePackFixture("../bad", "../bad")
      })
    ).rejects.toThrow("id must match");
  });
});

function coursePackFixture(coursePackId: string, lessonId: string, sourceAnchorIds: string[] = []): Record<string, unknown> {
  return {
    id: coursePackId,
    title: "哈希表：课程包",
    parentRunId: coursePackId,
    sourceKind: "topic",
    strategy: "overview_plus_topic",
    units: [
      {
        unitId: "unit-overview",
        title: "哈希表：总览课",
        kind: "overview",
        lessonId,
        targetPageCount: 8,
        sourceAnchorIds,
        conceptIds: ["hash-table"]
      }
    ]
  };
}

function contentBlueprintFixture(): Record<string, unknown> {
  const sourceRequirement = "topic-only 页面必须清楚区分常识、推理和示例；不要伪造 sourceAnchorIds。";
  return {
    version: "content-blueprint/v1",
    globalRules: ["中文优先"],
    units: [
      {
        unitId: "unit-overview",
        lessonId: "hash-lesson",
        title: "哈希表：总览课",
        targetPageCount: 8,
        unitKind: "overview",
        focusConcepts: ["哈希表"],
        sourceAnchorIds: [],
        sourceRequirement,
        pageBlueprints: [
          "problem_scene",
          "intuition_visual",
          "structure_diagram",
          "interactive_model",
          "quiz",
          "misconception_check",
          "transfer_challenge",
          "summary_card"
        ].map((pageType, index) => ({
          pageNumber: index + 1,
          pageType,
          teachingMove: "围绕一个清晰学习目标推进。",
          learnerAction: "让学习者做判断、预测或操作。",
          visualRequirement: "页面需要可见结构。",
          feedbackRequirement: "反馈解释为什么。",
          sourceRequirement,
          mustInclude: ["中文学习目标"]
        }))
      }
    ]
  };
}

function selfStudyTextbookLessonFixture(id: string) {
  const pages = [
    "problem_scene",
    "intuition_visual",
    "structure_diagram",
    "process_animation",
    "code_walkthrough",
    "structure_diagram",
    "misconception_check",
    "summary_card"
  ].map((type, index) => {
    const pageNumber = index + 1;
    const pageRole = ["问题入口", "直觉模型", "机制结构", "过程链路", "正式表达", "概念比较", "误区边界", "复习压缩"][index] ?? `知识节点 ${pageNumber}`;
    return {
      id: `p${pageNumber}`,
      type,
      title: `Agent workflow 自学页 ${pageNumber}`,
      learningGoal: "理解 workflow 把复杂任务拆成可检查步骤。",
      narrative: "本页用中文解释 workflow 的定义、证据链、假设、案例分析和可检查中间状态。",
      visualSpec: {
        kind: type === "process_animation" ? "animation" : type === "code_walkthrough" ? "table" : "diagram",
        description: `${pageRole}对应的核心图示或结构表。`,
        keyElements: ["概念节点", "机制步骤", "证据锚点", "适用边界"],
        states: ["提出问题", "展开机制", "对照证据", "形成可迁移结论"],
        ...imagegenAsset(`self-study-${pageNumber}`)
      },
      sourceAnchorIds: [`book:p${pageNumber}`],
      knowledgeBoard: {
        boardKind: type === "summary_card" ? "synthesis_board" : "mechanism_board",
        headline: `${pageRole}：workflow 自学要抓住什么？`,
        coreProposition: `${pageRole}页要说明的不是同一句定义，而是 workflow 如何在这一层把任务变成可观察、可恢复、可调整的学习对象。`,
        leftColumn: [
          {
            label: `${pageRole}如何拆步骤`,
            items: [
              `定义：${pageRole}把大任务拆成一个可单独检查的知识节点。`,
              `证据链：${pageRole}要求学习者看到中间状态如何暴露偏差。`,
              `失败恢复：${pageRole}说明修正可以从具体步骤开始，而不是重跑整个任务。`
            ]
          }
        ],
        rightColumn: [
          {
            label: "例子与边界",
            items: [
              `案例分析：${pageRole}可对应资料学习流程中的来源采样、章节映射或质量审查。`,
              `适用条件和边界：${pageRole}只在需要中间状态和失败恢复时有价值。`,
              `来源证据支持 workflow pattern 在${pageRole}这一层围绕可组合步骤展开。`
            ]
          }
        ],
        sourceTrace: [{ anchorId: `book:p${pageNumber}`, supports: "来源描述了 workflow pattern 通过拆分步骤组织 agent 行为。" }],
        bottomLine: `自学时要记住：${pageRole}负责把 workflow 的一个独立知识节点讲清楚。`
      }
    };
  });

  return {
    id,
    title: "Agent workflow 自学 Web 教材",
    audience: "研究生自学者",
    config: { targetPageCount: 8, minPageCount: 6, maxPageCount: 12 },
    prerequisites: ["先修：理解基本 LLM 调用"],
    learningObjectives: ["理解 workflow 把复杂任务拆成可检查步骤。"],
    pages,
    misconceptions: [{ id: "m1", statement: "workflow 只是长提示。", correction: "workflow 的关键是中间状态和恢复路径。" }],
    transferTasks: [],
    summary: ["workflow 让复杂任务拥有可检查的中间状态，并要注意迁移边界。"]
  };
}

function blueprintCompliantLessonFixture(): ReturnType<typeof publishableLessonFixture> {
  const base = publishableLessonFixture({ id: "hash-lesson", title: "哈希表：总览课", targetPageCount: 8 });
  const pages = [
    lessonPage("p1", "problem_scene", { visual: true }),
    lessonPage("p2", "intuition_visual", { visual: true }),
    lessonPage("p3", "structure_diagram", { visual: true }),
    lessonPage("p4", "interactive_model", { visual: true, interaction: true }),
    lessonPage("p5", "quiz", { assessment: true }),
    lessonPage("p6", "misconception_check", { assessment: true }),
    lessonPage("p7", "transfer_challenge", { assessment: true, interaction: true }),
    lessonPage("p8", "summary_card", { visual: true })
  ];

  return {
    ...base,
    pages
  };
}

function lessonPage(
  id: string,
  type: string,
  options: { visual?: boolean; interaction?: boolean; assessment?: boolean }
): Record<string, unknown> {
  return {
    id,
    type,
    title: `${id} 中文页`,
    learningGoal: "理解哈希表为什么快，建立可迁移的中文心智模型",
    narrative: "这是一段围绕哈希表访问路径的中文学习内容。",
    ...(options.visual
      ? {
          visualSpec: {
            kind: "diagram",
            description: "中文结构图",
            keyElements: ["键", "桶", "候选范围"],
            ...imagegenAsset(id)
          }
        }
      : {}),
    ...(options.interaction
      ? {
          interactionSpec: {
            kind: "choice",
            learnerAction: "选择访问路径",
            expectedObservation: "看到候选范围变化",
            cognitivePurpose: "理解搜索空间缩小",
            options: [
              {
                id: "indexed",
                label: "选择索引路径",
                resultTitle: "候选范围缩小",
                outcomeId: "indexed",
                resultTone: "success",
                explanation: "因为 key 改变了访问路径。"
              }
            ]
          }
        }
      : {}),
    ...(options.assessment
      ? {
          assessmentSpec: {
            kind: "multiple_choice",
            prompt: "哪种判断更符合哈希表心智模型？",
            options: ["用 key 缩小候选范围", "随机让程序变快"],
            correctAnswer: "用 key 缩小候选范围"
          },
          feedbackSpec: {
            correctFeedback: "正确，因为 key 决定访问路径。",
            incorrectFeedback: "不对，这忽略了搜索空间缩小。"
          }
        }
      : {})
  };
}

function imagegenAsset(id: string): Record<string, string> {
  return {
    imageUrl: `/__learning-preview/test-course/images/test-lesson/${id}-imagegen-v1.png`,
    imageAlt: `${id} 中文教学插图`,
    imageProvider: "imagegen",
    imagePrompt: `生成一张中文 Web Deck 教学插图，只表达 ${id} 的核心机制，可以使用短标签帮助理解；不要包含页面标题、底部总结、页面卡片原文、长段落文字、表格或 UI 文本框。`
  };
}
