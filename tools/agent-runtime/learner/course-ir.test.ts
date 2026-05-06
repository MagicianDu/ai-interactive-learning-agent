import { describe, expect, it } from "vitest";

import { buildCourseIR } from "./course-ir.js";

const lesson = {
  id: "agent-overview",
  title: "Agent 系统总览",
  audience: "中文学习者",
  config: { targetPageCount: 8 },
  sourceContext: {
    sourceKind: "book",
    sourceAnchorIds: ["source-001:chapter-1"],
    unitId: "unit-overview",
    conceptIds: ["concept-01"]
  },
  prerequisites: ["有基础编程经验"],
  learningObjectives: ["解释 Agent 系统的核心结构"],
  pages: [
    {
      id: "page-01",
      type: "problem_scene",
      title: "为什么需要 Agent 系统",
      learningGoal: "识别真实问题",
      narrative: "先从问题进入。",
      sourceAnchorIds: ["source-001:chapter-1"],
      visualSpec: {
        kind: "diagram",
        description: "问题到系统结构",
        keyElements: ["问题", "结构"]
      }
    },
    {
      id: "page-02",
      type: "quiz",
      title: "检查理解",
      learningGoal: "判断是否理解机制",
      narrative: "选择更可靠解释。",
      grounding: { kind: "inferred", note: "基于来源概念的教学推理" },
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "哪种解释更可靠？",
        options: ["有来源和边界", "只有结论"],
        correctAnswer: "有来源和边界"
      },
      feedbackSpec: {
        correctFeedback: "正确，因为解释连接了来源和边界。",
        incorrectFeedback: "不对，只有结论不能建立心智模型。"
      }
    }
  ],
  misconceptions: [{ id: "m1", statement: "摘要等于理解", correction: "理解需要行动和迁移" }],
  transferTasks: [{ id: "t1", prompt: "迁移到新资料", targetMentalModel: "先找来源再看机制" }],
  summary: ["先问题，再结构，再迁移。"]
};

const coursePack = {
  id: "agent-course",
  title: "Agent 系统课程包",
  parentRunId: "agent-run",
  sourceKind: "book",
  strategy: "overview_plus_topic",
  audience: "中文学习者",
  language: "zh-CN",
  overviewUnitId: "unit-overview",
  units: [
    {
      unitId: "unit-overview",
      title: "总览课",
      kind: "overview",
      lessonId: "agent-overview",
      targetPageCount: 8,
      sourceAnchorIds: ["source-001:chapter-1"],
      sourceNodeIds: ["source-001:root"],
      conceptIds: ["concept-01"]
    },
    {
      unitId: "unit-topic-01",
      title: "工具使用",
      kind: "topic",
      targetPageCount: 8,
      sourceAnchorIds: ["source-001:chapter-2"],
      sourceNodeIds: ["source-001:root"],
      conceptIds: ["concept-02"]
    }
  ]
};

describe("buildCourseIR", () => {
  it("builds a versioned course IR from course pack and lessons", () => {
    const ir = buildCourseIR({
      runId: "agent-run",
      coursePack,
      lessons: [lesson],
      sourceEvidence: {
        status: "passed",
        totalLessons: 1,
        totalPages: 2,
        supportedPages: 1,
        inferredPages: 1,
        unsupportedPages: 0,
        supportRatio: 1,
        unsupportedPageRefs: [],
        pageSupport: []
      },
      qualityReport: {
        status: "passed",
        score: 92,
        summary: "课程质量通过"
      }
    });

    expect(ir).toMatchObject({
      schemaVersion: 1,
      irVersion: "course-ir/v1",
      runId: "agent-run",
      coursePackId: "agent-course",
      title: "Agent 系统课程包",
      language: "zh-CN",
      sourceKind: "book",
      strategy: "overview_plus_topic",
      quality: {
        status: "passed",
        score: 92
      },
      sourceEvidence: {
        status: "passed",
        totalPages: 2,
        unsupportedPages: 0
      }
    });
    expect(ir.units).toEqual([
      expect.objectContaining({
        unitId: "unit-overview",
        status: "ready",
        lessonId: "agent-overview",
        pageCount: 2,
        sourceAnchorIds: ["source-001:chapter-1"]
      }),
      expect.objectContaining({
        unitId: "unit-topic-01",
        status: "pending",
        lessonId: undefined,
        pageCount: 0
      })
    ]);
    expect(ir.lessons[0]).toMatchObject({
      lessonId: "agent-overview",
      unitId: "unit-overview",
      pageCount: 2,
      sourceAnchorIds: ["source-001:chapter-1"],
      pages: [
        expect.objectContaining({
          pageId: "page-01",
          type: "problem_scene",
          sourceSupport: "source",
          hasVisual: true,
          hasAssessment: false,
          hasFeedback: false
        }),
        expect.objectContaining({
          pageId: "page-02",
          type: "quiz",
          sourceSupport: "inferred",
          hasAssessment: true,
          hasFeedback: true
        })
      ]
    });
  });

  it("marks revised and failed units when source objects carry status metadata", () => {
    const ir = buildCourseIR({
      runId: "agent-run",
      coursePack: {
        ...coursePack,
        units: [
          {
            ...coursePack.units[0],
            status: "revised"
          },
          {
            ...coursePack.units[1],
            status: "failed",
            failureReason: "quality gate failed"
          }
        ]
      },
      lessons: [{ ...lesson, revision: { revisionId: "revision-001" } }]
    });

    expect(ir.units).toEqual([
      expect.objectContaining({
        unitId: "unit-overview",
        status: "revised",
        revisionId: "revision-001"
      }),
      expect.objectContaining({
        unitId: "unit-topic-01",
        status: "failed",
        failureReason: "quality gate failed"
      })
    ]);
  });
});
