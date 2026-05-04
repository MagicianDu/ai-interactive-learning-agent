import { readFile } from "node:fs/promises";
import path from "node:path";

import type { SourceAnchor } from "../corpus-types.js";
import { AgentRuntimeError } from "../errors.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { normalizeSources } from "../source/source-normalizer.js";
import type { RunConfig } from "../types.js";
import { planCourseUnits } from "./course-unit-planner.js";
import { extractSourceSemantics } from "./source-semantic-extractor.js";

type LearnerProjectFile = {
  request?: string;
  brief?: {
    topic?: string;
    sourcePath?: string;
    sourceKind?: string;
    audience?: string;
    unitPages?: number;
    strategy?: string;
    selectedChapters?: string[];
    selectedTopics?: string[];
    language?: string;
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
    unitPages: number;
    strategy: string;
    selectedChapters: string[];
    selectedTopics: string[];
    language: "zh-CN";
  };
  source: {
    sourceKind: string;
    sourcePath?: string;
    anchorCount: number;
    warningCount: number;
    anchors: Array<{
      anchorId: string;
      label: string;
      locator: SourceAnchor["locator"];
      quote?: string;
      notes?: string;
    }>;
  };
  coursePlan: {
    strategy: string;
    unitPages: number;
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
    }>;
  };
  authoringContract: {
    defaultTool: "learning_agent.publish_learning_course";
    language: "zh-CN";
    requirements: string[];
  };
  qualityContract: {
    language: "zh-CN";
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
    const sourceAnchorIds = ensureAnchorIds(
      normalizedSources.anchors.map((anchor) => anchor.anchorId),
      config
    );
    const semantics = extractSourceSemantics({
      sourceKind: config.sourceKind ?? "topic",
      anchors: normalizedSources.anchors
    });
    const concepts = uniqueStrings([
      semantics.concepts[0]?.label ?? "全局地图",
      ...(config.coursePack?.selectedTopics ?? []),
      ...semantics.concepts.map((concept) => concept.label)
    ]);
    const sampledAnchorIds = sourceAnchorIds.slice(0, maxAnchors);
    const unitPlan = planCourseUnits({
      runId: config.runId,
      topic: config.topic,
      sourceKind: config.sourceKind ?? "topic",
      strategy: config.coursePack?.strategy ?? "overview_plus_topic",
      unitPageCount: config.coursePack?.unitPageCount ?? config.pageCount.target,
      selectedTopics: config.coursePack?.selectedTopics ?? [],
      selectedChapters: config.coursePack?.selectedChapters ?? [],
      concepts,
      sourceAnchorIds: sampledAnchorIds,
      sourceNodeIds: config.sources.map((source) => `${source.id}:root`)
    });

    const displaySourceKind = project.brief?.sourceKind === "topic" && !project.brief.sourcePath ? "topic" : (config.sourceKind ?? "topic");
    const brief = {
      topic: config.topic,
      ...(project.brief?.sourcePath ? { sourcePath: project.brief.sourcePath } : {}),
      sourceKind: displaySourceKind,
      audience: config.audience,
      unitPages: config.coursePack?.unitPageCount ?? config.pageCount.target,
      strategy: config.coursePack?.strategy ?? "overview_plus_topic",
      selectedChapters: config.coursePack?.selectedChapters ?? [],
      selectedTopics: config.coursePack?.selectedTopics ?? [],
      language: "zh-CN" as const
    };

    return {
      status: "authoring_context_ready",
      runId: input.runId,
      brief,
      source: {
        sourceKind: brief.sourceKind,
        ...(brief.sourcePath ? { sourcePath: brief.sourcePath } : {}),
        anchorCount: normalizedSources.anchors.length,
        warningCount: normalizedSources.extractionWarnings.length,
        anchors: normalizedSources.anchors.slice(0, maxAnchors).map((anchor) => ({
          anchorId: anchor.anchorId,
          label: anchor.label,
          locator: anchor.locator,
          ...(anchor.quote ? { quote: anchor.quote } : {}),
          ...(anchor.notes ? { notes: anchor.notes } : {})
        }))
      },
      coursePlan: {
        strategy: brief.strategy,
        unitPages: brief.unitPages,
        recommendedUnits: unitPlan.units.map((unit) => ({
          unitId: unit.unitId,
          title: unit.title,
          kind: unit.kind,
          lessonId: unit.lessonId,
          targetPageCount: unit.targetPageCount,
          sourceAnchorIds: unit.sourceAnchorIds,
          sourceAnchorCount: unit.sourceAnchorIds.length,
          focusConcepts: unit.focusConcepts,
          chapterRefs: unit.chapterRefs ?? []
        }))
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course",
        language: "zh-CN",
        requirements: [
          "请由 Codex 创作 coursePack 和 lessons，不要让 MCP deterministic generator 代写正式内容。",
          "每个 lesson 必须中文优先，并包含问题、视觉模型、学习动作、反馈、误区检查和迁移任务。",
          "每个 source-backed 页面必须包含 page.sourceAnchorIds，或显式标注 grounding.kind 为 inferred/analogy。",
          "教学页面应一页一学习目标；如果内容过多，请拆页而不是堆长段落。",
          "完成后调用 learning_agent.publish_learning_course，并用 learning_agent.get_learning_preview 返回网页。"
        ]
      },
      qualityContract: buildQualityContract(brief),
      learnerClarificationHints: buildLearnerClarificationHints(brief),
      codexInstruction: buildCodexInstruction(brief, unitPlan.units.length)
    };
  }
}

function buildQualityContract(brief: AuthoringContextResult["brief"]): AuthoringContextResult["qualityContract"] {
  return {
    language: "zh-CN",
    supportedStrategies: ["overview_plus_topic", "chapter_guided", "topic_guided", "task_guided", "hybrid"],
    requiredPageTypes: [
      "problem_scene",
      "intuition_visual",
      "structure_diagram",
      "interactive_model",
      "quiz",
      "misconception_check",
      "transfer_challenge",
      "summary_card"
    ],
    requiredLearningActions: ["predict", "manipulate", "compare", "explain", "debug", "transfer"],
    pageRules: [
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
    publishChecklist: [
      "coursePack.units 引用的 lessonId 必须存在。",
      "每个 lesson 必须中文优先，并包含 objectives、prerequisites、pages、misconceptions、transferTasks、summary。",
      "每个 lesson 至少包含 3 个 visualSpec、2 个 interactionSpec、2 个 assessmentSpec、1 个 misconception_check 和 1 个 transfer_challenge。",
      "每个 interactionSpec 必须说明 learnerAction、expectedObservation、cognitivePurpose，并提供解释性结果。",
      "每个 assessment 页面必须有 feedbackSpec。"
    ]
  };
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

function buildLearnerClarificationHints(brief: AuthoringContextResult["brief"]): string[] {
  return [
    `确认学习目标：这套课程要让学习者最终能做什么，而不只是知道什么？`,
    `确认课程组织：当前为 ${brief.strategy}；用户也可以选择按章节、按 topic、按任务或混合路径。`,
    `确认阅读习惯：每个单元当前 ${brief.unitPages} 页，可按用户耐心和基础调整。`,
    `确认受众水平：当前为 ${brief.audience}；内容深度、例子和练习都应围绕该画像。`
  ];
}

function buildCodexInstruction(brief: AuthoringContextResult["brief"], unitCount: number): string {
  return [
    "请由 Codex 创作 coursePack 和 lessons，然后调用 learning_agent.publish_learning_course。",
    `输出语言：${brief.language}。`,
    `课程策略：${brief.strategy}。`,
    `每个单元页数：${brief.unitPages}。`,
    `建议单元数：${unitCount}。`,
    "不要把资料压缩成摘要；每个页面要围绕一个学习动作或心智模型推进。",
    "保留 sourceAnchorIds，并让反馈解释原因、机制和误区。"
  ].join("\n");
}

function buildRunConfig(runId: string, project: LearnerProjectFile): RunConfig {
  const brief = project.brief;
  const sourcePath = brief?.sourcePath;
  const isUrl = sourcePath ? /^https?:\/\//u.test(sourcePath) : false;
  const sourceLooksLikeFolder = sourcePath ? !isUrl && !/\.[a-z0-9]{1,8}$/iu.test(sourcePath) : false;

  return createRunConfigFromArgs({
    run: runId,
    topic: !sourcePath ? brief?.topic : undefined,
    sourceFile: sourcePath && !isUrl && !sourceLooksLikeFolder ? sourcePath : undefined,
    sourceFolder: sourcePath && sourceLooksLikeFolder ? sourcePath : undefined,
    sourceUrl: sourcePath && isUrl ? sourcePath : undefined,
    sourceKind: brief?.sourceKind === "topic" ? undefined : brief?.sourceKind,
    sourceTitle: sourcePath ? brief?.topic : undefined,
    unitPages: String(brief?.unitPages ?? 8),
    strategy: brief?.strategy,
    chapters: brief?.selectedChapters?.join(","),
    topics: brief?.selectedTopics?.join(","),
    audience: brief?.audience,
    language: brief?.language,
    adapter: "mock"
  });
}

function ensureAnchorIds(anchorIds: string[], config: RunConfig): string[] {
  if (anchorIds.length > 0) {
    return uniqueStrings(anchorIds);
  }
  const sourceId = config.sources[0]?.id ?? "source-001";
  return [`${sourceId}:root`];
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
