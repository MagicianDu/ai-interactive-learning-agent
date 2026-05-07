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
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.lesson.academic-depth-shallow",
          category: "learner_level_mismatch",
          lessonId: "quality-shallow-graduate"
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
});
