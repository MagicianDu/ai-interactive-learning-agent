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
