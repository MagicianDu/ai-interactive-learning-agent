import type { Lesson } from "../../schemas/lesson.schema";

export const generatedLesson = {
  id: "demo-course-pack-unit-topic-01",
  title: "Agentic Design Patterns 示例课程包：核心机制",
  audience: "有基础编程经验但缺少智能体系统心智模型的中文学习者",
  config: {
    targetPageCount: 8,
    minPageCount: 6,
    maxPageCount: 10
  },
  prerequisites: [
    "理解大模型可以根据上下文生成文本",
    "知道工具调用会读写外部环境"
  ],
  learningObjectives: [
    "解释智能体为什么需要观察、计划、行动和反馈循环",
    "区分模型推理、工具执行和结果验证的边界",
    "判断任务适合单智能体还是多智能体协作",
    "说明人工审核和评估如何降低自动化风险"
  ],
  pages: [
    {
      id: "page-01",
      type: "problem_scene",
      title: "一次生成为什么不可控",
      learningGoal: "感受复杂任务需要过程控制",
      narrative: "先看一个真实问题：让模型一次性读资料、设计课程、写代码和自检，错误很容易在后续步骤放大。",
      visualSpec: {
        kind: "diagram",
        description: "把复杂任务拆成可观察的中间产物。",
        keyElements: [
          "用户目标",
          "中间产物",
          "审核点"
        ]
      }
    },
    {
      id: "page-02",
      type: "intuition_visual",
      title: "从独角戏到可审核流水线",
      learningGoal: "建立角色分工和检查点的直觉",
      narrative: "可控系统不是让一个模型一次说完，而是让任务沿着可检查的流水线推进。",
      visualSpec: {
        kind: "diagram",
        description: "对比一次性输出和分阶段交付。",
        keyElements: [
          "一次性生成",
          "角色分工",
          "产物审核"
        ]
      }
    },
    {
      id: "page-03",
      type: "structure_diagram",
      title: "任务、工具、记忆和审核点",
      learningGoal: "看见智能体系统的关键部件",
      narrative: "智能体围绕任务目标调用工具，读写状态，并在关键节点接受审核。",
      visualSpec: {
        kind: "diagram",
        description: "展示任务、工具、记忆、评估和人工审核之间的关系。",
        keyElements: [
          "任务目标",
          "工具",
          "记忆",
          "审核"
        ]
      }
    },
    {
      id: "page-04",
      type: "process_animation",
      title: "观察-计划-行动-反馈循环",
      learningGoal: "理解智能体为什么要根据结果修正计划",
      narrative: "每次行动之后都要观察结果，再决定继续、修正还是请求人工判断。",
      visualSpec: {
        kind: "animation",
        description: "展示智能体执行循环的状态变化。",
        keyElements: [
          "观察",
          "计划",
          "行动",
          "反馈"
        ]
      }
    },
    {
      id: "page-05",
      type: "interactive_model",
      title: "选择任务分派方式",
      learningGoal: "判断什么时候需要多角色协作",
      narrative: "学习者选择单智能体或分角色执行，系统解释速度、质量和协调成本。",
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择任务分派方式",
        expectedObservation: "看到单智能体和多智能体在成本、检查点和质量风险上的差异。",
        cognitivePurpose: "通过比较分派策略，理解多智能体协作的收益和协调成本。",
        options: [
          {
            id: "single-agent",
            label: "单智能体连续执行",
            resultTitle: "速度快但检查点少",
            outcomeId: "single-agent-path",
            resultTone: "warning",
            explanation: "适合低风险短任务；复杂资料处理容易缺少中间验证。"
          },
          {
            id: "role-split",
            label: "按角色拆分并审核",
            resultTitle: "更可控但协调成本更高",
            outcomeId: "role-split-path",
            resultTone: "success",
            explanation: "适合多文件、多阶段任务，因为每个中间产物都能被检查和修订。"
          }
        ]
      }
    },
    {
      id: "page-06",
      type: "interactive_model",
      title: "判断是否需要人工审核",
      learningGoal: "把风险和可逆性纳入流程设计",
      narrative: "学习者决定是否在关键产物后加入审核，系统解释为什么某些动作不能直接自动放行。",
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择是否加入人工审核",
        expectedObservation: "看到高风险步骤在审核后再进入下一阶段。",
        cognitivePurpose: "把风险、可逆性和证据质量纳入自动化流程设计。",
        options: [
          {
            id: "skip-review",
            label: "跳过审核继续执行",
            resultTitle: "速度提升但错误会传递",
            outcomeId: "skip-review",
            resultTone: "warning",
            explanation: "如果中间产物错误，后续课程、代码和测试都会建立在错误假设上。"
          },
          {
            id: "review-gate",
            label: "加入审核门槛",
            resultTitle: "节奏变慢但风险下降",
            outcomeId: "review-gate",
            resultTone: "success",
            explanation: "审核点让系统在关键决策前确认来源、边界和质量。"
          }
        ]
      }
    },
    {
      id: "page-07",
      type: "quiz",
      title: "工具调用为什么不等于可靠执行",
      learningGoal: "检查是否能区分动作完成和结果正确",
      narrative: "能调用工具只说明动作发生了，不说明目标已经正确达成。",
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "智能体成功调用写文件工具后，下一步最应该做什么？",
        options: [
          "直接结束",
          "观察结果并验证是否符合目标",
          "再随机调用一个工具"
        ],
        correctAnswer: "观察结果并验证是否符合目标"
      },
      feedbackSpec: {
        correctFeedback: "正确，可靠执行依赖观察、验证和必要的修正。",
        incorrectFeedback: "不对，工具调用只是动作，结果仍然需要验证。"
      }
    },
    {
      id: "page-08",
      type: "misconception_check",
      title: "智能体越多越好吗",
      learningGoal: "识别多智能体协作的协调成本",
      narrative: "多角色可以提高覆盖面，但如果边界不清，会制造重复、冲突和审核负担。",
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "什么时候更适合引入多智能体？",
        options: [
          "任务可以拆成清晰角色且产物可审核",
          "任何任务都越多越好",
          "只要模型足够大就不需要边界"
        ],
        correctAnswer: "任务可以拆成清晰角色且产物可审核"
      },
      feedbackSpec: {
        correctFeedback: "正确，多智能体价值来自清晰分工和可审核产物。",
        incorrectFeedback: "不对，多智能体会带来协调成本，需要明确边界。"
      }
    }
  ],
  misconceptions: [
    {
      id: "misconception-more-agents",
      statement: "智能体数量越多，系统一定越可靠",
      correction: "更多智能体会增加协调成本，只有任务边界清晰、产物可检查时才有价值。"
    },
    {
      id: "misconception-tool-call",
      statement: "能调用工具就等于执行可靠",
      correction: "工具只负责动作，可靠性还依赖输入约束、结果观察、错误处理和审核。"
    },
    {
      id: "misconception-one-shot",
      statement: "一次完整生成可以替代过程验证",
      correction: "真实任务需要在关键产物后设置检查点，避免错误在后续步骤放大。"
    }
  ],
  transferTasks: [
    {
      id: "transfer-paper-workflow",
      prompt: "把一本技术书拆成总览、topic 拆课和审核流程",
      targetMentalModel: "用任务边界、共享产物和审核点设计可控协作。"
    },
    {
      id: "transfer-patent-review",
      prompt: "把专利解读任务拆成来源提取、概念映射、误区检查和教师版材料",
      targetMentalModel: "让不同角色围绕可验证中间产物协作，而不是堆叠一次性生成。"
    }
  ],
  summary: [
    "智能体系统的核心是可观察、可修正的执行循环",
    "工具调用必须配合验证和审核",
    "多智能体协作要先定义任务边界和交付物"
  ]
} satisfies Lesson;
