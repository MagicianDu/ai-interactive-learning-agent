import { readFile } from "node:fs/promises";
import path from "node:path";

import { ArtifactStore } from "../artifact-store.js";
import type { SourceAnchor, SourceStructureNode } from "../corpus-types.js";
import { AgentRuntimeError } from "../errors.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { normalizeSources } from "../source/source-normalizer.js";
import type { RunConfig } from "../types.js";
import { buildContentBlueprint, type ContentBlueprint } from "./content-quality-blueprint.js";
import { courseIntentLabel, defaultCourseIntent, type CourseIntent } from "./course-intent.js";
import { planCourseUnits, type SourceChapterPlanHint } from "./course-unit-planner.js";
import { difficultyLabel, type TeachingDifficultyLevel } from "./learner-project-service.js";
import { sampleAuthoringAnchors } from "./source-anchor-sampler.js";
import { extractSourceSemantics, type SourceSemantics } from "./source-semantic-extractor.js";

type LearnerProjectFile = {
  request?: string;
  brief?: {
    topic?: string;
    sourcePath?: string;
    sourceKind?: string;
    audience?: string;
    difficultyLevel?: TeachingDifficultyLevel;
    unitPages?: number;
    strategy?: string;
    selectedChapters?: string[];
    selectedTopics?: string[];
    language?: string;
    courseIntent?: CourseIntent;
    targetTotalPages?: number;
    totalPagesSpecified?: boolean;
  };
};

export type GetAuthoringContextInput = {
  runId: string;
  maxAnchors?: number;
};

export type AuthoringContextResult = {
  status: "authoring_context_ready";
  runId: string;
  brief: {
    topic: string;
    sourcePath?: string;
    sourceKind: string;
    audience: string;
    difficultyLevel: TeachingDifficultyLevel;
    unitPages: number;
    targetTotalPages?: number;
    totalPagesSpecified?: boolean;
    strategy: string;
    selectedChapters: string[];
    selectedTopics: string[];
    language: "zh-CN";
    courseIntent: CourseIntent;
  };
  source: {
    sourceKind: string;
    sourcePath?: string;
    anchorCount: number;
    warningCount: number;
    chapters: Array<{
      title: string;
      sourceNodeId: string;
      sourceAnchorIds: string[];
      sourceAnchorCount: number;
    }>;
    anchors: Array<{
      anchorId: string;
      label: string;
      locator: SourceAnchor["locator"];
      quote?: string;
      notes?: string;
    }>;
  };
  sourceSemantics: SourceSemantics;
  coursePlan: {
    strategy: string;
    strategyReason: string;
    unitPages: number;
    targetTotalPages?: number;
    estimatedTotalPages: number;
    pageBudgetReminder?: string;
    acceptanceExpectations: Array<{
      id: string;
      scope: "course" | "unit";
      required: boolean;
      description: string;
    }>;
    recommendedUnits: Array<{
      unitId: string;
      title: string;
      kind: string;
      lessonId: string;
      targetPageCount: number;
      sourceAnchorIds: string[];
      sourceAnchorCount: number;
      focusConcepts: string[];
      chapterRefs: string[];
      taskLabel?: string;
      transferExpectation: string;
      expectedInteractions: string[];
      expectedAssessments: string[];
      expectedSourceCoverage: {
        minSourceAnchorCount: number;
        preserveChapterRefs: boolean;
      };
    }>;
  };
  contentBlueprint: ContentBlueprint;
  artifacts: {
    coursePlanPath: string;
    unitPlanPath: string;
    authoringContextPath: string;
  };
  authoringContract: {
    defaultTool: "learning_agent.publish_learning_course";
    language: "zh-CN";
    requirements: string[];
  };
  qualityContract: {
    language: "zh-CN";
    courseIntent: CourseIntent;
    academicRigor: {
      positioning: TeachingDifficultyLevel;
      label: string;
      requirements: string[];
      assessmentExpectations: string[];
      avoid: string[];
    };
    supportedStrategies: string[];
    requiredPageTypes: string[];
    requiredLearningActions: string[];
    pageRules: string[];
    feedbackRules: string[];
    groundingRules: string[];
    sourceKindGuidance: {
      sourceKind: string;
      authoringFocus: string[];
      avoid: string[];
    };
    researchReadingContract?: {
      requiredMoves: string[];
      pageExpectations: string[];
      avoid: string[];
    };
    sourceKindDepthContract?: {
      sourceKind: "patent" | "blog";
      requiredMoves: string[];
      pageExpectations: string[];
      avoid: string[];
    };
    publishChecklist: string[];
  };
  learnerClarificationHints: string[];
  codexInstruction: string;
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export class AuthoringContextService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async getContext(input: GetAuthoringContextInput): Promise<AuthoringContextResult> {
    assertSafeRunId(input.runId);
    const maxAnchors = input.maxAnchors ?? 40;
    if (!Number.isInteger(maxAnchors) || maxAnchors < 1 || maxAnchors > 200) {
      throw new AgentRuntimeError("maxAnchors must be an integer between 1 and 200", "INVALID_RUN_CONFIG");
    }

    const project = await readLearnerProject(this.workspaceRoot, input.runId);
    const config = buildRunConfig(input.runId, project);
    const normalizedSources = await normalizeSources(config.sources);
    const sourceChapters = extractSourceChapterHints(normalizedSources.structure, normalizedSources.anchors);
    const sampledAnchors = sampleAuthoringAnchors({
      anchors: normalizedSources.anchors,
      sourceKind: config.sourceKind ?? "topic",
      maxAnchors,
      selectedTopics: config.coursePack?.selectedTopics ?? [],
      selectedChapters: config.coursePack?.selectedChapters ?? [],
      topic: config.topic,
      chapterAnchorGroups: sourceChapters.map((chapter) => ({
        title: chapter.title,
        anchorIds: chapter.sourceAnchorIds
      }))
    });
    const semantics = extractSourceSemantics({
      sourceKind: config.sourceKind ?? "topic",
      anchors: sampledAnchors.length > 0 ? sampledAnchors : normalizedSources.anchors
    });
    const concepts = uniqueStrings([
      semantics.concepts[0]?.label ?? "全局地图",
      ...(config.coursePack?.selectedTopics ?? []),
      ...semantics.concepts.map((concept) => concept.label)
    ]);
    const sampledAnchorIds = ensureAnchorIds(
      sampledAnchors.map((anchor) => anchor.anchorId),
      config
    );
    const unitPlan = planCourseUnits({
      runId: config.runId,
      topic: config.topic,
      sourceKind: config.sourceKind ?? "topic",
      strategy: config.coursePack?.strategy ?? "overview_plus_topic",
      unitPageCount: config.coursePack?.unitPageCount ?? config.pageCount.target,
      courseIntent: project.brief?.courseIntent ?? defaultCourseIntent,
      targetTotalPages: project.brief?.targetTotalPages ?? config.coursePack?.targetTotalPages,
      selectedTopics: config.coursePack?.selectedTopics ?? [],
      selectedChapters: config.coursePack?.selectedChapters ?? [],
      concepts,
      sourceAnchorIds: sampledAnchorIds,
      sourceNodeIds: sourceChapters.length > 0 ? sourceChapters.map((chapter) => chapter.sourceNodeId) : config.sources.map((source) => `${source.id}:root`),
      sourceChapters
    });
    const displaySourceKind = project.brief?.sourceKind === "topic" && !project.brief.sourcePath ? "topic" : (config.sourceKind ?? "topic");
    const brief = {
      topic: config.topic,
      ...(project.brief?.sourcePath ? { sourcePath: project.brief.sourcePath } : {}),
      sourceKind: displaySourceKind,
      audience: config.audience,
      difficultyLevel: project.brief?.difficultyLevel ?? "upper_undergraduate_or_graduate",
      unitPages: config.coursePack?.unitPageCount ?? config.pageCount.target,
      ...(project.brief?.targetTotalPages ? { targetTotalPages: project.brief.targetTotalPages } : {}),
      ...(typeof project.brief?.totalPagesSpecified === "boolean" ? { totalPagesSpecified: project.brief.totalPagesSpecified } : {}),
      strategy: config.coursePack?.strategy ?? "overview_plus_topic",
      selectedChapters: config.coursePack?.selectedChapters ?? [],
      selectedTopics: config.coursePack?.selectedTopics ?? [],
      language: "zh-CN" as const,
      courseIntent: project.brief?.courseIntent ?? defaultCourseIntent
    };
    const contentBlueprint = buildContentBlueprint({
      audience: brief.audience,
      difficultyLevel: brief.difficultyLevel,
      sourceKind: brief.sourceKind,
      courseIntent: brief.courseIntent,
      units: unitPlan.units,
      sourceSemantics: semantics
    });

    const contextWithoutArtifacts = {
      status: "authoring_context_ready",
      runId: input.runId,
      brief,
      source: {
        sourceKind: brief.sourceKind,
        ...(brief.sourcePath ? { sourcePath: brief.sourcePath } : {}),
        anchorCount: normalizedSources.anchors.length,
        warningCount: normalizedSources.extractionWarnings.length,
        chapters: sourceChapters.map((chapter) => ({
          title: chapter.title,
          sourceNodeId: chapter.sourceNodeId,
          sourceAnchorIds: chapter.sourceAnchorIds,
          sourceAnchorCount: chapter.sourceAnchorIds.length
        })),
        anchors: sampledAnchors.slice(0, maxAnchors).map((anchor) => ({
          anchorId: anchor.anchorId,
          label: anchor.label,
          locator: anchor.locator,
          ...(anchor.quote ? { quote: anchor.quote } : {}),
          ...(anchor.notes ? { notes: anchor.notes } : {})
        }))
      },
      sourceSemantics: semantics,
      coursePlan: {
        strategy: unitPlan.strategy,
        strategyReason: unitPlan.strategyReason,
        unitPages: brief.unitPages,
        ...(brief.targetTotalPages ? { targetTotalPages: brief.targetTotalPages } : {}),
        estimatedTotalPages: unitPlan.estimatedTotalPages,
        ...(pageBudgetReminder(brief) ? { pageBudgetReminder: pageBudgetReminder(brief) } : {}),
        acceptanceExpectations: unitPlan.acceptanceExpectations,
        recommendedUnits: unitPlan.units.map((unit) => ({
          unitId: unit.unitId,
          title: unit.title,
          kind: unit.kind,
          lessonId: unit.lessonId,
          targetPageCount: unit.targetPageCount,
          sourceAnchorIds: unit.sourceAnchorIds,
          sourceAnchorCount: unit.sourceAnchorIds.length,
          focusConcepts: unit.focusConcepts,
          chapterRefs: unit.chapterRefs ?? [],
          ...(unit.taskLabel ? { taskLabel: unit.taskLabel } : {}),
          transferExpectation: unit.transferExpectation,
          expectedInteractions: unit.expectedInteractions,
          expectedAssessments: unit.expectedAssessments,
          expectedSourceCoverage: unit.expectedSourceCoverage
        }))
      },
      contentBlueprint,
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course",
        language: "zh-CN",
        requirements: [
          "请由 Codex 创作 coursePack 和 lessons，不要让 MCP deterministic generator 代写正式内容。",
          brief.courseIntent === "professor_lecture_deck"
            ? "每个 professor_lecture_deck 页面必须优先写 page.knowledgeBoard：headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine；内容逻辑为原文命题 -> 拆解 -> 证据 -> 重构，左栏放概念/机制/定义/推导，右栏放例子/反例/来源证据/边界。"
            : "每个 lesson 必须中文优先，并包含问题、视觉模型、学习动作、反馈、误区检查和迁移任务。",
          "每个 source-backed 页面必须包含 page.sourceAnchorIds，或显式标注 grounding.kind 为 inferred/analogy。",
          "教学页面应一页一学习目标；如果内容过多，请拆页而不是堆长段落。",
          "完成后调用 learning_agent.publish_learning_course，并用 learning_agent.get_learning_preview 返回网页。"
        ]
      },
      qualityContract: buildQualityContract(brief, contentBlueprint),
      learnerClarificationHints: buildLearnerClarificationHints(brief),
      codexInstruction: buildCodexInstruction(brief, unitPlan.units.length)
    } satisfies Omit<AuthoringContextResult, "artifacts">;

    const artifactStore = new ArtifactStore(path.join(this.workspaceRoot, "runs", input.runId));
    const coursePlanWrite = await artifactStore.writeDraft("course-plan", {
      artifactId: "course-plan",
      roleId: "learning-architecture",
      runId: input.runId,
      brief,
      coursePlan: contextWithoutArtifacts.coursePlan
    });
    const unitPlanWrite = await artifactStore.writeDraft("unit-plan", {
      artifactId: "unit-plan",
      roleId: "learning-architecture",
      runId: input.runId,
      units: unitPlan.units
    });
    const contextWithPartialArtifacts = {
      ...contextWithoutArtifacts,
      artifacts: {
        coursePlanPath: coursePlanWrite.path,
        unitPlanPath: unitPlanWrite.path,
        authoringContextPath: ""
      }
    };
    const authoringContextWrite = await artifactStore.writeDraft("authoring-context", {
      artifactId: "authoring-context",
      roleId: "learning-architecture",
      ...contextWithPartialArtifacts
    });

    return {
      ...contextWithoutArtifacts,
      artifacts: {
        coursePlanPath: coursePlanWrite.path,
        unitPlanPath: unitPlanWrite.path,
        authoringContextPath: authoringContextWrite.path
      }
    };
  }
}

function buildQualityContract(brief: AuthoringContextResult["brief"], contentBlueprint: ContentBlueprint): AuthoringContextResult["qualityContract"] {
  const levelLabel = difficultyLabel(brief.difficultyLevel);
  return {
    language: "zh-CN",
    courseIntent: brief.courseIntent,
    academicRigor: {
      positioning: brief.difficultyLevel,
      label: levelLabel,
      requirements: [
        `按${levelLabel}设计，不做泛泛科普或轻量博客摘要。`,
        "每个 unit 必须显式给出先修概念、核心术语、来源阅读映射、知识节点和关键链路。",
        "解释必须有学术密度：问题定义、机制模型、证据/来源边界、反例和适用条件。",
        "长资料要保留章节或主题的课程结构，让学生知道先看什么、节点如何相连、边界在哪里。"
      ],
      assessmentExpectations: [
        "案例判断：用短案例说明一个概念如何进入具体判断。",
        "边界判断：用反例或相邻场景说明结论何时失效。",
        "研究生级检查：避免术语记忆题，优先使用论证、诊断、设计和批判性分析。"
      ],
      avoid: [
        "不要只写概念宣传、产品介绍或泛泛学习建议。",
        "不要把复杂来源材料压成浅层摘要。",
        "不要用没有来源依据的结论替代读书/读论文训练。"
      ]
    },
    supportedStrategies: ["overview_plus_topic", "chapter_guided", "topic_guided", "task_guided", "hybrid"],
    requiredPageTypes:
      brief.courseIntent === "professor_lecture_deck"
        ? requiredPageTypesFromBlueprint(contentBlueprint)
        : [
            "problem_scene",
            "intuition_visual",
            "structure_diagram",
            "interactive_model",
            "quiz",
            "misconception_check",
            "transfer_challenge",
            "summary_card"
          ],
    requiredLearningActions:
      brief.courseIntent === "professor_lecture_deck"
        ? ["map_knowledge_nodes", "explain_key_links", "define_terms", "work_example", "compare_boundaries", "summarize_structure"]
        : ["predict", "manipulate", "compare", "explain", "debug", "transfer"],
    pageRules: [
      `页面应符合${levelLabel}的教材课件密度：有问题、概念、来源依据、关键链路、例子或边界，而不是只有解释性段落。`,
      "每页只承载一个学习目标，正文应短，优先使用图、流程、状态变化或可操作模型。",
      "不要把一整章压缩进一页；内容过多时拆成多个 unit 或多页。",
      "先从问题、情境、视觉模型和学习动作进入，再引入术语、公式、代码或定义。",
      `每个 unit 目标页数为 ${brief.unitPages} 页；除非用户明确修改，不要随意缩短。`
    ],
    feedbackRules: [
      "所有 quiz、prediction、interaction、misconception_check 都必须解释为什么，而不是只说正确或错误。",
      "反馈要指出学习者可能采用了什么错误假设，以及应该怎样更新心智模型。",
      "反馈要解释因果机制、边界条件和迁移方式。"
    ],
    groundingRules: [
      "source-backed lesson 必须包含 sourceContext.sourceAnchorIds，相关页面必须包含 page.sourceAnchorIds。",
      "没有直接来源的推理页必须显式设置 grounding.kind 为 inferred；类比页必须设置 grounding.kind 为 analogy。",
      "不要伪造来源锚点；如果来源不足，缩小课程范围或把结论标为推理。"
    ],
    sourceKindGuidance: sourceKindGuidance(brief.sourceKind),
    ...(requiresResearchReadingContract(brief) ? { researchReadingContract: researchReadingContract() } : {}),
    ...(sourceKindDepthContract(brief.sourceKind) ? { sourceKindDepthContract: sourceKindDepthContract(brief.sourceKind) } : {}),
    publishChecklist:
      brief.courseIntent === "professor_lecture_deck"
        ? [
            "coursePack.units 引用的 lessonId 必须存在。",
            `每个 lesson 的 prerequisites、learningObjectives、pages、summary 要体现${levelLabel}定位。`,
            "每个 lesson 必须中文优先，并包含本讲定位、先修要求、知识节点、关键链路、核心定义、经典例题、方法比较、边界案例和总结图。",
            "每个 lesson 至少包含 3 个 visualSpec；interactionSpec 和 assessmentSpec 是可选内部结构，不应强迫学生逐页审批或答题。",
            "如果保留 interactionSpec 或 assessmentSpec，必须服务内容理解；在 textbook_deck 显示模式下不要显性渲染为教学设计模块。",
            "学生侧页面应像教材课件：标题、正文、图/表/代码/例子，避免暴露教学设计话术。"
          ]
        : [
            "coursePack.units 引用的 lessonId 必须存在。",
            `每个 lesson 的 prerequisites、learningObjectives、pages、summary 要体现${levelLabel}定位。`,
            "每个 lesson 必须中文优先，并包含 objectives、prerequisites、pages、misconceptions、transferTasks、summary。",
            "每个 lesson 至少包含 3 个 visualSpec、2 个 interactionSpec、2 个 assessmentSpec、1 个 misconception_check 和 1 个 transfer_challenge。",
            "每个 interactionSpec 必须说明 learnerAction、expectedObservation、cognitivePurpose，并提供解释性结果。",
            "每个 assessment 页面必须有 feedbackSpec。"
          ]
  };
}

function requiredPageTypesFromBlueprint(contentBlueprint: ContentBlueprint): string[] {
  const pageTypes = contentBlueprint.units.flatMap((unit) => unit.pageBlueprints.map((page) => page.pageType));
  return Array.from(new Set(pageTypes));
}

function sourceKindGuidance(sourceKind: string): AuthoringContextResult["qualityContract"]["sourceKindGuidance"] {
  if (sourceKind === "book") {
    return {
      sourceKind,
      authoringFocus: ["章节映射", "全书总览课", "核心 topic 拆课", "概念依赖和长期记忆结构"],
      avoid: ["把整本书压缩成一个 12 页摘要", "逐章搬运原文", "忽略章节到 topic 的映射"]
    };
  }
  if (sourceKind === "paper") {
    return {
      sourceKind,
      authoringFocus: ["研究问题", "方法机制", "证据链", "局限边界", "如何迁移到实践判断"],
      avoid: ["把论文讲成普通博客", "跳过实验或证据", "把作者结论过度外推"]
    };
  }
  if (sourceKind === "patent") {
    return {
      sourceKind,
      authoringFocus: ["权利要求", "现有技术问题", "发明机制", "实施例", "适用边界"],
      avoid: ["把权利要求当成学术结论", "忽略附图或实施例", "弱化法律边界"]
    };
  }
  if (sourceKind === "blog") {
    return {
      sourceKind,
      authoringFocus: ["实现模式", "问题场景", "关键 caveat", "可复用实践步骤", "读者可操作检查"],
      avoid: ["只摘录观点", "忽略作者的实践上下文", "把示例泛化成绝对规则"]
    };
  }
  if (sourceKind === "notes") {
    return {
      sourceKind,
      authoringFocus: ["用户原始结构", "隐含问题", "碎片概念归并", "缺口标注", "复习路径"],
      avoid: ["打乱用户已有脉络", "把笔记不足的地方补成确定事实", "忽略用户自己的术语"]
    };
  }
  if (sourceKind === "documentation") {
    return {
      sourceKind,
      authoringFocus: ["任务路径", "API/概念边界", "常见错误", "最小可运行例子", "决策表"],
      avoid: ["复制文档目录", "堆 API 参数", "缺少操作反馈"]
    };
  }
  return {
    sourceKind,
    authoringFocus: ["心智模型", "具体问题", "可视化结构", "学习动作", "迁移挑战"],
    avoid: ["编造来源", "从定义开始堆长文", "缺少学习者反馈"]
  };
}

function requiresResearchReadingContract(brief: AuthoringContextResult["brief"]): boolean {
  return brief.sourceKind === "paper" || brief.difficultyLevel === "research";
}

function researchReadingContract(): NonNullable<AuthoringContextResult["qualityContract"]["researchReadingContract"]> {
  return {
    requiredMoves: ["研究问题", "论文贡献", "方法机制", "实验/证据", "局限/威胁", "迁移判断"],
    pageExpectations: [
      "problem_scene 必须明确论文要解决的研究问题和贡献 claim。",
      "structure_diagram 必须区分方法机制、方法假设和系统边界。",
      "quiz / interactive_model 必须让学习者检查实验/证据路径，而不是背术语。",
      "misconception_check 必须处理论文贡献不等于已被充分证明的误区。",
      "transfer_challenge 必须说明哪些假设保留时才能迁移，哪些上下文不能迁移。"
    ],
    avoid: ["不要把论文讲成普通博客摘要。", "不要跳过实验/证据或局限/威胁。", "不要把作者结论过度外推成通用工程规则。"]
  };
}

function sourceKindDepthContract(sourceKind: string): AuthoringContextResult["qualityContract"]["sourceKindDepthContract"] | undefined {
  if (sourceKind === "patent") {
    return {
      sourceKind,
      requiredMoves: ["权利要求边界", "现有技术问题", "技术方案/机制", "实施例", "法律/适用边界", "规避或迁移判断"],
      pageExpectations: [
        "problem_scene 必须明确现有技术问题和权利要求要划定的保护边界。",
        "structure_diagram 必须区分权利要求、技术方案/机制、实施例和推理补充。",
        "quiz / interactive_model 必须让学习者判断某个方案落在权利要求边界内还是实施例描述内。",
        "misconception_check 必须处理把专利文本当成学术结论或产品承诺的误区。",
        "transfer_challenge 必须要求学习者做规避或迁移判断，并显式说明法律/适用边界。"
      ],
      avoid: ["不要把权利要求讲成普通概念定义。", "不要混淆保护边界、实施例和 Codex 推理。", "不要把法律边界弱化成泛泛工程建议。"]
    };
  }
  if (sourceKind === "blog") {
    return {
      sourceKind,
      requiredMoves: ["实际问题", "作者方案", "实现路径", "caveat/失败模式", "可操作检查", "迁移边界"],
      pageExpectations: [
        "problem_scene 必须明确作者面对的实际问题和实践上下文。",
        "structure_diagram 必须画出作者方案、实现路径、关键选择和约束。",
        "quiz / interactive_model 必须让学习者用 caveat 或失败模式判断步骤是否可复用。",
        "misconception_check 必须处理把单个实践案例泛化成绝对规则的误区。",
        "transfer_challenge 必须给出可操作检查，并说明迁移边界。"
      ],
      avoid: ["不要把博客改写成观点摘录。", "不要跳过 caveat、失败模式或实践上下文。", "不要把作者示例泛化成所有系统都适用的规则。"]
    };
  }
  return undefined;
}

function buildLearnerClarificationHints(brief: AuthoringContextResult["brief"]): string[] {
  return [
    `确认学习目标：这套课程要让学习者最终能做什么，而不只是知道什么？`,
    `确认难度层级：当前为 ${difficultyLabel(brief.difficultyLevel)}；用户也可以选择入门衔接、本科核心、大学高年级/研究生课程或研究论文精读。`,
    `确认课程组织：当前为 ${brief.strategy}；用户也可以选择按章节、按 topic、按任务或混合路径。`,
    `确认阅读习惯：每个单元当前 ${brief.unitPages} 页，可按用户耐心和基础调整。`,
    ...(brief.courseIntent === "student_self_study_textbook" && brief.targetTotalPages
      ? [`确认总页数预算：当前约 ${brief.targetTotalPages} 页；用户可以改成更短或更长。`]
      : []),
    `确认受众水平：当前为 ${brief.audience}；内容深度、例子和练习都应围绕该画像。`
  ];
}

function pageBudgetReminder(brief: AuthoringContextResult["brief"]): string | undefined {
  if (brief.courseIntent !== "student_self_study_textbook" || brief.targetTotalPages === undefined) {
    return undefined;
  }
  if (brief.totalPagesSpecified === false) {
    return `默认约 ${brief.targetTotalPages} 页；学习者可以用自然语言调整总页数或每单元页数。`;
  }
  return `学习者指定总页数约 ${brief.targetTotalPages} 页。`;
}

function buildCodexInstruction(brief: AuthoringContextResult["brief"], unitCount: number): string {
  return [
    "请由 Codex 创作 coursePack 和 lessons，然后调用 learning_agent.publish_learning_course。",
    `课程形态：${courseIntentLabel(brief.courseIntent)}（${brief.courseIntent}）。`,
    `教学难度层级：${difficultyLabel(brief.difficultyLevel)}（${brief.difficultyLevel}）；不要写成泛泛科普、博客摘要或产品介绍。`,
    brief.courseIntent === "professor_lecture_deck"
      ? "请写成教材式知识链路 Web Deck：像大学/研究生课程课件，重点是概念密度、知识节点、关键链路、方法谱系、经典例题、边界条件和总结图；不是教师备课提纲；不要生成 PPTX 或 Slides；不要把教学设计词显性写到页面上。"
      : "请写成互动学习 Web Deck：问题、视觉模型、学习动作、反馈、误区检查和迁移任务是重点。",
    brief.courseIntent === "professor_lecture_deck"
      ? "保持 title/narrative 作为兼容字段，但正式内容必须进入 page.knowledgeBoard；knowledgeBoard 字段为 headline、coreProposition、leftColumn、rightColumn、sourceTrace、bottomLine。内容逻辑按原文命题 -> 拆解 -> 证据 -> 重构组织。左栏用于概念、机制、定义或推导；右栏用于例子、反例、来源证据或边界；sourceTrace 记录 anchorId/supports，学生视图默认隐藏。"
      : undefined,
    ...(requiresResearchReadingContract(brief)
      ? ["这是一套论文精读课；每个相关 lesson 必须显式覆盖：研究问题、论文贡献、方法机制、实验/证据、局限/威胁、迁移判断。"]
      : []),
    ...(brief.sourceKind === "patent"
      ? ["这是一套专利解读课；每个相关 lesson 必须显式覆盖：权利要求边界、现有技术问题、技术方案/机制、实施例、法律/适用边界、规避或迁移判断。"]
      : []),
    ...(brief.sourceKind === "blog"
      ? ["这是一套实践案例课；每个相关 lesson 必须显式覆盖：实际问题、作者方案、实现路径、caveat/失败模式、可操作检查、迁移边界。"]
      : []),
    "写 lesson 前先逐项遵循 contentBlueprint.units[*].pageBlueprints：pageType、teachingMove、learnerAction、visualRequirement、feedbackRequirement、sourceRequirement。",
    `输出语言：${brief.language}。`,
    `课程策略：${brief.strategy}。`,
    `每个单元页数：${brief.unitPages}。`,
    brief.courseIntent === "student_self_study_textbook" && brief.targetTotalPages
      ? `总页数预算：约 ${brief.targetTotalPages} 页。${brief.totalPagesSpecified === false ? "这是默认建议值，用户可以继续改短或改长。" : "这是用户指定值，优先遵守。"}`
      : undefined,
    `建议单元数：${unitCount}。`,
    brief.courseIntent === "professor_lecture_deck"
      ? "不要把资料压缩成摘要；每个页面要讲清一个知识节点或一条关键链路。"
      : "不要把资料压缩成摘要；每个页面要围绕一个学习动作或心智模型推进。",
    "保留 sourceAnchorIds，并让反馈解释原因、机制和误区。"
  ].join("\n");
}

function buildRunConfig(runId: string, project: LearnerProjectFile): RunConfig {
  const brief = project.brief;
  const sourcePath = brief?.sourcePath;
  const isUrl = sourcePath ? /^https?:\/\//u.test(sourcePath) : false;
  const sourceLooksLikeFolder = sourcePath ? !isUrl && !/\.[a-z0-9]{1,8}$/iu.test(sourcePath) : false;
  const sourceTitle = sourcePath && !isGenericRequestedTopic(brief?.topic) ? brief?.topic : undefined;

  return createRunConfigFromArgs({
    run: runId,
    topic: !sourcePath ? brief?.topic : undefined,
    sourceFile: sourcePath && !isUrl && !sourceLooksLikeFolder ? sourcePath : undefined,
    sourceFolder: sourcePath && sourceLooksLikeFolder ? sourcePath : undefined,
    sourceUrl: sourcePath && isUrl ? sourcePath : undefined,
    sourceKind: brief?.sourceKind === "topic" ? undefined : brief?.sourceKind,
    sourceTitle,
    unitPages: String(brief?.unitPages ?? 8),
    targetTotalPages: brief?.targetTotalPages ? String(brief.targetTotalPages) : undefined,
    strategy: brief?.strategy,
    chapters: brief?.selectedChapters?.join(","),
    topics: brief?.selectedTopics?.join(","),
    audience: brief?.audience,
    language: brief?.language,
    adapter: "mock"
  });
}

function isGenericRequestedTopic(topic: string | undefined): boolean {
  if (!topic) {
    return true;
  }
  return /^(?:教授式中文 Web Deck|中文互动学习网页|中文学习材料|中文学习课程|学习材料|学习课程)$/iu.test(topic.trim());
}

function ensureAnchorIds(anchorIds: string[], config: RunConfig): string[] {
  if (anchorIds.length > 0) {
    return uniqueStrings(anchorIds);
  }
  const sourceId = config.sources[0]?.id ?? "source-001";
  return [`${sourceId}:root`];
}

function extractSourceChapterHints(structure: SourceStructureNode[], anchors: SourceAnchor[]): SourceChapterPlanHint[] {
  const anchorsById = new Map(anchors.map((anchor) => [anchor.anchorId, anchor]));
  const seenTitles = new Set<string>();
  return structure
    .filter((node) => node.type === "chapter")
    .flatMap((node) => {
      const title = node.title.trim();
      if (!title || seenTitles.has(title)) {
        return [];
      }
      const sourceAnchorIds = prioritizedChapterAnchorIds(node.anchorIds, anchorsById);
      if (sourceAnchorIds.length === 0) {
        return [];
      }
      seenTitles.add(title);
      return [
        {
          title,
          sourceNodeId: node.id,
          sourceAnchorIds
        }
      ];
    });
}

function prioritizedChapterAnchorIds(anchorIds: string[], anchorsById: Map<string, SourceAnchor>): string[] {
  const existing = uniqueStrings(anchorIds.filter((anchorId) => anchorsById.has(anchorId)));
  const ranked = [...existing].sort((left, right) => anchorPriority(anchorsById.get(left)) - anchorPriority(anchorsById.get(right)));
  return ranked.slice(0, 24);
}

function anchorPriority(anchor: SourceAnchor | undefined): number {
  if (!anchor) {
    return 99;
  }
  if (anchor.locator.kind === "heading") {
    return 0;
  }
  if (anchor.locator.kind === "page") {
    return 1;
  }
  return 2;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function readLearnerProject(workspaceRoot: string, runId: string): Promise<LearnerProjectFile> {
  try {
    return JSON.parse(await readFile(path.join(workspaceRoot, "runs", runId, "learner-project.json"), "utf8")) as LearnerProjectFile;
  } catch (error) {
    if (isFileNotFound(error)) {
      throw new AgentRuntimeError("learner project not found; call create_learning_project first", "MISSING_ARTIFACT");
    }
    throw error;
  }
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
