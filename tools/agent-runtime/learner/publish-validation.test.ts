import { describe, expect, it } from "vitest";

import { buildCourseIR } from "./course-ir.js";
import { validatePublishBundle } from "./publish-validation.js";

const validLesson = {
  id: "valid-lesson",
  title: "有效课程",
  audience: "中文学习者",
  config: { targetPageCount: 2 },
  sourceContext: {
    sourceKind: "book",
    sourceAnchorIds: ["source-001:p1"],
    unitId: "unit-overview"
  },
  prerequisites: ["基础知识"],
  learningObjectives: ["理解核心问题"],
  pages: [
    {
      id: "page-01",
      type: "problem_scene",
      title: "问题场景",
      learningGoal: "识别问题",
      narrative: "从问题开始。",
      sourceAnchorIds: ["source-001:p1"]
    },
    {
      id: "page-02",
      type: "quiz",
      title: "检查理解",
      learningGoal: "检查是否理解",
      narrative: "回答问题。",
      grounding: { kind: "inferred" },
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "哪种更可靠？",
        options: ["有依据", "无依据"],
        correctAnswer: "有依据"
      },
      feedbackSpec: {
        correctFeedback: "正确。",
        incorrectFeedback: "不对。"
      }
    }
  ],
  misconceptions: [],
  transferTasks: [],
  summary: ["总结"]
};

const validCoursePack = {
  id: "valid-course",
  title: "有效课程包",
  parentRunId: "valid-run",
  language: "zh-CN",
  sourceKind: "book",
  strategy: "overview_plus_topic",
  units: [
    {
      unitId: "unit-overview",
      title: "总览",
      kind: "overview",
      lessonId: "valid-lesson",
      targetPageCount: 2,
      sourceAnchorIds: ["source-001:p1"],
      conceptIds: ["concept-01"]
    }
  ]
};

function validate(input: { coursePack?: unknown; lessons?: unknown[] }) {
  const courseIR = buildCourseIR({
    runId: "valid-run",
    coursePack: input.coursePack ?? validCoursePack,
    lessons: input.lessons ?? [validLesson]
  });
  return validatePublishBundle({ courseIR, sourceBacked: true });
}

describe("validatePublishBundle", () => {
  it("passes a source-backed course bundle with page goals, source support, and assessment feedback", () => {
    expect(validate({})).toMatchObject({
      status: "passed",
      blockingIssueCount: 0,
      issues: []
    });
  });

  it("fails when a unit references a missing lesson", () => {
    const result = validate({
      coursePack: {
        ...validCoursePack,
        units: [{ ...validCoursePack.units[0], lessonId: "missing-lesson" }]
      }
    });

    expect(result).toMatchObject({
      status: "failed",
      blockingIssueCount: 1,
      issues: [
        expect.objectContaining({
          issueId: "publish.unit.lesson-missing",
          scope: "unit",
          unitId: "unit-overview",
          severity: "error"
        })
      ]
    });
  });

  it("fails when a page misses learningGoal", () => {
    const lesson = {
      ...validLesson,
      pages: [{ ...validLesson.pages[0], learningGoal: "" }, validLesson.pages[1]]
    };

    expect(validate({ lessons: [lesson] }).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "publish.page.learning-goal-missing",
          lessonId: "valid-lesson",
          pageId: "page-01",
          severity: "error"
        })
      ])
    );
  });

  it("fails when a source-backed page has no source anchors or grounding classification", () => {
    const lesson = {
      ...validLesson,
      pages: [{ ...validLesson.pages[0], sourceAnchorIds: [], grounding: undefined }, validLesson.pages[1]]
    };

    expect(validate({ lessons: [lesson] }).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "publish.page.source-support-missing",
          pageId: "page-01",
          requiredFix: expect.stringContaining("sourceAnchorIds")
        })
      ])
    );
  });

  it("fails when an assessment page lacks explanatory feedback", () => {
    const lesson = {
      ...validLesson,
      pages: [validLesson.pages[0], { ...validLesson.pages[1], feedbackSpec: undefined }]
    };

    expect(validate({ lessons: [lesson] }).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "publish.page.assessment-feedback-missing",
          pageId: "page-02",
          reason: expect.stringContaining("assessment")
        })
      ])
    );
  });
});
