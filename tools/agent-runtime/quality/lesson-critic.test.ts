import { describe, expect, test } from "vitest";

import { createRunConfigFromArgs } from "../run-config.js";
import { buildLessonCriticReport } from "./lesson-critic.js";

describe("lesson critic", () => {
  test("blocks source-backed lessons when page-level source evidence is unsupported", () => {
    const config = createRunConfigFromArgs({
      run: "critic-source-evidence",
      sourceFile: "/tmp/source.md",
      sourceKind: "book",
      unitPages: "5"
    });
    const report = buildLessonCriticReport(
      {
        id: "lesson-1",
        config: { targetPageCount: 5 },
        sourceContext: { sourceAnchorIds: ["source-001:page-1"] },
        learningObjectives: ["解释来源证据"],
        misconceptions: [{ id: "m1", statement: "摘要等于理解", correction: "需要来源和机制" }],
        transferTasks: [{ id: "t1", prompt: "迁移", targetMentalModel: "来源到机制" }],
        summary: ["来源证据"],
        pages: [
          buildPage("p1", "problem_scene", { sourceAnchorIds: ["source-001:page-1"], visualSpec: true }),
          buildPage("p2", "interactive_model", { sourceAnchorIds: ["source-001:page-1"], interactionSpec: true }),
          buildPage("p3", "interactive_model", { sourceAnchorIds: ["source-001:page-1"], interactionSpec: true }),
          buildPage("p4", "quiz", { sourceAnchorIds: ["source-001:page-1"], assessmentSpec: true }),
          buildPage("p5", "misconception_check", { assessmentSpec: true })
        ]
      },
      config
    );

    expect(report.status).toBe("revision_required");
    expect(report.sourceEvidence).toMatchObject({
      status: "failed",
      unsupportedPageRefs: ["lesson-1:p5"]
    });
    expect(report.blockingFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "source-evidence",
          path: "sourceEvidence.unsupportedPageRefs"
        })
      ])
    );
  });
});

function buildPage(
  id: string,
  type: string,
  options: { sourceAnchorIds?: string[]; visualSpec?: boolean; interactionSpec?: boolean; assessmentSpec?: boolean }
): Record<string, unknown> {
  return {
    id,
    type,
    title: `${id} 来源证据`,
    learningGoal: "解释来源证据",
    narrative: "用来源证据建立机制理解。",
    ...(options.sourceAnchorIds ? { sourceAnchorIds: options.sourceAnchorIds } : {}),
    ...(options.visualSpec ? { visualSpec: { kind: "diagram", description: "来源图", keyElements: ["来源"] } } : {}),
    ...(options.interactionSpec
      ? {
          interactionSpec: {
            kind: "choice",
            learnerAction: "选择来源",
            expectedObservation: "看到来源支持",
            cognitivePurpose: "建立来源证据意识",
            options: [{ id: "a", label: "来源", explanation: "来源支持该解释。" }]
          }
        }
      : {}),
    ...(options.assessmentSpec
      ? {
          assessmentSpec: { kind: "multiple_choice", prompt: "哪项有来源？", options: ["A"], correctAnswer: "A" },
          feedbackSpec: { correctFeedback: "有来源。", incorrectFeedback: "需要补来源。" }
        }
      : {})
  };
}
