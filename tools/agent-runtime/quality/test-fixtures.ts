type TestKnowledgeBoardKind =
  | "definition_board"
  | "mechanism_board"
  | "evidence_board"
  | "example_board"
  | "comparison_board"
  | "boundary_board"
  | "synthesis_board";

type TestBoardSectionEmphasis = "definition" | "mechanism" | "example" | "boundary" | "note";

type TestKnowledgeBoard = {
  boardKind: TestKnowledgeBoardKind;
  headline: string;
  coreProposition: string;
  leftColumn: Array<{ label: string; items: string[]; emphasis?: TestBoardSectionEmphasis }>;
  rightColumn: Array<{ label: string; items: string[]; emphasis?: TestBoardSectionEmphasis }>;
  sourceTrace: Array<{ anchorId: string; supports: string }>;
  bottomLine: string;
};

type TestLesson = Record<string, unknown> & {
  config: { targetPageCount: number; minPageCount: number; maxPageCount: number };
  pages: TestPage[];
};

type TestPage = Record<string, unknown> & {
  interactionSpec?: {
    kind: string;
    learnerAction: string;
    expectedObservation: string;
    cognitivePurpose: string;
    options?: Array<{
      id: string;
      label: string;
      resultTitle: string;
      outcomeId: string;
      resultTone: string;
      explanation: string;
    }>;
  };
  knowledgeBoard?: TestKnowledgeBoard;
};

export function buildCompleteLesson(): TestLesson {
  return {
    id: "hash-table",
    title: "哈希表为什么快",
    audience: "中文学习者",
    config: {
      targetPageCount: 9,
      minPageCount: 6,
      maxPageCount: 10
    },
    prerequisites: ["会写简单代码"],
    learningObjectives: ["解释哈希表访问路径"],
    pages: [
      page("p1", "problem_scene", { visual: true }),
      page("p2", "intuition_visual", { visual: true }),
      page("p3", "structure_diagram", { visual: true }),
      page("p4", "interactive_model", { interaction: true }),
      page("p5", "interactive_model", { interaction: true }),
      page("p6", "quiz", { assessment: true }),
      page("p7", "misconception_check", { assessment: true }),
      page("p8", "transfer_challenge", { assessment: true }),
      page("p9", "summary_card", { visual: true })
    ],
    misconceptions: [{ id: "m1", statement: "哈希表永远 O(1)", correction: "冲突严重时会变慢。" }],
    transferTasks: [{ id: "t1", prompt: "迁移到缓存 key 设计", targetMentalModel: "用搜索空间缩小解释加速。" }],
    summary: ["哈希表用 key 缩小搜索空间。"]
  } as TestLesson;
}

export function publishableLessonFixture({
  id = "hash-table",
  targetPageCount = 8,
  title = "哈希表为什么快"
}: {
  id?: string;
  title?: string;
  targetPageCount?: number;
} = {}): TestLesson {
  const pages = [
    page("p1", "problem_scene", { visual: true }),
    page("p2", "intuition_visual", { visual: true }),
    page("p3", "structure_diagram", { visual: true }),
    page("p4", "interactive_model", { interaction: true }),
    page("p5", "interactive_model", { interaction: true }),
    page("p6", "quiz", { assessment: true }),
    page("p7", "misconception_check", { assessment: true }),
    page("p8", "summary_card", { visual: true })
  ];

  return {
    id,
    title,
    audience: "有编程基础但缺少系统心智模型的中文学习者",
    config: {
      targetPageCount,
      minPageCount: Math.min(6, targetPageCount),
      maxPageCount: Math.max(10, targetPageCount)
    },
    prerequisites: ["会写简单代码"],
    learningObjectives: ["解释哈希表访问路径"],
    pages: pages.slice(0, targetPageCount),
    misconceptions: [{ id: "m1", statement: "哈希表永远 O(1)", correction: "冲突严重时会变慢。" }],
    transferTasks: [{ id: "t1", prompt: "迁移到缓存 key 设计", targetMentalModel: "用搜索空间缩小解释加速。" }],
    summary: ["哈希表用 key 缩小搜索空间。"]
  } as TestLesson;
}

export function professorBoardLessonFixture({
  id = "professor-board",
  targetPageCount = 8,
  title = "Agentic Workflow 教授板书"
}: {
  id?: string;
  title?: string;
  targetPageCount?: number;
} = {}): TestLesson {
  const base = publishableLessonFixture({ id, title, targetPageCount });
  return {
    ...base,
    displayMode: "textbook_deck",
    audience: "大学/研究生课程式中文学习者",
    prerequisites: ["理解 LLM 输出不确定性", "理解 workflow 可以拆成状态和动作"],
    learningObjectives: ["解释知识节点", "沿关键链路复述机制", "识别边界条件"],
    pages: base.pages.map((pageItem, index) => ({
      ...pageItem,
      title: `${pageItem.title} · 知识板书`,
      narrative: "本页以知识板书方式呈现命题、机制、证据和结论。",
      sourceAnchorIds: [`source-001:page-${index + 1}`],
      grounding: { kind: "source", note: "测试来源锚点" },
      knowledgeBoard: {
        boardKind: index === base.pages.length - 1 ? "synthesis_board" : "mechanism_board",
        headline: "从来源命题重构知识链路",
        coreProposition: "Agentic workflow 的质量来自显式状态、证据检查和失败恢复。",
        leftColumn: [
          {
            label: "概念链",
            emphasis: "mechanism",
            items: ["任务压力", "控制结构", "中间状态", "失败恢复"]
          },
          {
            label: "拆解",
            emphasis: "definition",
            items: ["把单次回答拆成可检查步骤", "把隐含推理变成显式记录"]
          }
        ],
        rightColumn: [
          {
            label: "例子",
            emphasis: "example",
            items: ["资料采样", "章节映射", "单元生成", "质量审查"]
          },
          {
            label: "边界",
            emphasis: "boundary",
            items: ["短任务不一定需要 workflow", "无状态记录的多 agent 只是 prompt 堆叠"]
          }
        ],
        sourceTrace: [
          {
            anchorId: `source-001:page-${index + 1}`,
            supports: "来源支持本页关于 workflow 拆解和显式状态的讲解。"
          }
        ],
        bottomLine: "板书页要同时给出命题、机制、例子和边界。"
      }
    }))
  } as TestLesson;
}

function page(
  id: string,
  type: string,
  options: { visual?: boolean; interaction?: boolean; assessment?: boolean }
): TestPage {
  return {
    id,
    type,
    title: `${id} 中文页`,
    learningGoal: id === "p1" ? "解释哈希表访问路径，建立中文心智模型" : "建立中文心智模型",
    narrative: "这是一段中文解释。",
    ...(options.visual
      ? {
          visualSpec: {
            kind: "diagram",
            description: "中文图示",
            keyElements: ["元素一", "元素二"]
          }
        }
      : {}),
    ...(options.interaction
      ? {
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
                explanation: "因为 key 能缩小候选范围。"
              }
            ]
          }
        }
      : {}),
    ...(options.assessment
      ? {
          assessmentSpec: {
            kind: "multiple_choice",
            prompt: "哪种情况更适合索引？",
            options: ["高选择性查询", "全表都要读"],
            correctAnswer: "高选择性查询"
          },
          feedbackSpec: {
            correctFeedback: "正确，因为候选范围显著缩小。",
            incorrectFeedback: "不对，这忽略了选择性。"
          }
        }
      : {})
  };
}
