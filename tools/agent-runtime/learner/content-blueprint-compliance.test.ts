import { describe, expect, it } from "vitest";

import { buildCourseIR, type CourseIR } from "./course-ir.js";
import type { ContentBlueprint } from "./content-quality-blueprint.js";
import { extractContentBlueprint, validateContentBlueprintCompliance } from "./content-blueprint-compliance.js";

const standardPageTypes = [
  "problem_scene",
  "intuition_visual",
  "structure_diagram",
  "interactive_model",
  "quiz",
  "misconception_check",
  "transfer_challenge",
  "summary_card"
];

describe("validateContentBlueprintCompliance", () => {
  it("passes when the course IR follows page type, action, feedback, and source requirements", () => {
    expect(validateContentBlueprintCompliance({ courseIR: courseIR(), contentBlueprint: blueprint() })).toEqual([]);
  });

  it("fails when an authored page drifts from the blueprint page type", () => {
    const pages = validPages();
    pages[3] = { ...pages[3], type: "intuition_visual" };

    expect(validateContentBlueprintCompliance({ courseIR: courseIR(pages), contentBlueprint: blueprint() })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "publish.blueprint.page-type-mismatch",
          scope: "page",
          lessonId: "hash-lesson",
          pageId: "p4",
          severity: "error",
          requiredFix: expect.stringContaining("contentBlueprint")
        })
      ])
    );
  });

  it("fails source-backed blueprint pages without source anchors or explicit grounding", () => {
    const pages = validPages();
    pages[1] = { ...pages[1], sourceAnchorIds: [] };

    expect(validateContentBlueprintCompliance({ courseIR: courseIR(pages), contentBlueprint: blueprint() })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "publish.blueprint.source-support-missing",
          lessonId: "hash-lesson",
          pageId: "p2",
          requiredFix: expect.stringContaining("sourceAnchorIds")
        })
      ])
    );
  });

  it("does not require source anchors for topic-only blueprint pages", () => {
    const pages = validPages().map((page) => ({ ...page, sourceAnchorIds: [] }));

    expect(
      validateContentBlueprintCompliance({
        courseIR: courseIR(pages, "topic"),
        contentBlueprint: blueprint("topic-only 页面必须清楚区分常识、推理和示例；不要伪造 sourceAnchorIds。")
      })
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "publish.blueprint.source-support-missing"
        })
      ])
    );
  });

  it("fails when a learner-action page has no matching interaction or assessment", () => {
    const pages = validPages();
    pages[3] = { ...pages[3], interactionSpec: undefined };

    expect(validateContentBlueprintCompliance({ courseIR: courseIR(pages), contentBlueprint: blueprint() })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "publish.blueprint.learner-action-missing",
          lessonId: "hash-lesson",
          pageId: "p4",
          reason: expect.stringContaining("learner action")
        })
      ])
    );
  });

  it("ignores malformed authoring-context blueprint payloads", () => {
    expect(
      extractContentBlueprint({
        contentBlueprint: {
          version: "content-blueprint/v1",
          units: [{ unitId: "unit-overview" }]
        }
      })
    ).toBeUndefined();
  });

  it("defaults missing legacy course intent when extracting content blueprints", () => {
    const legacyBlueprint = { ...blueprint() } as Partial<ContentBlueprint>;
    delete legacyBlueprint.courseIntent;

    expect(extractContentBlueprint({ contentBlueprint: legacyBlueprint })?.courseIntent).toBe("build_mental_model");
  });

  it("rejects content blueprints with invalid course intent", () => {
    expect(
      extractContentBlueprint({
        contentBlueprint: {
          ...blueprint(),
          courseIntent: "slide_export"
        }
      })
    ).toBeUndefined();
  });

  it("extracts student self-study textbook content blueprints", () => {
    expect(
      extractContentBlueprint({
        contentBlueprint: { ...blueprint(), courseIntent: "student_self_study_textbook" }
      })?.courseIntent
    ).toBe("student_self_study_textbook");
  });

  it("does not require fixed page types, interactive specs, or assessment specs for student self-study textbook blueprints", () => {
    expect(
      validateContentBlueprintCompliance({
        courseIR: selfStudyCourseIR(),
        contentBlueprint: selfStudyBlueprint()
      })
    ).toEqual([]);
  });
});

function blueprint(
  sourceRequirement = "source-backed 页面必须包含 page.sourceAnchorIds；没有直接依据的推理页设置 grounding.kind 为 inferred，类比页设置为 analogy。"
): ContentBlueprint {
  const sourceAnchorIds = sourceRequirement.includes("topic-only") ? [] : ["source-001:p1"];
  return {
    version: "content-blueprint/v1",
    courseIntent: "build_mental_model",
    globalRules: ["中文优先"],
    units: [
      {
        unitId: "unit-overview",
        lessonId: "hash-lesson",
        title: "哈希表总览",
        targetPageCount: 8,
        unitKind: "overview",
        focusConcepts: ["哈希表"],
        sourceAnchorIds,
        sourceRequirement,
        pageBlueprints: standardPageTypes.map((pageType, index) => ({
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

function courseIR(pages = validPages(), sourceKind = "book"): CourseIR {
  return buildCourseIR({
    runId: "hash-run",
    coursePack: {
      id: "hash-course",
      title: "哈希表课程",
      parentRunId: "hash-run",
      language: "zh-CN",
      sourceKind,
      strategy: "overview_plus_topic",
      units: [
        {
          unitId: "unit-overview",
          title: "哈希表总览",
          kind: "overview",
          lessonId: "hash-lesson",
          targetPageCount: 8,
          sourceAnchorIds: ["source-001:p1"],
          conceptIds: ["hash-table"]
        }
      ]
    },
    lessons: [
      {
        id: "hash-lesson",
        title: "哈希表总览",
        audience: "有编程基础的中文学习者",
        config: { targetPageCount: 8 },
        sourceContext: {
          unitId: "unit-overview",
          sourceAnchorIds: ["source-001:p1"]
        },
        prerequisites: ["会写简单代码"],
        learningObjectives: ["理解哈希表为什么快"],
        pages,
        misconceptions: [{ id: "m1", statement: "哈希表永远 O(1)", correction: "冲突会改变成本。" }],
        transferTasks: [{ id: "t1", prompt: "迁移到缓存 key 设计" }],
        summary: ["哈希表通过 key 缩小候选范围。"]
      }
    ]
  });
}

function selfStudyBlueprint(): ContentBlueprint {
  const sourceRequirement = "source-backed 页面必须包含 page.sourceAnchorIds；没有直接依据的推理页设置 grounding.kind 为 inferred，类比页设置为 analogy。";
  const pageTypes = Array(8).fill("codex_designed") as string[];
  return {
    version: "content-blueprint/v1",
    courseIntent: "student_self_study_textbook",
    globalRules: ["学生自学 Web 教材"],
    units: [
      {
        unitId: "unit-overview",
        lessonId: "self-study-lesson",
        title: "Agent workflow 自学课",
        targetPageCount: 8,
        unitKind: "overview",
        focusConcepts: ["workflow"],
        sourceAnchorIds: ["source-001:p1"],
        sourceRequirement,
        pageBlueprints: pageTypes.map((pageType, index) => ({
          pageNumber: index + 1,
          pageType,
          teachingMove: "直接讲清一个知识片段。",
          learnerAction: "阅读解释并追踪知识链路。",
          visualRequirement: "knowledgeBoard 承载板书结构。",
          feedbackRequirement: "bottomLine 给出可复习结论。",
          sourceRequirement,
          mustInclude: ["knowledgeBoard", "sourceTrace", "bottomLine"]
        }))
      }
    ]
  };
}

function selfStudyCourseIR(): CourseIR {
  const pageTypes = [
    "problem_scene",
    "intuition_visual",
    "structure_diagram",
    "process_animation",
    "code_walkthrough",
    "misconception_check",
    "transfer_challenge",
    "summary_card"
  ];
  return buildCourseIR({
    runId: "self-study-run",
    coursePack: {
      id: "self-study-course",
      title: "Agent workflow 自学课",
      parentRunId: "self-study-run",
      language: "zh-CN",
      sourceKind: "book",
      strategy: "overview_plus_topic",
      units: [
        {
          unitId: "unit-overview",
          title: "Agent workflow 自学课",
          kind: "overview",
          lessonId: "self-study-lesson",
          targetPageCount: 8,
          sourceAnchorIds: ["source-001:p1"],
          conceptIds: ["workflow"]
        }
      ]
    },
    lessons: [
      {
        id: "self-study-lesson",
        title: "Agent workflow 自学课",
        audience: "研究生自学者",
        config: { targetPageCount: 8 },
        sourceContext: {
          unitId: "unit-overview",
          sourceAnchorIds: ["source-001:p1"]
        },
        prerequisites: ["先修：理解 LLM 调用"],
        learningObjectives: ["理解 workflow 的中间状态。"],
        pages: pageTypes.map((type, index) => ({
          id: `p${index + 1}`,
          type,
          title: `第 ${index + 1} 页`,
          learningGoal: "理解 workflow 的中间状态。",
          narrative: "这是一段中文自学教材内容。",
          sourceAnchorIds: ["source-001:p1"],
          knowledgeBoard: {
            headline: "为什么 workflow 需要中间状态？",
            coreProposition: "workflow 让复杂任务变成可检查、可恢复的步骤。",
            leftColumn: [{ label: "机制链", items: ["拆步骤", "看中间状态"] }],
            rightColumn: [{ label: "例子与边界", items: ["例如来源采样", "边界是短任务不一定需要"] }],
            sourceTrace: [{ anchorId: "source-001:p1", supports: "来源支持 workflow 拆分步骤。" }],
            bottomLine: "记住中间状态。"
          }
        })),
        misconceptions: [{ id: "m1", statement: "workflow 只是长提示。", correction: "关键是中间状态。" }],
        transferTasks: [],
        summary: ["workflow 让任务有中间状态。"]
      }
    ]
  });
}

function validPages(): Array<Record<string, unknown>> {
  return standardPageTypes.map((type, index) => {
    const pageNumber = index + 1;
    const page = {
      id: `p${pageNumber}`,
      type,
      title: `第 ${pageNumber} 页`,
      learningGoal: "理解哈希表为什么快",
      narrative: "这是一段中文学习内容。",
      sourceAnchorIds: ["source-001:p1"]
    };

    if (type === "interactive_model") {
      return {
        ...page,
        visualSpec: visualSpec(),
        interactionSpec: {
          kind: "choice",
          learnerAction: "选择访问路径",
          expectedObservation: "看到候选范围变化",
          cognitivePurpose: "理解搜索空间缩小"
        }
      };
    }

    if (type === "quiz" || type === "misconception_check" || type === "transfer_challenge") {
      return {
        ...page,
        assessmentSpec: {
          kind: "multiple_choice",
          prompt: "哪种判断更符合心智模型？",
          options: ["缩小候选范围", "随机变快"],
          correctAnswer: "缩小候选范围"
        },
        feedbackSpec: {
          correctFeedback: "正确，因为 key 改变了查找路径。",
          incorrectFeedback: "不对，这忽略了搜索空间变化。"
        }
      };
    }

    return {
      ...page,
      visualSpec: visualSpec()
    };
  });
}

function visualSpec(): Record<string, unknown> {
  return {
    kind: "diagram",
    description: "中文结构图",
    keyElements: ["键", "桶", "候选范围"]
  };
}
