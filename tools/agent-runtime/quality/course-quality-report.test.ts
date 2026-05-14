import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { professorBoardLessonFixture, publishableLessonFixture } from "./test-fixtures.js";
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
        expect.objectContaining({ id: "case_analysis" })
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
                ? "案例分析：批判 O(1) 说法，给出反例并比较权衡。"
                : index === 4
                  ? "边界案例：把同一机制应用到缓存 key 设计并说明迁移边界。"
                  : "研究问题、方法边界和机制解释都要回到来源证据。"
    }));
    lesson.transferTasks = [
      {
        id: "t1",
        prompt: "边界案例：应用到缓存 key 设计，并写出假设、局限和反例。",
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
      "研究问题要求区分交互职责和内部推理职责。机制模型连接 Talker、Reasoner、证据链、局限边界和迁移条件。边界案例要求写出反例和失败模式。";
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      ...(index < 4
        ? {
            title: longTitle,
            learningGoal:
              "用研究论文精读方式完成一个过载的 mental-model move：同时解释研究问题、方法假设、机制模型、证据链、局限边界、反例、适用条件、应用案例和边界路径。",
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
    const lesson = professorBoardLessonFixture({ id: "quality-professor-rich", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      narrative:
        index === 0
          ? "本讲定位：核心问题、覆盖边界。先修要求：理解基本 agent、prompt 和 workflow。"
          : index === 1
            ? "知识节点：概念地图、方法谱系和理论结构。"
          : index === 2
              ? "核心定义：定义、正式术语和最小判别条件。"
          : index === 3
                ? "关键链路：从输入状态到工具调用，再到观察和评估。"
          : index === 4
                  ? "经典例题：用一个 agent orchestration case analysis 展开推导。"
          : index === 5
                    ? "方法比较：taxonomy、权衡、适用边界和反例。"
          : index === 6
                      ? "边界案例：相邻场景、保留条件和断裂条件。"
                      : "总结图：三条总结要点和下一单元衔接。"
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

  test("fails professor lecture decks when page knowledge boards are missing", () => {
    const lesson = publishableLessonFixture({ id: "quality-professor-missing-board", targetPageCount: 8 });

    const report = buildCourseQualityReport({
      runId: "quality-professor-missing-board",
      coursePackId: "quality-professor-missing-board",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck"
      }
    });

    expect(report.status).toBe("failed");
    expect(report.checks.professorLecture).toBe("failed");
    expect(report.knowledgeBoardRubric).toMatchObject({
      status: "failed",
      requiredPageCount: 8,
      satisfiedPageCount: 0
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.knowledge-board.missing",
          severity: "error",
          category: "lecture_structure",
          lessonId: "quality-professor-missing-board",
          pageId: "p1"
        })
      ])
    );
  });

  test("passes professor knowledge board gate for board-rich professor lessons", () => {
    const lesson = professorBoardLessonFixture({ id: "quality-professor-board-rich", targetPageCount: 8 });

    const report = buildCourseQualityReport({
      runId: "quality-professor-board-rich",
      coursePackId: "quality-professor-board-rich",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck"
      }
    });

    expect(report.knowledgeBoardRubric).toMatchObject({
      status: "passed",
      requiredPageCount: 8,
      satisfiedPageCount: 8,
      failedPageCount: 0
    });
    expect(report.issues.map((issue) => issue.issueId)).not.toContain("quality.knowledge-board.missing");
  });

  test("fails professor knowledge board gate when sourceTrace is empty", () => {
    const lesson = professorBoardLessonFixture({ id: "quality-professor-board-no-source", targetPageCount: 8 });
    if (!lesson.pages[0]?.knowledgeBoard) {
      throw new Error("expected fixture page to include knowledgeBoard");
    }
    lesson.pages[0] = {
      ...lesson.pages[0],
      knowledgeBoard: {
        ...lesson.pages[0].knowledgeBoard,
        sourceTrace: []
      }
    };

    const report = buildCourseQualityReport({
      runId: "quality-professor-board-no-source",
      coursePackId: "quality-professor-board-no-source",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck"
      }
    });

    expect(report.status).toBe("failed");
    expect(report.checks.professorLecture).toBe("failed");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.knowledge-board.source-trace-missing",
          severity: "error",
          category: "lecture_structure",
          lessonId: "quality-professor-board-no-source",
          pageId: "p1"
        })
      ])
    );
  });

  test("does not require knowledge boards for non-professor courses", () => {
    const report = buildCourseQualityReport({
      runId: "quality-non-professor-no-board",
      coursePackId: "quality-non-professor-no-board",
      lessons: [publishableLessonFixture({ id: "quality-non-professor-no-board", targetPageCount: 8 })],
      authoringContext: {
        courseIntent: "build_mental_model"
      }
    });

    expect(report.status).toBe("passed");
    expect(report.knowledgeBoardRubric).toBeUndefined();
    expect(report.issues.map((issue) => issue.issueId)).not.toContain("quality.knowledge-board.missing");
  });

  test("warns when professor lecture decks are only summaries", () => {
    const lesson = professorBoardLessonFixture({ id: "quality-professor-summary", targetPageCount: 8 });
    lesson.learningObjectives = ["理解资料大意"];
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
        expect.objectContaining({ id: "concept_framework" }),
        expect.objectContaining({ id: "key_link" }),
        expect.objectContaining({ id: "boundary_case" })
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
          issueId: "quality.professor-lecture.missing-key-link",
          severity: "warning",
          category: "lecture_structure",
          lessonId: "quality-professor-summary"
        })
      ])
    );
    expect(report.lessonScores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: "quality-professor-summary",
          status: "warning"
        })
      ])
    );
    expect(report.issues.map((issue) => issue.rule)).not.toContain("interaction-count");
  });

  test("keeps malformed interaction feedback issues in professor mode", () => {
    const lesson = professorBoardLessonFixture({ id: "quality-professor-broken-interaction", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec:
        index === 3
          ? {
              kind: "choice",
              learnerAction: "",
              expectedObservation: "看到课堂推导路径",
              cognitivePurpose: "比较方法边界",
              options: [
                {
                  id: "a",
                  label: "选择 A",
                  resultTitle: "方法边界",
                  outcomeId: "boundary",
                  resultTone: "success",
                  explanation: ""
                }
              ]
            }
          : undefined,
      narrative:
        index === 0
          ? "本讲定位：核心问题和覆盖边界。"
          : index === 1
            ? "先修要求：需要理解基本 agent、prompt 和工具调用。"
          : index === 2
              ? "概念地图：方法谱系、理论结构、关键定义和正式术语。"
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

    const report = buildCourseQualityReport({
      runId: "quality-professor-broken-interaction",
      coursePackId: "quality-professor-broken-interaction",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck"
      }
    });

    expect(report.status).toBe("failed");
    expect(report.checks.interactionQuality).toBe("failed");
    expect(report.issues.map((issue) => issue.rule)).not.toContain("interaction-count");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.interaction.feedback-missing",
          severity: "error",
          category: "missing_feedback",
          lessonId: "quality-professor-broken-interaction",
          pageId: "p4"
        })
      ])
    );
  });

  test("attributes professor lecture rubric warnings to each weak lesson in multi-lesson decks", () => {
    const richLesson = professorBoardLessonFixture({ id: "quality-professor-rich-unit", targetPageCount: 8 });
    richLesson.pages = richLesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      narrative:
        index === 0
          ? "本讲定位：核心问题和覆盖边界。"
          : index === 1
            ? "先修要求：需要理解基本 agent、prompt 和工具调用。"
          : index === 2
              ? "概念地图：方法谱系、理论结构、关键定义和正式术语。"
          : index === 3
                ? "关键链路：从输入状态到工具调用，再到观察和评估。"
          : index === 4
                  ? "经典例题：用一个 agent orchestration case analysis 展开推导。"
          : index === 5
                    ? "方法比较：taxonomy、权衡、适用边界和反例。"
          : index === 6
                      ? "边界案例：相邻场景、保留条件和断裂条件。"
                      : "总结图：三条总结要点和下一单元衔接。"
    }));
    const summaryLesson = professorBoardLessonFixture({ id: "quality-professor-summary-unit", targetPageCount: 8 });
    summaryLesson.learningObjectives = ["理解资料大意"];
    summaryLesson.pages = summaryLesson.pages.map((page) => ({
      ...page,
      interactionSpec: undefined,
      narrative: "本页总结本章内容，介绍核心概念，帮助学习者理解资料大意。"
    }));

    const report = buildCourseQualityReport({
      runId: "quality-professor-multi",
      coursePackId: "quality-professor-multi",
      lessons: [richLesson, summaryLesson],
      authoringContext: {
        courseIntent: "professor_lecture_deck"
      }
    });

    expect(report.checks.professorLecture).toBe("warning");
    expect(report.lessonScores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: "quality-professor-rich-unit",
          status: "passed"
        }),
        expect.objectContaining({
          lessonId: "quality-professor-summary-unit",
          status: "warning"
        })
      ])
    );
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.professor-lecture.missing-course-framing",
          category: "lecture_structure",
          lessonId: "quality-professor-summary-unit"
        }),
        expect.objectContaining({
          issueId: "quality.professor-lecture.missing-key-link",
          category: "lecture_structure",
          lessonId: "quality-professor-summary-unit"
        })
      ])
    );
    expect(
      report.issues.some(
        (issue) => issue.category === "lecture_structure" && issue.lessonId === "quality-professor-rich-unit"
      )
    ).toBe(false);
  });

  test("passes student self-study textbooks without interactive-course shell requirements", () => {
    const lesson = selfStudyTextbookLessonFixture("quality-self-study-rich");

    const report = buildCourseQualityReport({
      runId: "quality-self-study-rich",
      coursePackId: "quality-self-study-rich",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "student_self_study_textbook"
      }
    });

    expect(report.status).toBe("passed");
    expect(report.checks.interactionQuality).toBe("passed");
    expect(report.checks.assessmentCoverage).toBe("passed");
    expect(report.checks.transferCoverage).toBe("passed");
    expect(report.checks.selfStudyTextbook).toBe("passed");
    expect(report.selfStudyTextbookRubric).toMatchObject({
      status: "passed",
      failedPageCount: 0
    });
  });

  test("fails student self-study textbooks with teacher-facing board language", () => {
    const lesson = selfStudyTextbookLessonFixture("quality-self-study-teacher-language");
    lesson.pages[0] = {
      ...lesson.pages[0],
      knowledgeBoard: {
        ...lesson.pages[0]!.knowledgeBoard,
        headline: "本讲定位：识别本页中的作用"
      }
    };

    const report = buildCourseQualityReport({
      runId: "quality-self-study-teacher-language",
      coursePackId: "quality-self-study-teacher-language",
      lessons: [lesson],
      authoringContext: {
        courseIntent: "student_self_study_textbook"
      }
    });

    expect(report.status).toBe("failed");
    expect(report.checks.selfStudyTextbook).toBe("failed");
    expect(report.selfStudyTextbookRubric).toMatchObject({
      status: "failed",
      failedPageCount: 1
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.self-study-textbook.weak-page",
          severity: "error",
          category: "self_study_structure",
          lessonId: "quality-self-study-teacher-language",
          pageId: "p1",
          rule: "self-study-textbook"
        })
      ])
    );
  });
});

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
