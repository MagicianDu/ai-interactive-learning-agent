import { describe, expect, test } from "vitest";

import { buildContentBlueprint } from "./content-quality-blueprint.js";
import type { PlannedCourseUnit } from "./course-unit-planner.js";

describe("content-quality-blueprint", () => {
  test("builds a complete 8-page teaching sequence for a normal unit", () => {
    const blueprint = buildContentBlueprint({
      audience: "有编程基础但缺少系统心智模型的中文学习者",
      sourceKind: "book",
      units: [plannedUnit({ targetPageCount: 8 })]
    });

    expect(blueprint).toMatchObject({
      version: "content-blueprint/v1",
      units: [
        {
          unitId: "unit-topic-01",
          lessonId: "agentic-topic-01",
          targetPageCount: 8,
          sourceRequirement: expect.stringContaining("sourceAnchorIds")
        }
      ]
    });
    expect(blueprint.globalRules).toEqual(
      expect.arrayContaining([expect.stringContaining("中文优先"), expect.stringContaining("大学高年级/研究生课程")])
    );
    expect(blueprint.globalRules.join("\n")).not.toContain("knowledgeBoard");
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual([
      "problem_scene",
      "intuition_visual",
      "structure_diagram",
      "interactive_model",
      "quiz",
      "misconception_check",
      "transfer_challenge",
      "summary_card"
    ]);
    expect(blueprint.units[0]?.pageBlueprints[0]).toMatchObject({
      pageNumber: 1,
      learnerAction: expect.stringContaining("判断"),
      visualRequirement: expect.stringContaining("问题"),
      mustInclude: expect.arrayContaining([expect.stringContaining("课程定位")])
    });
    expect(blueprint.units[0]?.pageBlueprints[3]).toMatchObject({
      pageType: "interactive_model",
      learnerAction: expect.stringContaining("操作"),
      feedbackRequirement: expect.stringContaining("因果")
    });
    expect(blueprint.units[0]?.pageBlueprints[4]).toMatchObject({
      pageType: "quiz",
      mustInclude: expect.arrayContaining([expect.stringContaining("大学课程")])
    });
  });

  test("adds deepening pages for 10-page units without losing transfer and summary", () => {
    const blueprint = buildContentBlueprint({
      audience: "工程实践者",
      sourceKind: "paper",
      units: [plannedUnit({ targetPageCount: 10, kind: "topic", focusConcepts: ["证据链"] })]
    });

    expect(blueprint.units[0]?.pageBlueprints).toHaveLength(10);
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual([
      "problem_scene",
      "intuition_visual",
      "structure_diagram",
      "process_animation",
      "interactive_model",
      "code_walkthrough",
      "quiz",
      "misconception_check",
      "transfer_challenge",
      "summary_card"
    ]);
    expect(blueprint.units[0]?.pageBlueprints.at(-2)).toMatchObject({ pageType: "transfer_challenge" });
    expect(blueprint.units[0]?.pageBlueprints.at(-1)).toMatchObject({ pageType: "summary_card" });
  });

  test("flags compact units while preserving learner action and transfer", () => {
    const blueprint = buildContentBlueprint({
      audience: "技术产品经理",
      sourceKind: "patent",
      units: [plannedUnit({ targetPageCount: 6, kind: "chapter", focusConcepts: ["权利要求边界"] })]
    });

    expect(blueprint.globalRules.join("\n")).toContain("少于 8 页");
    expect(blueprint.units[0]?.pageBlueprints).toHaveLength(6);
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual([
      "problem_scene",
      "structure_diagram",
      "interactive_model",
      "quiz",
      "transfer_challenge",
      "summary_card"
    ]);
    expect(blueprint.units[0]?.pageBlueprints[4]).toMatchObject({
      pageType: "transfer_challenge",
      mustInclude: expect.arrayContaining([expect.stringContaining("权利要求边界")])
    });
  });

  test("adds source semantic hints to unit blueprints", () => {
    const blueprint = buildContentBlueprint({
      audience: "研究生学习者",
      sourceKind: "book",
      sourceSemantics: {
        concepts: [],
        keyTerms: [
          { term: "tool feedback", sourceAnchorIds: ["source-001:page-1"] },
          { term: "reflection", sourceAnchorIds: ["source-001:page-2"] }
        ],
        examples: [],
        evidenceHints: [{ id: "e1", statement: "Experiments show reflection improves reliability.", sourceAnchorIds: ["source-001:page-2"] }],
        limitationHints: [{ id: "l1", statement: "Limitations appear when tool feedback is missing.", sourceAnchorIds: ["source-001:page-1"] }],
        misconceptions: [],
        teachingAngles: [],
        sourceSpecificTeachingMoves: ["围绕来源术语 tool feedback 设计预测任务。"]
      },
      units: [plannedUnit({ sourceAnchorIds: ["source-001:page-1", "source-001:page-2"] })]
    });

    expect(blueprint.units[0]?.semanticHints).toMatchObject({
      keyTerms: ["tool feedback", "reflection"],
      evidenceHints: ["Experiments show reflection improves reliability."],
      limitationHints: ["Limitations appear when tool feedback is missing."],
      teachingMoves: ["围绕来源术语 tool feedback 设计预测任务。"]
    });
    expect(blueprint.units[0]?.pageBlueprints[0]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("tool feedback")]));
  });

  test("adds paper research-reading moves for research-level paper units", () => {
    const blueprint = buildContentBlueprint({
      audience: "研究生",
      difficultyLevel: "research",
      sourceKind: "paper",
      units: [plannedUnit({ targetPageCount: 8, kind: "topic", focusConcepts: ["Talker-Reasoner 架构"] })]
    });

    expect(blueprint.globalRules.join("\n")).toContain("论文精读");
    expect(blueprint.globalRules.join("\n")).toContain("研究问题、论文贡献、方法机制、实验/证据、局限/威胁、迁移判断");
    expect(blueprint.units[0]?.pageBlueprints[0]?.mustInclude).toEqual(
      expect.arrayContaining([expect.stringContaining("研究问题"), expect.stringContaining("论文贡献")])
    );
    expect(blueprint.units[0]?.pageBlueprints[2]?.mustInclude).toEqual(
      expect.arrayContaining([expect.stringContaining("方法机制"), expect.stringContaining("方法假设")])
    );
    expect(blueprint.units[0]?.pageBlueprints[4]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("实验/证据")]));
    expect(blueprint.units[0]?.pageBlueprints[5]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("局限/威胁")]));
    expect(blueprint.units[0]?.pageBlueprints[6]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("迁移判断")]));
  });

  test("adds source-kind depth moves for patent and blog units", () => {
    const patentBlueprint = buildContentBlueprint({
      audience: "技术产品经理",
      sourceKind: "patent",
      units: [plannedUnit({ targetPageCount: 8, kind: "topic", focusConcepts: ["缓存一致性专利"] })]
    });
    const blogBlueprint = buildContentBlueprint({
      audience: "工程师",
      sourceKind: "blog",
      units: [plannedUnit({ targetPageCount: 8, kind: "task", focusConcepts: ["Agent 调试流程"] })]
    });

    expect(patentBlueprint.globalRules.join("\n")).toContain("专利解读");
    expect(patentBlueprint.units[0]?.pageBlueprints[0]?.mustInclude).toEqual(
      expect.arrayContaining([expect.stringContaining("权利要求边界"), expect.stringContaining("现有技术问题")])
    );
    expect(patentBlueprint.units[0]?.pageBlueprints[2]?.mustInclude).toEqual(
      expect.arrayContaining([expect.stringContaining("技术方案"), expect.stringContaining("实施例")])
    );
    expect(patentBlueprint.units[0]?.pageBlueprints[5]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("法律/适用边界")]));
    expect(patentBlueprint.units[0]?.pageBlueprints[6]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("规避或迁移判断")]));

    expect(blogBlueprint.globalRules.join("\n")).toContain("实践案例");
    expect(blogBlueprint.units[0]?.pageBlueprints[0]?.mustInclude).toEqual(
      expect.arrayContaining([expect.stringContaining("实际问题"), expect.stringContaining("实践上下文")])
    );
    expect(blogBlueprint.units[0]?.pageBlueprints[2]?.mustInclude).toEqual(
      expect.arrayContaining([expect.stringContaining("作者方案"), expect.stringContaining("实现路径")])
    );
    expect(blogBlueprint.units[0]?.pageBlueprints[5]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("caveat/失败模式")]));
    expect(blogBlueprint.units[0]?.pageBlueprints[6]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("迁移边界")]));
  });

  test("builds professor lecture deck page blueprints when requested", () => {
    const blueprint = buildContentBlueprint({
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      sourceKind: "book",
      courseIntent: "professor_lecture_deck",
      units: [plannedUnit({ targetPageCount: 10, focusConcepts: ["Agentic Design Patterns"] })]
    });

    expect(blueprint.courseIntent).toBe("professor_lecture_deck");
    expect(blueprint.globalRules.join("\n")).toContain("教材式知识链路 Web Deck");
    expect(blueprint.globalRules.join("\n")).toContain("关键链路");
    expect(blueprint.globalRules.join("\n")).toContain("不要生成 PPTX");
    expect(blueprint.globalRules.join("\n")).toContain("knowledgeBoard");
    expect(blueprint.globalRules.join("\n")).toContain("原文命题");
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.lectureRole)).toEqual([
      "course_framing",
      "prerequisite_map",
      "concept_framework",
      "formal_definition",
      "knowledge_link",
      "worked_example",
      "comparison_taxonomy",
      "application_case",
      "boundary_case",
      "summary_map"
    ]);
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual([
      "problem_scene",
      "structure_diagram",
      "structure_diagram",
      "intuition_visual",
      "interactive_model",
      "code_walkthrough",
      "misconception_check",
      "quiz",
      "transfer_challenge",
      "summary_card"
    ]);
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual(
      expect.arrayContaining(["interactive_model", "misconception_check", "quiz", "transfer_challenge", "summary_card"])
    );
    expect(blueprint.units[0]?.pageBlueprints[0]).toMatchObject({
      pageType: "problem_scene",
      teachingMove: expect.stringContaining("核心问题"),
      learnerAction: expect.stringContaining("主线"),
      mustInclude: expect.arrayContaining([expect.stringContaining("本讲定位")])
    });
    expect(blueprint.units[0]?.pageBlueprints[0]?.mustInclude).toEqual(
      expect.arrayContaining(["knowledgeBoard", "coreProposition", "leftColumn", "rightColumn", "sourceTrace", "bottomLine"])
    );
    expect(blueprint.units[0]?.pageBlueprints[7]).toMatchObject({
      pageType: "quiz",
      lectureRole: "application_case",
      mustInclude: expect.arrayContaining([expect.stringContaining("应用案例")])
    });
    expect(blueprint.units[0]?.pageBlueprints[8]).toMatchObject({
      pageType: "transfer_challenge",
      lectureRole: "boundary_case",
      mustInclude: expect.arrayContaining([expect.stringContaining("相邻场景")])
    });
  });

  test("extends professor lecture deck page blueprints to 12 pages when requested", () => {
    const blueprint = buildContentBlueprint({
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      sourceKind: "book",
      courseIntent: "professor_lecture_deck",
      units: [plannedUnit({ targetPageCount: 12, focusConcepts: ["Agentic Design Patterns"] })]
    });

    expect(blueprint.units[0]?.pageBlueprints).toHaveLength(12);
    expect(blueprint.units[0]?.pageBlueprints.slice(0, 10).map((page) => page.lectureRole)).toEqual([
      "course_framing",
      "prerequisite_map",
      "concept_framework",
      "formal_definition",
      "knowledge_link",
      "worked_example",
      "comparison_taxonomy",
      "application_case",
      "boundary_case",
      "summary_map"
    ]);
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual(
      expect.arrayContaining(["interactive_model", "misconception_check"])
    );
  });

  test("keeps compact 6-page professor blueprints aligned with publisher baseline", () => {
    const blueprint = buildContentBlueprint({
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      sourceKind: "book",
      courseIntent: "professor_lecture_deck",
      units: [plannedUnit({ targetPageCount: 6, focusConcepts: ["Agentic Design Patterns"] })]
    });

    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual([
      "problem_scene",
      "interactive_model",
      "misconception_check",
      "quiz",
      "transfer_challenge",
      "summary_card"
    ]);
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual(
      expect.arrayContaining(["problem_scene", "interactive_model", "quiz", "misconception_check", "transfer_challenge", "summary_card"])
    );
  });

  test("keeps 7-page professor blueprints at the requested page count", () => {
    const blueprint = buildContentBlueprint({
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      sourceKind: "book",
      courseIntent: "professor_lecture_deck",
      units: [plannedUnit({ targetPageCount: 7, focusConcepts: ["Agentic Design Patterns"] })]
    });

    expect(blueprint.units[0]?.pageBlueprints).toHaveLength(7);
    expect(blueprint.units[0]?.pageBlueprints.map((page) => page.pageType)).toEqual([
      "problem_scene",
      "structure_diagram",
      "structure_diagram",
      "interactive_model",
      "code_walkthrough",
      "misconception_check",
      "summary_card"
    ]);
  });
});

function plannedUnit(overrides: Partial<PlannedCourseUnit> = {}): PlannedCourseUnit {
  return {
    unitId: "unit-topic-01",
    title: "Agentic Workflow：工具选择",
    kind: "topic",
    lessonId: "agentic-topic-01",
    targetPageCount: 8,
    sourceAnchorIds: ["source-001:page-1", "source-001:page-2"],
    sourceNodeIds: ["source-001:root"],
    conceptIds: ["concept-01"],
    focusConcepts: ["工具选择"],
    transferExpectation: "迁移到新的工程任务。",
    expectedInteractions: ["prediction", "comparison"],
    expectedAssessments: ["misconception_check", "transfer_challenge"],
    expectedSourceCoverage: {
      minSourceAnchorCount: 1,
      preserveChapterRefs: true
    },
    ...overrides
  };
}
