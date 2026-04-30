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
