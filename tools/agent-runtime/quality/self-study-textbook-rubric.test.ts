import { describe, expect, test } from "vitest";

import { evaluateSelfStudyTextbookRubric } from "./self-study-textbook-rubric.js";

describe("evaluateSelfStudyTextbookRubric", () => {
  test("passes dense student-facing knowledge board pages", () => {
    expect(evaluateSelfStudyTextbookRubric([selfStudyLesson()])).toMatchObject({
      status: "passed",
      failedPageCount: 0
    });
  });

  test("fails teacher-facing template language", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0]!.knowledgeBoard.headline = "本讲定位：识别本页中的作用";

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["teacher-facing language"]));
  });

  test("fails pages without examples evidence or boundaries", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0]!.knowledgeBoard.rightColumn = [{ label: "说明", items: ["概念很重要", "需要理解"] }];

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["example/evidence/boundary"]));
  });
});

function selfStudyLesson(): {
  id: string;
  pages: Array<{
    id: string;
    type: string;
    title: string;
    learningGoal: string;
    narrative: string;
    sourceAnchorIds: string[];
    knowledgeBoard: {
      boardKind: string;
      headline: string;
      coreProposition: string;
      leftColumn: Array<{ label: string; items: string[] }>;
      rightColumn: Array<{ label: string; items: string[] }>;
      sourceTrace: Array<{ anchorId: string; supports: string }>;
      bottomLine: string;
    };
  }>;
} {
  return {
    id: "self-study-agentic-pattern",
    pages: [
      {
        id: "p1",
        type: "structure_diagram",
        title: "为什么 agent workflow 需要显式步骤？",
        learningGoal: "理解 workflow 把不可靠的大任务拆成可检查步骤。",
        narrative: "本页解释显式步骤如何降低失败不可见的问题。",
        sourceAnchorIds: ["book:p1"],
        knowledgeBoard: {
          boardKind: "mechanism_board",
          headline: "为什么一个大提示不如可检查的 workflow？",
          coreProposition: "Agent workflow 的核心价值不是把提示写长，而是把任务拆成多个可观察、可恢复、可调整的中间步骤。",
          leftColumn: [
            {
              label: "机制链",
              items: [
                "大任务先被拆成多个短步骤，每一步都有明确输入和输出。",
                "中间输出让系统能发现偏差，而不是等最终答案失败后才知道。",
                "失败恢复可以从具体步骤开始，而不是重跑整个任务。"
              ]
            }
          ],
          rightColumn: [
            {
              label: "例子与边界",
              items: [
                "例如资料学习流程可以拆成来源采样、章节映射、页面 authoring、质量审查。",
                "边界是：如果任务本身很短且没有中间状态，workflow 可能只是增加延迟。",
                "来源证据支持 workflow pattern 通常围绕可组合步骤展开。"
              ]
            }
          ],
          sourceTrace: [{ anchorId: "book:p1", supports: "来源描述了 workflow pattern 通过拆分步骤组织 agent 行为。" }],
          bottomLine: "自学时要记住：workflow 的作用是让复杂任务拥有可检查的中间状态。"
        }
      }
    ]
  };
}
