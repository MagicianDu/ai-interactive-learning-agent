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

  test("fails generic board section labels that expose the authoring template", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0]!.knowledgeBoard.leftColumn[0]!.label = "机制链";
    lesson.pages[0]!.knowledgeBoard.rightColumn[0]!.label = "例子 / 证据";

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["template section labels"]));
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

  test("fails rubric phrases and semantic template labels from early lesson-mode regressions", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0]!.title = "总体结构课：定位问题";
    lesson.pages[0]!.narrative =
      "学习者需要看见问题、机制和边界。大学高年级/研究生课程阶段需要把资料问题放进先修概念框架。";
    lesson.pages[0]!.knowledgeBoard.headline = "问题定位：把“定位问题”放回来源和机制中理解";
    lesson.pages[0]!.knowledgeBoard.coreProposition =
      "对研究论文学习来说，关键不是记住一句结论，而是说明该结论由哪个来源片段支撑、经过什么机制成立、在哪些条件下会失效。";
    lesson.pages[0]!.knowledgeBoard.leftColumn = [
      { label: "定位问题的判断入口", items: ["先拆研究问题。", "再看方法机制。"] },
      { label: "定位问题 #01的推理链路", items: ["追问机制假设。", "判断证据能否泛化。"] }
    ];
    lesson.pages[0]!.knowledgeBoard.rightColumn = [
      { label: "定位问题的证据边界", items: ["证据来自 paper:p1。", "边界是不能外推到所有 agent。"] },
      { label: "定位问题 #01的自检问题", items: ["例子说明定位问题。", "反例说明证据不足。"] }
    ];

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(
      expect.arrayContaining(["authoring scaffold language", "template section labels"])
    );
  });

  test("fails exact duplication between page title and board headline", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0]!.knowledgeBoard.headline = lesson.pages[0]!.title;

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["title/headline duplication"]));
  });

  test("fails bottom lines that only repeat the page title", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0]!.knowledgeBoard.bottomLine = lesson.pages[0]!.title;

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["bottomLine repeats title"]));
  });

  test("fails page-role titles even before they repeat across units", () => {
    const lesson = selfStudyLesson();
    lesson.pages[0]!.title = "Prompt Chaining：先看失败";

    const result = evaluateSelfStudyTextbookRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults[0]?.weakItems).toEqual(expect.arrayContaining(["page-role title"]));
  });

  test("passes accepted self-study golden sample title patterns", () => {
    const overview = lessonWithTitles("overview-golden", [
      "Agent 不是模型，而是带目标的执行回路",
      "全书九章其实在回答同一个控制问题",
      "中间产物是 Prompt Chaining 的真正控制点",
      "Routing 让输入先选路，而不是让一个提示处理所有事",
      "Parallelization 的价值是多视角覆盖，不只是跑得更快",
      "Reflection 有用的前提是评审标准足够具体",
      "Tool Use 把语言决定接到外部世界的可验证观察",
      "Planning 和 Memory 解决的是长任务里的状态连续性",
      "Multi-Agent 只有在交付物可合并时才值得使用",
      "读完整本书前，先记住这条设计判断链"
    ]);
    const promptChaining = lessonWithTitles("prompt-chaining-golden", [
      "复杂任务失败时，常见问题不是模型不聪明，而是任务没有被拆开",
      "Chain 成立的前提是后一步真的需要前一步的产物",
      "中间产物要像接口，而不是像一段随意解释",
      "结构化输出是 Prompt Chaining 的止损阀",
      "Prompt Chaining 常和并行处理拼在一起，而不是互相替代",
      "工具调用让 Prompt Chain 从文本流程变成可执行流程",
      "线性 chain 适合管道，但复杂 agent 往往需要图或状态机",
      "选择 chain 前先问：这是依赖链，还是任务清单？",
      "一个好的 Prompt Chain 要把验证点放在步骤之间",
      "记住 Prompt Chaining 的设计判断：拆、传、验、再组合"
    ]);
    const toolUse = lessonWithTitles("tool-use-golden", [
      "LLM 只有接上工具，才从“会说”变成“能做”",
      "Function Calling 不是执行工具，而是生成可执行请求",
      "Tool Definition 是模型理解外部能力的接口说明",
      "Tool Use 的控制链路有六个状态：描述、决定、生成、执行、观察、再处理",
      "工具结果必须回到模型上下文，否则行动不会进入推理",
      "工具调用把风险从“回答错”扩展到“做错事”",
      "不是所有外部能力都适合直接暴露给模型",
      "Tool Use 接外部世界，Chaining 管内部依赖",
      "设计工具型 agent 时，先定义可观察的动作边界",
      "记住 Tool Use 的判断：模型提议，系统执行，结果再进入模型"
    ]);

    expect(evaluateSelfStudyTextbookRubric([overview, promptChaining, toolUse])).toMatchObject({
      status: "passed",
      failedPageCount: 0
    });
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
              label: "可检查步骤",
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

function lessonWithTitles(id: string, titles: string[]): ReturnType<typeof selfStudyLesson> {
  const lesson = selfStudyLesson();
  lesson.id = id;
  lesson.pages = titles.map((title, index) => {
    const pageNumber = index + 1;
    return {
      ...selfStudyLesson().pages[0]!,
      id: `p${pageNumber}`,
      title,
      narrative: `本页解释 ${title}，并说明它在自学链路中的具体判断价值。`,
      sourceAnchorIds: [`book:p${pageNumber}`],
      knowledgeBoard: {
        ...selfStudyLesson().pages[0]!.knowledgeBoard,
        headline: `${title} 应该怎样理解？`,
        coreProposition: `${title}。这不是页面模板角色，而是学习者读完后应该带走的独立判断。第 ${pageNumber} 页说明该判断的机制、例子、证据和边界。`,
        leftColumn: [
          {
            label: "机制说明",
            items: [
              `${title} 对应一个可解释的知识节点，而不是“先看失败”这类作者提示。`,
              "学习者需要知道它解决什么问题、依赖什么前提、和前后概念如何连接。"
            ]
          }
        ],
        rightColumn: [
          {
            label: "例子与边界",
            items: [
              `例如把 ${title} 放进 agent workflow 设计时，要看它如何影响状态、证据或执行顺序。`,
              "边界是：如果这一页只能替换成任意主题名，它就不是合格的自学页面。",
              `来源证据 book:p${pageNumber} 支持这一页的独立判断。`
            ]
          }
        ],
        sourceTrace: [{ anchorId: `book:p${pageNumber}`, supports: `${title} 的来源证据。` }],
        bottomLine: `${title} 是一个可带走的知识判断，不是模板化页面角色。`
      }
    };
  });
  return lesson;
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
