import type { Lesson } from "../../schemas/lesson.schema";

export const generatedLesson = {
  id: "demo-agentic-design-grounded-topic-01",
  title: "Agentic Design Patterns中文课程：agent loop",
  audience: "有编程基础但缺少智能体系统心智模型的中文学习者",
  config: {
    targetPageCount: 8,
    minPageCount: 6,
    maxPageCount: 10
  },
  sourceContext: {
    sourcePath: "/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf",
    sourceKind: "book",
    sourceAnchorIds: [
      "source-001:paragraph-page-3-2",
      "source-001:paragraph-page-3-3",
      "source-001:page-4",
      "source-001:paragraph-page-4-1"
    ],
    chapterRefs: undefined,
    conceptIds: [
      "concept-01",
      "concept-02",
      "concept-03",
      "concept-04",
      "concept-05"
    ]
  },
  prerequisites: [
    "能阅读基础技术材料",
    "希望通过中文互动课程建立可迁移心智模型"
  ],
  learningObjectives: [
    "解释Agentic Design Patterns中文课程：agent loop的核心问题和来源依据",
    "用可视化结构说明agent loop如何发挥作用",
    "通过行动、反馈和迁移任务检查理解是否可靠"
  ],
  pages: [
    {
      id: "page-01",
      type: "problem_scene",
      title: "Agentic Design Patterns中文课程：agent loop：先看学习问题",
      learningGoal: "识别这份资料最需要解决的理解问题",
      narrative: "Agentic Design Patterns中文课程：agent loop 不能只被压缩成摘要；学习者需要看见问题、机制和边界。",
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      visualSpec: {
        kind: "diagram",
        description: "用中文图示展示来源、结构、行动和反馈之间的关系。",
        keyElements: [
          "来源依据",
          "核心机制",
          "学习动作",
          "反馈",
          "迁移"
        ]
      }
    },
    {
      id: "page-02",
      type: "intuition_visual",
      title: "先画来源地图，再进入细节",
      learningGoal: "用地图直觉理解总览课",
      narrative: "把资料看成一张地图：先知道核心区域，再决定深入 agent loop。",
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      visualSpec: {
        kind: "diagram",
        description: "用中文图示展示来源、结构、行动和反馈之间的关系。",
        keyElements: [
          "来源依据",
          "核心机制",
          "学习动作",
          "反馈",
          "迁移"
        ]
      }
    },
    {
      id: "page-03",
      type: "structure_diagram",
      title: "问题、机制、证据、边界",
      learningGoal: "看见可靠解释的结构",
      narrative: "可靠学习路径要把 agent loop、全局地图、tool use 放进同一张结构图。",
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      visualSpec: {
        kind: "diagram",
        description: "用中文图示展示来源、结构、行动和反馈之间的关系。",
        keyElements: [
          "来源依据",
          "核心机制",
          "学习动作",
          "反馈",
          "迁移"
        ]
      }
    },
    {
      id: "page-04",
      type: "interactive_model",
      title: "选择下一步学习路径",
      learningGoal: "通过选择理解学习顺序",
      narrative: "新手行动提示：先选一个你最不确定的概念，再查看它连接了哪些来源依据。",
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择下一步学习路径",
        expectedObservation: "看到先总览、先机制或先误区会带来不同理解成本。",
        cognitivePurpose: "让学习者根据自己的知识水平选择合适阅读路径。",
        options: [
          {
            id: "overview-first",
            label: "先看总览",
            resultTitle: "适合建立全局地图",
            outcomeId: "overview-path",
            resultTone: "success",
            explanation: "总览能先降低迷路成本，再进入具体 topic。"
          },
          {
            id: "edge-first",
            label: "先看误区",
            resultTitle: "适合有基础的学习者",
            outcomeId: "edge-path",
            resultTone: "neutral",
            explanation: "如果已有背景，先看误区可以快速暴露薄弱心智模型。"
          }
        ]
      }
    },
    {
      id: "page-05",
      type: "interactive_model",
      title: "判断解释是否可靠",
      learningGoal: "用来源和反馈校验解释",
      narrative: "学习者判断一个说法是否既有来源依据，也说明了因果机制和适用边界。",
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择一个解释是否可靠",
        expectedObservation: "看到解释是否同时具备来源依据、因果机制和适用边界。",
        cognitivePurpose: "训练学习者把资料证据和心智模型连接起来。",
        options: [
          {
            id: "grounded",
            label: "有来源、有机制、有边界",
            resultTitle: "可靠解释",
            outcomeId: "grounded-claim",
            resultTone: "success",
            explanation: "这个选择更稳，因为它不是只复述结论，而是说明依据、机制和限制。"
          },
          {
            id: "loose",
            label: "只有一句结论",
            resultTitle: "需要补证据",
            outcomeId: "loose-claim",
            resultTone: "warning",
            explanation: "只有结论会让学习者以为自己懂了，但缺少来源和因果链。"
          }
        ]
      }
    },
    {
      id: "page-06",
      type: "quiz",
      title: "哪种理解更可靠",
      learningGoal: "检查是否区分摘要和心智模型",
      narrative: "先做预测，再用反馈修正学习策略。",
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "哪种学习结果最能说明你建立了心智模型？",
        options: [
          "能把机制迁移到新问题",
          "记住了更多原文句子"
        ],
        correctAnswer: "能把机制迁移到新问题"
      },
      feedbackSpec: {
        correctFeedback: "正确。迁移说明你抓住了机制，而不是只记住表述。",
        incorrectFeedback: "不对。记住原文有帮助，但不能单独证明你能应用机制。"
      }
    },
    {
      id: "page-07",
      type: "misconception_check",
      title: "误区：资料越长越难学",
      learningGoal: "识别资料长度误区",
      narrative: "难点通常不是页数，而是没有把概念、例子、边界和行动连接起来。",
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "资料很长时，最容易出现的学习误区是什么？",
        options: [
          "以为摘要越完整就越懂",
          "先找来源依据和概念结构"
        ],
        correctAnswer: "以为摘要越完整就越懂"
      },
      feedbackSpec: {
        correctFeedback: "正确。摘要只是入口，真正理解还需要动作、反馈和迁移。",
        incorrectFeedback: "不对。先找来源和结构是降低复杂度的有效方法。"
      }
    },
    {
      id: "page-08",
      type: "summary_card",
      title: "总览记忆卡",
      learningGoal: "压缩可迁移学习模型",
      narrative: "用五步记住这课：问题、来源、结构、行动、迁移。",
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      visualSpec: {
        kind: "diagram",
        description: "用中文图示展示来源、结构、行动和反馈之间的关系。",
        keyElements: [
          "来源依据",
          "核心机制",
          "学习动作",
          "反馈",
          "迁移"
        ]
      }
    }
  ],
  misconceptions: [
    {
      id: "misconception-summary",
      statement: "读完摘要就等于理解了资料。",
      correction: "理解需要把来源证据、机制、操作动作、反馈和迁移场景连接起来。"
    }
  ],
  transferTasks: [
    {
      id: "transfer-new-source",
      prompt: "把同一套问题、结构、行动、反馈方法迁移到另一份技术资料。",
      targetMentalModel: "先定位来源依据，再抽象机制，最后用新场景检验。"
    }
  ],
  summary: [
    "Agentic Design Patterns中文课程：agent loop 的学习重点是先建立来源地图，再进入机制。",
    "每个可靠解释都应该连接来源锚点、因果链和适用边界。",
    "能在新材料中复用这套判断方式，才说明心智模型真正形成。"
  ]
} satisfies Lesson;
