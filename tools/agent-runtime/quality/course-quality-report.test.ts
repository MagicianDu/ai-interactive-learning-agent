import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { publishableLessonFixture } from "./test-fixtures.js";
import { buildCourseQualityReport, toCompactCourseQualityReport, writeCourseQualityReport } from "./course-quality-report.js";

describe("course-quality-report", () => {
  test("builds a passed compact quality report for a complete Chinese course", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "course-quality-"));
    const report = buildCourseQualityReport({
      runId: "quality-run",
      coursePackId: "quality-run",
      lessons: [publishableLessonFixture({ id: "quality-overview", targetPageCount: 8 })]
    });
    const reportPath = await writeCourseQualityReport(root, "quality-run", report);
    const compact = toCompactCourseQualityReport(report, reportPath);

    expect(report).toMatchObject({
      status: "passed",
      score: 100,
      checks: {
        chineseFirst: "passed",
        pageStructure: "passed",
        interactionQuality: "passed",
        assessmentCoverage: "passed",
        transferCoverage: "passed"
      }
    });
    expect(compact).toMatchObject({
      status: "passed",
      score: 100,
      requiredFixCount: 0,
      reportPath
    });
    await expect(readFile(reportPath, "utf8")).resolves.toContain("\"coursePackId\": \"quality-run\"");
  });

  test("fails when source evidence is missing from a source-backed course", () => {
    const report = buildCourseQualityReport({
      runId: "quality-source",
      coursePackId: "quality-source",
      lessons: [publishableLessonFixture({ id: "quality-source-overview", targetPageCount: 8 })],
      sourceEvidence: {
        status: "failed",
        totalLessons: 1,
        totalPages: 8,
        supportedPages: 0,
        inferredPages: 0,
        unsupportedPages: 8,
        supportRatio: 0,
        unsupportedPageRefs: ["quality-source-overview:p1"],
        pageSupport: []
      }
    });

    expect(report.status).toBe("failed");
    expect(report.checks.sourceEvidence).toBe("failed");
    expect(report.requiredFixes.some((fix) => fix.includes("source-evidence"))).toBe(true);
  });

  test("returns structured issue objects that support targeted revision", () => {
    const lesson = publishableLessonFixture({ id: "quality-issues-overview", targetPageCount: 8 });
    lesson.pages[0] = {
      ...lesson.pages[0],
      narrative: "哈希表查询过程需要同时理解数组桶、哈希函数、冲突链、负载因子、扩容阈值和查询路径。".repeat(80)
    };
    lesson.pages[5] = {
      ...lesson.pages[5],
      feedbackSpec: undefined
    };

    const report = buildCourseQualityReport({
      runId: "quality-issues",
      coursePackId: "quality-issues",
      lessons: [lesson],
      sourceEvidence: {
        status: "failed",
        totalLessons: 1,
        totalPages: 8,
        supportedPages: 0,
        inferredPages: 0,
        unsupportedPages: 8,
        supportRatio: 0,
        unsupportedPageRefs: ["quality-issues-overview:p1"],
        pageSupport: []
      }
    });
    const compact = toCompactCourseQualityReport(report, "/tmp/course-quality-report.json");

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.source-evidence.failed",
          scope: "course",
          severity: "error",
          category: "source_evidence",
          requiredFix: expect.stringContaining("source")
        }),
        expect.objectContaining({
          issueId: "quality.page.dense",
          scope: "page",
          lessonId: "quality-issues-overview",
          pageId: "p1",
          category: "dense_page"
        }),
        expect.objectContaining({
          issueId: "quality.page.feedback-missing",
          scope: "page",
          lessonId: "quality-issues-overview",
          pageId: "p6",
          category: "missing_feedback"
        })
      ])
    );
    expect(report.issueSummary).toMatchObject({
      course: 1,
      page: 2,
      errors: 2,
      warnings: 1
    });
    expect(compact.issueSummary).toMatchObject({ course: 1, page: 2 });
    expect(compact.topIssues[0]).toMatchObject({
      issueId: "quality.source-evidence.failed",
      requiredFix: expect.stringContaining("source")
    });
  });

  test("flags generic pages and weak source synthesis even when source anchors are present", () => {
    const lesson = publishableLessonFixture({ id: "quality-generic-overview", targetPageCount: 8 });
    lesson.learningObjectives = ["理解资料大意"];
    lesson.pages[0] = {
      ...lesson.pages[0],
      sourceAnchorIds: ["source-001:section-1"],
      title: "核心概念总览",
      learningGoal: "了解整体内容",
      narrative: "本页介绍核心概念，帮助学习者理解资料大意。"
    };

    const report = buildCourseQualityReport({
      runId: "quality-generic",
      coursePackId: "quality-generic",
      lessons: [lesson],
      authoringContext: {
        sourceSemantics: {
          keyTerms: [{ term: "tool feedback" }, { term: "reflection loop" }, { term: "evaluation boundary" }],
          evidenceHints: [{ hint: "source compares tool feedback with evaluator feedback" }],
          limitationHints: [{ hint: "reflection only works when observations are reliable" }]
        }
      }
    });

    expect(report.status).toBe("warning");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.page.generic-source-page",
          category: "generic_page",
          lessonId: "quality-generic-overview",
          pageId: "p1"
        }),
        expect.objectContaining({
          issueId: "quality.page.source-synthesis-weak",
          category: "source_evidence",
          lessonId: "quality-generic-overview",
          pageId: "p1"
        })
      ])
    );
  });

  test("flags shallow graduate/research lessons and decorative interactions", () => {
    const lesson = publishableLessonFixture({ id: "quality-shallow-graduate", targetPageCount: 8 });
    lesson.audience = "研究生课程学习者";
    lesson.prerequisites = ["能阅读中文材料"];
    lesson.learningObjectives = ["建立中文心智模型"];
    lesson.pages[3] = {
      ...lesson.pages[3],
      interactionSpec: {
        kind: "choice",
        learnerAction: "点击一个选项",
        expectedObservation: "看到提示",
        cognitivePurpose: "帮助理解内容"
      }
    };

    const report = buildCourseQualityReport({
      runId: "quality-shallow",
      coursePackId: "quality-shallow",
      lessons: [lesson],
      authoringContext: {
        difficultyLevel: "upper_undergraduate_or_graduate"
      }
    });

    expect(report.status).toBe("warning");
    expect(report.checks.academicDepth).toBe("warning");
    expect(report.depthRubric).toMatchObject({
      status: "warning",
      difficultyLevel: "upper_undergraduate_or_graduate",
      missingMoves: expect.arrayContaining([
        expect.objectContaining({ id: "formal_abstraction" }),
        expect.objectContaining({ id: "evidence_chain" }),
        expect.objectContaining({ id: "critique_discussion" })
      ])
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.lesson.academic-depth-shallow",
          category: "learner_level_mismatch",
          lessonId: "quality-shallow-graduate",
          requiredFix: expect.stringContaining("formal abstraction")
        }),
        expect.objectContaining({
          issueId: "quality.interaction.cognitive-purpose-vague",
          category: "decorative_interaction",
          lessonId: "quality-shallow-graduate",
          pageId: "p4"
        })
      ])
    );
  });

  test("passes structured academic depth rubric for a rich graduate lesson", () => {
    const lesson = publishableLessonFixture({ id: "quality-rich-graduate", targetPageCount: 8 });
    lesson.prerequisites = ["先修：能阅读伪代码", "先修：理解基本复杂度"];
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      sourceAnchorIds: ["source-001:section-1"],
      narrative:
        index === 0
          ? "先修概念连接到正式术语：哈希函数、负载因子和冲突处理。"
          : index === 1
            ? "证据链来自来源锚点：实验现象显示候选范围缩小。"
            : index === 2
              ? "假设和适用条件：均匀散列成立时平均访问更稳定；局限是冲突集中。"
              : index === 3
                ? "课堂讨论：批判 O(1) 说法，给出反例并比较权衡。"
                : index === 4
                  ? "课后作业：把同一机制迁移到缓存 key 设计并说明迁移边界。"
                  : "研究问题、方法边界和机制解释都要回到来源证据。"
    }));
    lesson.transferTasks = [
      {
        id: "t1",
        prompt: "课后作业：迁移到缓存 key 设计，并写出假设、局限和反例。",
        targetMentalModel: "用来源证据和边界条件解释迁移。"
      }
    ];

    const report = buildCourseQualityReport({
      runId: "quality-rich-depth",
      coursePackId: "quality-rich-depth",
      lessons: [lesson],
      authoringContext: {
        difficultyLevel: "upper_undergraduate_or_graduate",
        sourceSemantics: {
          keyTerms: [{ term: "哈希函数" }, { term: "负载因子" }, { term: "冲突处理" }]
        }
      }
    });

    expect(report.checks.academicDepth).toBe("passed");
    expect(report.depthRubric).toMatchObject({
      status: "passed",
      requiredMoveCount: 6,
      satisfiedMoveCount: 6,
      missingMoves: []
    });
    expect(report.issues.map((issue) => issue.issueId)).not.toContain("quality.lesson.academic-depth-shallow");
  });

  test("categorizes missing interaction explanations as missing feedback", () => {
    const lesson = publishableLessonFixture({ id: "quality-interaction-feedback", targetPageCount: 8 });
    lesson.pages[3] = {
      ...lesson.pages[3],
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择一个路径",
        expectedObservation: "看到访问范围变化",
        cognitivePurpose: "理解因果关系",
        options: [
          {
            id: "a",
            label: "选择 A",
            resultTitle: "索引路径",
            outcomeId: "indexed",
            resultTone: "success",
            explanation: ""
          }
        ]
      }
    };

    const report = buildCourseQualityReport({
      runId: "quality-interaction-feedback",
      coursePackId: "quality-interaction-feedback",
      lessons: [lesson]
    });

    expect(report.status).toBe("failed");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.interaction.feedback-missing",
          category: "missing_feedback",
          lessonId: "quality-interaction-feedback",
          pageId: "p4"
        })
      ])
    );
    expect(report.issueSummary.byCategory).toMatchObject({ missing_feedback: 1 });
  });

  test("flags shallow patent and blog lessons that miss source-kind depth moves", () => {
    const patentLesson = publishableLessonFixture({ id: "quality-shallow-patent", targetPageCount: 8, title: "缓存系统专利解读" });
    const blogLesson = publishableLessonFixture({ id: "quality-shallow-blog", targetPageCount: 8, title: "Agent 工作流实践" });

    const patentReport = buildCourseQualityReport({
      runId: "quality-patent-depth",
      coursePackId: "quality-patent-depth",
      lessons: [patentLesson],
      authoringContext: {
        sourceKind: "patent",
        difficultyLevel: "upper_undergraduate_or_graduate"
      }
    });
    const blogReport = buildCourseQualityReport({
      runId: "quality-blog-depth",
      coursePackId: "quality-blog-depth",
      lessons: [blogLesson],
      authoringContext: {
        sourceKind: "blog",
        difficultyLevel: "upper_undergraduate_or_graduate"
      }
    });

    expect(patentReport.status).toBe("warning");
    expect(patentReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.lesson.patent-depth-shallow",
          category: "learner_level_mismatch",
          lessonId: "quality-shallow-patent"
        })
      ])
    );
    expect(blogReport.status).toBe("warning");
    expect(blogReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.lesson.blog-practice-depth-shallow",
          category: "learner_level_mismatch",
          lessonId: "quality-shallow-blog"
        })
      ])
    );
  });

  test("flags overloaded page labels and repetitive long narratives", () => {
    const lesson = publishableLessonFixture({ id: "quality-overloaded-pages", targetPageCount: 8 });
    const longTitle = "Talker-Reasoner 架构、研究问题、系统机制、实验证据、局限边界、迁移应用、方法结构、证据边界：研究问题";
    const repeatedNarrative =
      "研究问题要求区分交互职责和内部推理职责。机制模型连接 Talker、Reasoner、证据链、局限边界和迁移条件。课后作业要求写出反例和失败模式。";
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      ...(index < 4
        ? {
            title: longTitle,
            learningGoal:
              "用研究论文精读方式完成一个过载的 mental-model move：同时解释研究问题、方法假设、机制模型、证据链、局限边界、反例、适用条件、迁移应用和课堂讨论路径。",
            narrative: repeatedNarrative
          }
        : {})
    }));

    const report = buildCourseQualityReport({
      runId: "quality-overloaded",
      coursePackId: "quality-overloaded",
      lessons: [lesson]
    });

    expect(report.status).toBe("warning");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.page.title-too-long",
          category: "dense_page",
          pageId: "p1"
        }),
        expect.objectContaining({
          issueId: "quality.page.learning-goal-too-long",
          category: "dense_page",
          pageId: "p1"
        }),
        expect.objectContaining({
          issueId: "quality.lesson.repetitive-pages",
          category: "dense_page",
          lessonId: "quality-overloaded-pages"
        })
      ])
    );
  });

  test("flags shallow paper lessons that lack research-reading moves", () => {
    const lesson = publishableLessonFixture({ id: "quality-paper-shallow", title: "论文精读：总览课", targetPageCount: 8 });

    const report = buildCourseQualityReport({
      runId: "quality-paper",
      coursePackId: "quality-paper",
      lessons: [lesson],
      authoringContext: {
        difficultyLevel: "research",
        sourceKind: "paper"
      }
    });

    expect(report.status).toBe("warning");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.lesson.paper-research-depth-shallow",
          category: "learner_level_mismatch",
          lessonId: "quality-paper-shallow"
        })
      ])
    );
  });

  test("does not fail professor lecture decks only because every page lacks interactions", () => {
    const lesson = publishableLessonFixture({ id: "quality-professor-rich", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      narrative:
        index === 0
          ? "课程框架：本讲定位、核心问题、先修要求和学习边界。"
          : index === 1
            ? "概念地图：关键定义、术语、方法谱系和理论结构。"
            : index === 2
              ? "方法结构：比较 planning、tool use、reflection 的适用条件。"
              : index === 3
                ? "经典例题：用一个 agent orchestration case analysis 展开推导。"
                : index === 4
                  ? "方法比较：taxonomy、权衡、适用边界和反例。"
                  : index === 5
                    ? "课堂讨论题：批判一个设计选择并给出参考要点。"
                    : index === 6
                      ? "课后作业：阅读路径、problem set 和 homework。"
                      : "本讲 takeaway：三条复习清单和下一讲衔接。"
    }));

    const report = buildCourseQualityReport({
      runId: "quality-professor-rich",
      coursePackId: "quality-professor-rich",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck"
      }
    });

    expect(report.status).toBe("passed");
    expect(report.checks.interactionQuality).toBe("passed");
    expect(report.checks.professorLecture).toBe("passed");
    expect(report.professorLectureRubric).toMatchObject({
      status: "passed",
      missingMoves: []
    });
    expect(report.issues.map((issue) => issue.rule)).not.toContain("interaction-count");
  });

  test("warns when professor lecture decks are only summaries", () => {
    const lesson = publishableLessonFixture({ id: "quality-professor-summary", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page) => ({
      ...page,
      interactionSpec: undefined,
      narrative: "本页总结本章内容，介绍核心概念，帮助学习者理解资料大意。"
    }));

    const report = buildCourseQualityReport({
      runId: "quality-professor-summary",
      coursePackId: "quality-professor-summary",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck"
      }
    });

    expect(report.status).toBe("warning");
    expect(report.checks.interactionQuality).toBe("passed");
    expect(report.checks.professorLecture).toBe("warning");
    expect(report.professorLectureRubric).toMatchObject({
      status: "warning",
      missingMoves: expect.arrayContaining([
        expect.objectContaining({ id: "course_framing" }),
        expect.objectContaining({ id: "worked_example" }),
        expect.objectContaining({ id: "discussion_prompt" }),
        expect.objectContaining({ id: "homework_or_reading" })
      ])
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.professor-lecture.missing-course-framing",
          severity: "warning",
          category: "lecture_structure",
          lessonId: "quality-professor-summary"
        }),
        expect.objectContaining({
          issueId: "quality.professor-lecture.missing-worked-example",
          severity: "warning",
          category: "lecture_structure",
          lessonId: "quality-professor-summary"
        })
      ])
    );
    expect(report.issues.map((issue) => issue.rule)).not.toContain("interaction-count");
  });
});
