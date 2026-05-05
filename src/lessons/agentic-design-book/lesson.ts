import type { Lesson } from "../../schemas/lesson.schema";

export const generatedLesson = {
  id: "agentic-design-book",
  title: "Agent Workflow Patterns：可控协作式智能体系统",
  audience: "具备基础技术背景、希望通过中文互动课程建立心智模型的学习者。",
  config: {
    targetPageCount: 12,
    minPageCount: 10,
    maxPageCount: 14
  },
  prerequisites: [
    "能区分“任务”“执行步骤”和“输出结果”。",
    "能读懂常见技术概念如 API、检索、提示词。",
    "理解“失败/重试/回退”在系统设计中的作用。"
  ],
  learningObjectives: [
    "建立从任务分解、路由到反馈修正的 Agentic 思维链。",
    "理解并行与串行在不同依赖条件下的选择逻辑。",
    "识别 tool-use、MCP、RAG 在生产链路中的协作位置。",
    "理解 HITL 与监控闭环在治理中的作用。",
    "把“先建模再决策”的规则迁移到你自己的项目。"
  ],
  pages: [
    {
      id: "p01-problem-fragmented-orchestration",
      type: "problem_scene",
      title: "问题场景：智能体任务为什么像卡在“黑盒快递线”?",
      learningGoal: "意识到复杂任务失败常来自结构碎片化而非模型能力不足。",
      narrative: "一个用户请求要同时涉及检索、过滤、计算和写库。当前链路缺少统一路由，结果是重复调用、上下文丢失、结果前后不一致。",
      visualSpec: {
        kind: "diagram",
        description: "展示单一请求在多个不协调节点重复穿梭，耗时膨胀。",
        keyElements: [
          "未分解任务",
          "重复转接",
          "缺少状态",
          "重复调用",
          "延迟抖动"
        ],
        component: "summary"
      },
      interactionSpec: {
        kind: "prediction",
        learnerAction: "预测造成延迟的核心瓶颈在哪一段。",
        expectedObservation: "你会发现缺少路由和状态管理比模型本身更易成为瓶颈。",
        cognitivePurpose: "建立“结构比能力更先到位”的心智模型。"
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "面对复杂请求，最先优化哪一层通常收益最大？",
        options: [
          "提高模型参数规模",
          "先做任务路由与状态骨架",
          "给模型更多上下文 token",
          "无限制增加并发"
        ],
        correctAnswer: "先做任务路由与状态骨架"
      },
      feedbackSpec: {
        correctFeedback: "对。没有路由与状态，模型能力很难持续产出稳定输出。",
        incorrectFeedback: "参数和 token 并不先解决流程失配问题，先做可控的执行骨架更关键。"
      }
    },
    {
      id: "p02-intuition-book-index",
      type: "intuition_visual",
      title: "直觉：像查书目索引一样先找“入口”",
      learningGoal: "从“猜路线”转向“先建入口规则”。",
      narrative: "先查目录和索引再去读正文，可把检索空间从“所有可能”缩小到“可能更高的一组路径”。",
      visualSpec: {
        kind: "table",
        description: "对比先查入口与直接逐页翻找的路径长度差异。",
        keyElements: [
          "用户请求",
          "路由目录",
          "候选分支",
          "任务执行节点",
          "成功率与耗时"
        ]
      },
      interactionSpec: {
        kind: "prediction",
        learnerAction: "判断在该场景应先匹配哪类入口。",
        expectedObservation: "高价值且明确的入口能更快让系统收敛。",
        cognitivePurpose: "让入口策略先于细节执行。"
      },
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "在任务流中建立入口规则的直接收益通常是：",
        options: [
          "减少模型参数浪费",
          "减少不必要的尝试分支",
          "提高单次调用 token 上限",
          "消除所有故障"
        ],
        correctAnswer: "减少不必要的尝试分支"
      },
      feedbackSpec: {
        correctFeedback: "对，入口规则先筛掉大量低价值路径，剩下分支更容易走稳。",
        incorrectFeedback: "入口规则是削减分支的手段，而不是万能替代治理与错误恢复。"
      }
    },
    {
      id: "p03-agent-architecture-map",
      type: "structure_diagram",
      title: "结构图：单体思考到多智能体协作",
      learningGoal: "区分“谁负责决策、谁负责执行、谁负责监控”的职责边界。",
      narrative: "多智能体不等于堆组件，而是明确职责边界并定义清晰汇总与冲突处理逻辑。",
      visualSpec: {
        kind: "architecture",
        description: "展示主控层、子代理、工具层、记忆层、反馈层间的数据流。",
        keyElements: [
          "协调器",
          "子代理",
          "工具层",
          "记忆层",
          "反馈监控"
        ]
      },
      interactionSpec: {
        kind: "build_from_parts",
        learnerAction: "将“主控/执行/监控”按职责拖拽成架构图。",
        expectedObservation: "你会看到职责不清时容易出现环路和重复执行。",
        cognitivePurpose: "在视觉上确认系统边界后再谈并发和工具设计。"
      },
      assessmentSpec: {
        kind: "true_false",
        prompt: "多智能体协作主要是多“模型”，而不是多“职责”。",
        options: [
          "是",
          "否"
        ],
        correctAnswer: "否"
      },
      feedbackSpec: {
        correctFeedback: "对。职责边界与协调协议才是协作系统稳定性的核心。",
        incorrectFeedback: "即便使用单一模型，责任分离也能带来更清晰协同。"
      }
    },
    {
      id: "p04-process-prompt-chain",
      type: "process_animation",
      title: "过程：提示链如何推进并自我修正",
      learningGoal: "把提示链理解为“可观测的执行工作流”。",
      narrative: "任务先拆解，再逐步执行子任务，每步都可被验证；必要时反思并改写下一步策略。",
      visualSpec: {
        kind: "flow",
        description: "展示步骤推进、失败检测、回到前序步骤的回路。",
        keyElements: [
          "输入任务",
          "Prompt Chaining",
          "执行",
          "验证",
          "Reflection",
          "回滚/重试"
        ]
      },
      interactionSpec: {
        kind: "stepper",
        learnerAction: "逐步触发每个链路步骤并判断是否需要反思。",
        expectedObservation: "错误不一定在最后一步暴露，可能在中间步骤早被检测到。",
        cognitivePurpose: "形成“先验证后前进”的执行心智。"
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "如果子步骤输出与目标偏离，最佳动作是：",
        options: [
          "直接跳过该步骤进入下一步",
          "回到该链路并重写中间策略",
          "把错误吞掉再给用户反馈",
          "无限制提高并行度"
        ],
        correctAnswer: "回到该链路并重写中间策略"
      },
      feedbackSpec: {
        correctFeedback: "对。reflection 的价值就在于把偏差早期收敛，而不是盲目堆叠动作。",
        incorrectFeedback: "跳过偏差会放大错误，吞错更危险。"
      }
    },
    {
      id: "p05-parallel-vs-serial-cost",
      type: "process_animation",
      title: "过程：并行并不总是更快",
      learningGoal: "识别并行收益受依赖与资源约束影响。",
      narrative: "当子任务独立时并行可能加速；但共享资源紧张、依赖链强时，串行与限流反而更稳。",
      visualSpec: {
        kind: "graph",
        description: "比较不同依赖结构下的耗时曲线与协同成本。",
        keyElements: [
          "依赖程度",
          "共享资源",
          "并行收益",
          "协调开销",
          "失败重试"
        ]
      },
      interactionSpec: {
        kind: "prediction",
        learnerAction: "判断在下列场景更适合串行还是并行。",
        expectedObservation: "在强依赖与高协调成本下，串行或分段并行更稳。",
        cognitivePurpose: "训练不是“追求并行”，而是“追求最小损失完成”。"
      },
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "以下哪类场景最不适合直接全并行？",
        options: [
          "不同文档可独立摘要后再融合",
          "多步骤需要上游结果才能继续",
          "多数据源可并发采样",
          "每个分支都独立且低耗时"
        ],
        correctAnswer: "多步骤需要上游结果才能继续"
      },
      feedbackSpec: {
        correctFeedback: "依赖链决定可并行边界，强依赖适合分段并行/串行。",
        incorrectFeedback: "该场景并行反而可能加速，关键看依赖与协调成本。"
      }
    },
    {
      id: "p06-interaction-query-routing",
      type: "interactive_model",
      title: "互动：选择查询条件，观察路径选择",
      learningGoal: "用可视化判断任务更适合走路由分发、并行执行还是重试。",
      narrative: "不同输入条件意味着不同执行路径。学习者通过选择条件看到系统如何在“走索引式路径/全量探索/局部扫描”之间决策。",
      visualSpec: {
        kind: "flow",
        description: "把请求类型映射到不同执行通道。",
        keyElements: [
          "请求类型",
          "策略匹配",
          "工具选择",
          "反馈路径",
          "预计成本"
        ],
        component: "access_path"
      },
      interactionSpec: {
        kind: "query_path",
        learnerAction: "选择一个请求类型并判断其优先路径。",
        expectedObservation: "路径会在“路由命中”“并行分发”“人工复核”之间变化。",
        cognitivePurpose: "将请求分类能力与路径策略绑定，避免盲目统一。",
        options: [
          {
            id: "type-retrieval",
            label: "查询知识库答案并附来源",
            resultTitle: "走检索增强路径",
            outcomeId: "rag-first",
            resultTone: "success",
            explanation: "先检索可追溯证据能提高答案质量并降低幻觉风险。"
          },
          {
            id: "type-tool",
            label: "创建数据库查询并写入日志",
            resultTitle: "走工具执行路径",
            outcomeId: "tool-first",
            resultTone: "warning",
            explanation: "执行先行要确认权限与参数边界，缺失治理会放大事故面。"
          },
          {
            id: "type-ambiguous",
            label: "模糊请求（“按你建议处理”）",
            resultTitle: "先走澄清路由",
            outcomeId: "clarify-first",
            resultTone: "neutral",
            explanation: "语义模糊时先澄清可减少后续误执行与返工。"
          }
        ]
      },
      feedbackSpec: {
        correctFeedback: "不同类型请求需要不同策略，路由前置能明显减少无效执行。",
        incorrectFeedback: "选择路径前先确认任务形态，是避免误调度的关键。"
      }
    },
    {
      id: "p07-memory-context-closure",
      type: "interactive_model",
      title: "互动：调节记忆窗口，平衡连续性与成本",
      learningGoal: "理解上下文窗口不是越长越好。",
      narrative: "短期记忆支持连贯决策，但过长会增加噪声和成本；过短又会丢关键约束。",
      visualSpec: {
        kind: "timeline",
        description: "窗口长度与保真度、误差率、成本的关系图。",
        keyElements: [
          "上下文窗口",
          "连续性",
          "噪声",
          "代价",
          "回退策略"
        ]
      },
      interactionSpec: {
        kind: "slider",
        learnerAction: "选择记忆窗口大小并预估连续性和代价变化。",
        expectedObservation: "通常有一个“恰到好处”的窗口，不是越大越好。",
        cognitivePurpose: "建立控制变量视角，而非单点指标追求。"
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "窗口设置的最佳经验不是？",
        options: [
          "全部保留，永远最准确",
          "清空上下文，降低成本即可",
          "按任务依赖程度选择动态窗口",
          "固定最大值，减少策略复杂度"
        ],
        correctAnswer: "按任务依赖程度选择动态窗口"
      },
      feedbackSpec: {
        correctFeedback: "对，记忆策略需要对准任务依赖与成本目标动态调整。",
        incorrectFeedback: "记忆既有收益也有代价，关键是闭环选择。"
      }
    },
    {
      id: "p08-governance-checkpoint",
      type: "misconception_check",
      title: "误区检查：高模型能力后还能不做治理吗？",
      learningGoal: "确认安全治理是关键控制面，不是上线后补丁。",
      narrative: "系统在高价值场景下最常见失误不是“模型没想出答案”，而是未对风险路径做监控与回退。",
      visualSpec: {
        kind: "diagram",
        description: "误区下的闭环：告警—HITL—重试—回滚—复盘。",
        keyElements: [
          "SLA 告警",
          "HITL 介入",
          "恢复动作",
          "审计",
          "回放复盘"
        ]
      },
      interactionSpec: {
        kind: "index_tradeoff",
        learnerAction: "在高风险动作下选择“自动执行”“降级执行”或“人工确认”。",
        expectedObservation: "不同选择对应不同失败传播范围与恢复路径。",
        cognitivePurpose: "让“治理是产品能力”而非附加步骤内化。",
        options: [
          {
            id: "auto-risk",
            label: "直接自动执行",
            resultTitle: "速度高但事故风险高",
            outcomeId: "high-risk-auto",
            resultTone: "danger",
            explanation: "低校验下自动执行会放大错误扩散，尤其在关键动作。"
          },
          {
            id: "degrade-risk",
            label: "降级到低权限路径",
            resultTitle: "牺牲部分效率换取安全",
            outcomeId: "safe-degrade",
            resultTone: "success",
            explanation: "风险动作先降级执行可防止单次误差导致全链路崩坏。"
          },
          {
            id: "hitl-risk",
            label: "触发 HITL 人工确认",
            resultTitle: "增加确认成本但可控性强",
            outcomeId: "hitl-approved",
            resultTone: "warning",
            explanation: "人工确认提高可控性，代价是响应时间增加。"
          }
        ]
      },
      assessmentSpec: {
        kind: "true_false",
        prompt: "即便有成熟模型，也可以把治理留到系统上线后再补上。",
        options: [
          "是",
          "否"
        ],
        correctAnswer: "否"
      },
      feedbackSpec: {
        correctFeedback: "对。治理必须与执行一起设计，不然一上线就可能放大错配。",
        incorrectFeedback: "这会制造难以控制的风险带宽，尤其在高价值操作上。"
      }
    },
    {
      id: "p09-rag-mcp-path",
      type: "structure_diagram",
      title: "结构：RAG + MCP 的职责分工",
      learningGoal: "把检索增强与工具协议在工作流里的位置分清。",
      narrative: "RAG 负责检索和证据组织，MCP 负责工具协议与可调用上下文，二者协同才能做到“可追溯、可回放”。",
      visualSpec: {
        kind: "architecture",
        description: "输入到检索、工具注入、执行回执再到审计的一体化路径。",
        keyElements: [
          "用户问题",
          "RAG 检索",
          "MCP 适配",
          "工具执行",
          "证据回填"
        ]
      },
      interactionSpec: {
        kind: "build_from_parts",
        learnerAction: "按顺序拼接“RAG→MCP→执行→回写”流程并提交。",
        expectedObservation: "顺序变化会影响证据闭环的可追溯性。",
        cognitivePurpose: "建立“执行前可追踪”而非“执行后补证据”的习惯。"
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "哪种顺序更适合高风险查询型任务？",
        options: [
          "执行→RAG→MCP",
          "MCP→执行→回滚",
          "RAG→MCP→评估与回写",
          "先写结果再补证据"
        ],
        correctAnswer: "RAG→MCP→评估与回写"
      },
      feedbackSpec: {
        correctFeedback: "先有证据再做关键动作，能减少幻觉并提高可复盘性。",
        incorrectFeedback: "跳过证据链会增加错误传播成本。"
      },
      code: {
        language: "ts",
        value: "const flow = [\n  { step: 'route', label: '按请求类型分类' },\n  { step: 'rag', label: '先检索证据片段' },\n  { step: 'mcp', label: '注入上下文并调用工具' },\n  { step: 'review', label: '验证并记录证据' }\n];"
      }
    },
    {
      id: "p10-interaction-build-pipeline",
      type: "code_walkthrough",
      title: "代码层：把执行序列改写得更可解释",
      learningGoal: "理解可解释顺序设计比单步优化更重要。",
      narrative: "同一功能的两种实现方式：一种把步骤藏在隐式 prompt，另一种显式声明 routing、verification、recovery。",
      visualSpec: {
        kind: "table",
        description: "对比隐式与显式流程实现。",
        keyElements: [
          "隐式单步",
          "显式步骤树",
          "输出解释",
          "错误恢复点",
          "审计记录"
        ]
      },
      interactionSpec: {
        kind: "code_edit",
        learnerAction: "把关键检查点补进流程伪代码。",
        expectedObservation: "添加检查点后，故障定位时间会下降。",
        cognitivePurpose: "把“能跑”升级为“能维护”。"
      },
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "在可解释性设计中，最优先补的是：",
        options: [
          "增加更多注释",
          "显式化边界与恢复点",
          "删掉所有日志以节省性能",
          "只保留最佳路径"
        ],
        correctAnswer: "显式化边界与恢复点"
      },
      feedbackSpec: {
        correctFeedback: "恢复点和边界是后续排障和升级的关键支点。",
        incorrectFeedback: "注释和裁剪路径不能替代可执行的控制边界。"
      }
    },
    {
      id: "p11-gov-resource-prioritization",
      type: "transfer_challenge",
      title: "迁移挑战：你的任务如何优先调度？",
      learningGoal: "把优先级、成本、风险映射到实际执行策略。",
      narrative: "在高并发时，策略不是“都做”，而是“先做对的”。现在你给一组任务配置优先级并解释理由。",
      visualSpec: {
        kind: "graph",
        description: "任务集合在价值、成本、风险下的排队结果。",
        keyElements: [
          "价值分",
          "风险分",
          "延迟预算",
          "资源配额",
          "执行顺序"
        ]
      },
      interactionSpec: {
        kind: "parameter_experiment",
        learnerAction: "调整资源上限与优先级权重，观察任务组合变化。",
        expectedObservation: "你会看到牺牲某些低价值任务可显著提升关键任务稳定性。",
        cognitivePurpose: "把业务目标落到系统参数而非凭感觉。"
      },
      assessmentSpec: {
        kind: "transfer",
        prompt: "有三个任务：A(高价值高风险)、B(低价值低风险)、C(中价值高成本)。请写出你会设置的优先级与执行策略。",
        correctAnswer: "先服务高价值高风险任务，并给 C 更高的执行门槛或延后，B 在资源空闲时执行，确保 A 可得完整监控与回退。"
      },
      feedbackSpec: {
        correctFeedback: "你已抓住目标—资源—风险的三维平衡，能形成稳定生产策略。",
        incorrectFeedback: "优先级不是按提交顺序，而是按价值与风险决定的闭环策略。"
      }
    },
    {
      id: "p12-summary-transfer",
      type: "summary_card",
      title: "总结卡：Agentic 系统核心迁移心智模型",
      learningGoal: "压缩课程为可复用的决策框架。",
      narrative: "一个可持续的 Agentic 系统通常遵循四步：先建模任务，再路由，再观察反馈，最后可恢复地修正。",
      visualSpec: {
        kind: "table",
        description: "压缩核心框架：问题分解、路由、治理、迭代。",
        keyElements: [
          "任务模型",
          "路由决策",
          "状态/记忆",
          "治理与复盘"
        ],
        component: "summary"
      }
    }
  ],
  misconceptions: [
    {
      id: "misconception-serial",
      statement: "并行一定比串行快。",
      correction: "只有在子任务独立、资源足够时并行更优，依赖强或协调代价高时串行/分段并行更稳。"
    },
    {
      id: "misconception-hilot-automatable",
      statement: "模型能力足够后就不需要人工审查。",
      correction: "高风险节点应保留 HITL 与回退机制，错误恢复必须设计为一等公民。"
    },
    {
      id: "misconception-mcp-万能",
      statement: "引入 MCP 后，工具接入问题就解决了。",
      correction: "MCP 统一协议只是第一步，权限、治理、监控和失败策略仍需额外设计。"
    },
    {
      id: "misconception-memory-longer",
      statement: "上下文窗口越大越好。",
      correction: "上下文是资源，需在连续性与成本/噪声之间动态平衡。"
    }
  ],
  transferTasks: [
    {
      id: "transfer-task-incident-runbook",
      prompt: "把你所在项目中的一次故障案例，按本课框架重画一遍任务路由与恢复流程。",
      targetMentalModel: "建立“路由-执行-监控-恢复”闭环，而不是只追求单次准确率。"
    },
    {
      id: "transfer-task-analytics",
      prompt: "设计一个指标面板，实时显示路由命中率、人工干预率、恢复平均时间。",
      targetMentalModel: "用指标驱动策略调整，而非凭经验猜测。"
    }
  ],
  summary: [
    "先建立任务模型和路由树，再谈优化并行和上下文长度。",
    "工具调用、RAG、MCP 要有明确顺序和可追溯边界。",
    "并行、模型能力、上下文长度都应按代价与收益取舍。",
    "治理与恢复不是上线后补丁，而是第一设计版本的一部分。"
  ]
} satisfies Lesson;
