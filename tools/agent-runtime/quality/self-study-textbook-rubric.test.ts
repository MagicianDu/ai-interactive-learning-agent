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

  test("fails repeated knowledge board content inside the same lesson", () => {
    const lesson = selfStudyLesson();
    const firstPage = lesson.pages[0]!;
    lesson.pages.push({
      ...firstPage,
      id: "p2",
      title: "workflow 的第二个知识节点",
      sourceAnchorIds: ["book:p2"],
      knowledgeBoard: {
        ...firstPage.knowledgeBoard,
        sourceTrace: [{ anchorId: "book:p2", supports: "来源同样描述了 workflow 的中间状态。" }]
      }
    });

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.failedPageCount).toBe(2);
    expect(result.pageResults.map((page) => page.weakItems)).toEqual([
      expect.arrayContaining(["repeated knowledgeBoard content"]),
      expect.arrayContaining(["repeated knowledgeBoard content"])
    ]);
  });

  test("fails repeated boards even when visible source anchor labels differ", () => {
    const lesson = selfStudyLesson();
    const firstPage = lesson.pages[0]!;
    firstPage.knowledgeBoard.rightColumn[0]!.items[2] = "来源锚点 book:p1 支持 workflow pattern 的步骤拆分。";
    lesson.pages.push({
      ...firstPage,
      id: "p2",
      title: "workflow 的第二个知识节点",
      sourceAnchorIds: ["book:p2"],
      knowledgeBoard: {
        ...firstPage.knowledgeBoard,
        rightColumn: [
          {
            label: "例子与边界",
            items: [
              "例如资料学习流程可以拆成来源采样、章节映射、页面 authoring、质量审查。",
              "边界是：如果任务本身很短且没有中间状态，workflow 可能只是增加延迟。",
              "来源锚点 book:p2 支持 workflow pattern 的步骤拆分。"
            ]
          }
        ],
        sourceTrace: [{ anchorId: "book:p2", supports: "来源同样描述了 workflow 的中间状态。" }]
      }
    });

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[1]?.weakItems).toEqual(expect.arrayContaining(["repeated knowledgeBoard content"]));
  });

  test("fails authoring scaffold phrases that make pages read like filled templates", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0]!.title = "Prompt Chaining：直观模型";
    lesson.pages[0]!.narrative =
      "直觉模型：本页围绕 Prompt Chaining/chaining 讲一个可自学知识片段。先修概念是 LLM 调用、agent、workflow；来源锚点 book:p1 用来约束本页结论。";
    lesson.pages[0]!.knowledgeBoard.headline = "Prompt Chaining：为什么直观模型";
    lesson.pages[0]!.knowledgeBoard.coreProposition =
      "Prompt Chaining 在 Agentic Design Patterns 章节中的核心命题是：把一个大任务切成有顺序依赖的小步骤。 本页从 用可视化比喻建立第一层理解 入手，把来源命题改写为学生可以直接使用的判断结构。";

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["authoring scaffold language"]));
  });

  test("fails repeated page-role title patterns across generated units", () => {
    const first = templatedLesson("prompt-chaining", "Prompt Chaining");
    const second = templatedLesson("routing", "Routing");
    const third = templatedLesson("reflection", "Reflection");

    const result = evaluateSelfStudyTextbookRubric([first, second, third]);

    expect(result.status).toBe("failed");
    expect(result.pageResults.filter((page) => page.weakItems.includes("repeated page-role title pattern")).length).toBeGreaterThanOrEqual(9);
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

function templatedLesson(id: string, topic: string): ReturnType<typeof selfStudyLesson> {
  const lesson = selfStudyLesson();
  const roles = ["先看失败", "直观模型", "结构与术语"];
  lesson.id = id;
  lesson.pages = roles.map((role, index) => ({
    ...selfStudyLesson().pages[0]!,
    id: `p${index + 1}`,
    title: `${topic}：${role}`,
    narrative: `${role}：本页围绕 ${topic} 讲一个可自学知识片段。来源锚点 book:p${index + 1} 用来约束本页结论。`,
    sourceAnchorIds: [`book:p${index + 1}`],
    knowledgeBoard: {
      ...selfStudyLesson().pages[0]!.knowledgeBoard,
      headline: `${topic}：为什么${role}`,
      coreProposition: `${topic} 在章节中的核心命题是：让 agent workflow 更可观察。 本页从 ${role} 入手，把来源命题改写为学生可以直接使用的判断结构。`,
      sourceTrace: [{ anchorId: `book:p${index + 1}`, supports: `${topic} 来源支持。` }],
      bottomLine: `理解 ${topic} 的 ${role}，需要回到状态、证据和边界。`
    }
  }));
  return lesson;
}
