import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { ArtifactStore } from "../artifact-store.js";
import type { SourceAnchor } from "../corpus-types.js";
import { AgentRuntimeError } from "../errors.js";
import { buildLessonCriticReport, type LessonCriticReport } from "../quality/lesson-critic.js";
import { analyzeSourceEvidence, type SourceEvidenceSummary } from "../quality/source-evidence-analyzer.js";
import { createRunConfigFromArgs } from "../run-config.js";
import type { RunConfig } from "../types.js";
import { normalizeSources } from "../source/source-normalizer.js";
import { planCourseUnits, type PlannedCourseUnit } from "./course-unit-planner.js";
import { LearningCoursePublisher, type PublishLearningCourseResult } from "./learning-course-publisher.js";
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

type RevisionBrief = {
  revisionId: string;
  feedback: string;
  focus?: string;
};

export type GenerateGroundedCourseInput = {
  runId: string;
  maxAnchorsPerLesson?: number;
};

export type GenerateGroundedCourseResult = PublishLearningCourseResult & {
  sourceIngest: {
    artifactPath: string;
    draftPath: string;
    anchorCount: number;
    warningCount: number;
  };
  sourceEvidence: SourceEvidenceSummary;
  criticReports: LessonCriticReport[];
  revisionApplied?: RevisionBrief;
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export class GroundedCourseService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async generate(input: GenerateGroundedCourseInput): Promise<GenerateGroundedCourseResult> {
    assertSafeRunId(input.runId);
    const maxAnchorsPerLesson = input.maxAnchorsPerLesson ?? 8;
    if (!Number.isInteger(maxAnchorsPerLesson) || maxAnchorsPerLesson < 1 || maxAnchorsPerLesson > 20) {
      throw new AgentRuntimeError("maxAnchorsPerLesson must be an integer between 1 and 20", "INVALID_RUN_CONFIG");
    }

    const project = await readLearnerProject(this.workspaceRoot, input.runId);
    const config = buildRunConfig(input.runId, project);
    const normalizedSources = await normalizeSources(config.sources);
    const sourceAnchorIds = ensureAnchorIds(
      normalizedSources.anchors.map((anchor) => anchor.anchorId),
      config
    );
    const sourceIngest = buildSourceIngestArtifact(config, normalizedSources.anchors, sourceAnchorIds, normalizedSources.extractionWarnings);
    const artifactStore = new ArtifactStore(path.join(this.workspaceRoot, "runs", input.runId));
    const sourceIngestWrite = await artifactStore.writeDraft("source-ingest", sourceIngest);
    const revision = await readLatestRevisionBrief(this.workspaceRoot, input.runId);
    const bundle = buildGroundedBundle({
      config,
      sourceAnchorIds: sourceAnchorIds.slice(0, maxAnchorsPerLesson),
      concepts: lessonConceptLabels(config, sourceIngest.concepts.map((concept) => concept.label)),
      revision
    });
    const sourceEvidence = analyzeSourceEvidence(bundle.lessons, config);
    const criticReports = bundle.lessons.map((lesson) => buildLessonCriticReport(lesson, config));
    await artifactStore.writeDraft("critic-report", {
      artifactId: "critic-report",
      roleId: "lesson-critic",
      status: criticReports.every((report) => report.status === "passed") ? "passed" : "revision_required",
      reports: criticReports
    });

    const published = await new LearningCoursePublisher(this.workspaceRoot).publish({
      runId: input.runId,
      lessons: bundle.lessons,
      coursePack: bundle.coursePack,
      publishNotes: revision
        ? `Grounded course generated from normalized source anchors. Applied ${revision.revisionId}: ${revision.feedback}`
        : "Grounded course generated from normalized source anchors."
    });

    return {
      ...published,
      sourceIngest: {
        artifactPath: sourceIngestWrite.path,
        draftPath: sourceIngestWrite.draftPath,
        anchorCount: normalizedSources.anchors.length,
        warningCount: normalizedSources.extractionWarnings.length
      },
      sourceEvidence,
      criticReports,
      ...(revision ? { revisionApplied: revision } : {})
    };
  }
}

function buildRunConfig(runId: string, project: LearnerProjectFile): RunConfig {
  const brief = project.brief;
  if (!brief?.sourcePath) {
    throw new AgentRuntimeError("generate_grounded_course requires a learner project with sourcePath", "INVALID_RUN_CONFIG");
  }

  const sourcePath = brief.sourcePath;
  const isUrl = /^https?:\/\//u.test(sourcePath);
  const sourceLooksLikeFolder = !isUrl && !/\.[a-z0-9]{1,8}$/iu.test(sourcePath);

  return createRunConfigFromArgs({
    run: runId,
    sourceFile: !isUrl && !sourceLooksLikeFolder ? sourcePath : undefined,
    sourceFolder: sourceLooksLikeFolder ? sourcePath : undefined,
    sourceUrl: isUrl ? sourcePath : undefined,
    sourceKind: brief.sourceKind,
    sourceTitle: usableSourceTitle(brief.topic),
    unitPages: String(brief.unitPages ?? 8),
    strategy: brief.strategy,
    chapters: brief.selectedChapters?.join(","),
    topics: brief.selectedTopics?.join(","),
    audience: brief.audience,
    language: brief.language,
    adapter: "mock"
  });
}

function buildSourceIngestArtifact(
  config: RunConfig,
  anchors: SourceAnchor[],
  sourceAnchorIds: string[],
  extractionWarnings: unknown[]
): {
  artifactId: "source-ingest";
  roleId: "source-ingest";
  language: string;
  topic: string;
  sourceKind: string;
  sourceAnchorIds: string[];
  concepts: Array<{ id: string; label: string; sourceAnchorIds: string[] }>;
  dependencies: Array<{ from: string; to: string; relation: string; sourceAnchorIds: string[] }>;
  examples: Array<{ id: string; title: string; sourceAnchorIds: string[] }>;
  misconceptions: Array<{ id: string; statement: string; correction: string; sourceAnchorIds: string[] }>;
  candidateInteractions: Array<{ id: string; type: string; learnerAction: string; feedback: string; sourceAnchorIds: string[] }>;
  anchors: SourceAnchor[];
  extractionWarnings: unknown[];
} {
  const semantics = extractSourceSemantics({ sourceKind: config.sourceKind ?? "unknown", anchors });
  const concepts = withFallbackAnchorIds(semantics.concepts, sourceAnchorIds);

  return {
    artifactId: "source-ingest",
    roleId: "source-ingest",
    language: config.outputLanguage,
    topic: config.topic,
    sourceKind: config.sourceKind ?? "unknown",
    sourceAnchorIds,
    concepts,
    dependencies: concepts.slice(1).map((concept, index) => ({
      from: concepts[index]?.id ?? concepts[0]?.id ?? concept.id,
      to: concept.id,
      relation: "supports_next_learning_step",
      sourceAnchorIds: concept.sourceAnchorIds
    })),
    examples: withFallbackAnchorIds(semantics.examples, sourceAnchorIds),
    misconceptions: withFallbackAnchorIds(semantics.misconceptions, sourceAnchorIds),
    candidateInteractions: [
      {
        id: "choose-grounded-claim",
        type: "choice",
        learnerAction: "选择一个解释是否有来源依据",
        feedback: "反馈会说明该解释是否连接了来源锚点、因果机制和适用边界。",
        sourceAnchorIds: sourceAnchorIds.slice(0, 2)
      },
      {
        id: "select-next-learning-path",
        type: "choice",
        learnerAction: "选择先看总览、机制、误区还是迁移任务",
        feedback: `反馈会解释不同阅读路径适合的学习目标：${semantics.teachingAngles.join("；")}。`,
        sourceAnchorIds: sourceAnchorIds.slice(0, 2)
      }
    ],
    anchors,
    extractionWarnings
  };
}

function buildGroundedBundle({
  config,
  sourceAnchorIds,
  concepts,
  revision
}: {
  config: RunConfig;
  sourceAnchorIds: string[];
  concepts: string[];
  revision?: RevisionBrief;
}): { coursePack: Record<string, unknown>; lessons: Array<Record<string, unknown>> } {
  const targetPageCount = config.coursePack?.unitPageCount ?? config.pageCount.target;
  const unitPlan = planCourseUnits({
    runId: config.runId,
    topic: config.topic,
    sourceKind: config.sourceKind ?? "unknown",
    strategy: config.coursePack?.strategy ?? "overview_plus_topic",
    unitPageCount: targetPageCount,
    selectedTopics: config.coursePack?.selectedTopics ?? [],
    selectedChapters: config.coursePack?.selectedChapters ?? [],
    concepts,
    sourceAnchorIds,
    sourceNodeIds: config.sources.map((source) => `${source.id}:root`)
  });
  const lessons = unitPlan.units.map((unit) =>
    buildLesson({
      id: unit.lessonId,
      title: unit.title,
      unitTitle: unit.title,
      config,
      sourceAnchorIds: unit.sourceAnchorIds,
      concepts: unit.focusConcepts.length > 0 ? unit.focusConcepts : concepts,
      targetPageCount,
      revision
    })
  );

  return {
    lessons,
    coursePack: {
      id: config.runId,
      title: `${config.topic}：课程包`,
      parentRunId: config.runId,
      sourceKind: config.sourceKind ?? "unknown",
      strategy: config.coursePack?.strategy ?? "overview_plus_topic",
      audience: config.audience,
      language: "zh-CN",
      overviewUnitId: unitPlan.overviewUnitId,
      units: unitPlan.units.map(toCoursePackUnit)
    }
  };
}

function toCoursePackUnit(unit: PlannedCourseUnit): Record<string, unknown> {
  return {
    unitId: unit.unitId,
    title: unit.title,
    kind: unit.kind,
    lessonId: unit.lessonId,
    targetPageCount: unit.targetPageCount,
    sourceAnchorIds: unit.sourceAnchorIds,
    sourceNodeIds: unit.sourceNodeIds,
    chapterRefs: unit.chapterRefs,
    conceptIds: unit.conceptIds
  };
}

function buildLesson({
  id,
  title,
  unitTitle,
  config,
  sourceAnchorIds,
  concepts,
  targetPageCount,
  revision
}: {
  id: string;
  title: string;
  unitTitle: string;
  config: RunConfig;
  sourceAnchorIds: string[];
  concepts: string[];
  targetPageCount: number;
  revision?: RevisionBrief;
}): Record<string, unknown> {
  const safeAnchors = sourceAnchorIds.length > 0 ? sourceAnchorIds : ensureAnchorIds([], config);
  return {
    id,
    title,
    audience: config.audience,
    config: {
      targetPageCount,
      minPageCount: Math.max(1, targetPageCount - 2),
      maxPageCount: targetPageCount + 2
    },
    sourceContext: {
      sourcePath: primarySourceValue(config),
      sourceKind: config.sourceKind,
      sourceAnchorIds: safeAnchors,
      chapterRefs: config.coursePack?.selectedChapters,
      conceptIds: concepts.map((concept, index) => `concept-${String(index + 1).padStart(2, "0")}`)
    },
    prerequisites: ["能阅读基础技术材料", "希望通过中文互动课程建立可迁移心智模型"],
    learningObjectives: [
      `解释${unitTitle}的核心问题和来源依据`,
      `用可视化结构说明${concepts[0] ?? "核心概念"}如何发挥作用`,
      "通过行动、反馈和迁移任务检查理解是否可靠"
    ],
    pages: buildPages({ unitTitle, concepts, sourceAnchorIds: safeAnchors, targetPageCount, revision }),
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
      `${unitTitle} 的学习重点是先建立来源地图，再进入机制。`,
      "每个可靠解释都应该连接来源锚点、因果链和适用边界。",
      "能在新材料中复用这套判断方式，才说明心智模型真正形成。"
    ]
  };
}

function buildPages({
  unitTitle,
  concepts,
  sourceAnchorIds,
  targetPageCount,
  revision
}: {
  unitTitle: string;
  concepts: string[];
  sourceAnchorIds: string[];
  targetPageCount: number;
  revision?: RevisionBrief;
}): Array<Record<string, unknown>> {
  const revisionLine = revision ? "已根据最新反馈降低术语密度，并增加新手行动提示。" : "";
  const basePages: Array<Record<string, unknown>> = [
    page("page-01", "problem_scene", `${unitTitle}：先看学习问题`, "识别这份资料最需要解决的理解问题", `${unitTitle} 不能只被压缩成摘要；学习者需要看见问题、机制和边界。${revisionLine}`, sourceAnchorIds, {
      visual: true
    }),
    page("page-02", "intuition_visual", "先画来源地图，再进入细节", "用地图直觉理解总览课", `把资料看成一张地图：先知道核心区域，再决定深入 ${concepts[0] ?? "核心概念"}。`, sourceAnchorIds, {
      visual: true
    }),
    page("page-03", "structure_diagram", "问题、机制、证据、边界", "看见可靠解释的结构", `可靠学习路径要把 ${concepts.slice(0, 3).join("、") || "核心概念"} 放进同一张结构图。`, sourceAnchorIds, {
      visual: true
    }),
    page("page-04", "interactive_model", "选择下一步学习路径", "通过选择理解学习顺序", "新手行动提示：先选一个你最不确定的概念，再查看它连接了哪些来源依据。", sourceAnchorIds, {
      interaction: "path"
    }),
    page("page-05", "interactive_model", "判断解释是否可靠", "用来源和反馈校验解释", "学习者判断一个说法是否既有来源依据，也说明了因果机制和适用边界。", sourceAnchorIds, {
      interaction: "claim"
    }),
    page("page-06", "quiz", "哪种理解更可靠", "检查是否区分摘要和心智模型", "先做预测，再用反馈修正学习策略。", sourceAnchorIds, {
      assessment: "quiz"
    }),
    page("page-07", "misconception_check", "误区：资料越长越难学", "识别资料长度误区", "难点通常不是页数，而是没有把概念、例子、边界和行动连接起来。", sourceAnchorIds, {
      assessment: "misconception"
    }),
    page("page-08", "summary_card", "总览记忆卡", "压缩可迁移学习模型", "用五步记住这课：问题、来源、结构、行动、迁移。", sourceAnchorIds, {
      visual: true
    }),
    page("page-09", "code_walkthrough", "把资料变成执行协议", "把学习路径连接到可执行步骤", "用短协议描述：读取来源、抽概念、设计互动、检查反馈、发布网页。", sourceAnchorIds, {
      code: true
    }),
    page("page-10", "transfer_challenge", "迁移到下一份资料", "把同一心智模型迁移到新材料", "选择一篇论文、专利或博客，按同样方式标出来源依据、核心机制和误区。", sourceAnchorIds, {
      assessment: "transfer"
    })
  ];

  if (targetPageCount >= basePages.length) {
    const expanded = [...basePages];
    while (expanded.length < targetPageCount) {
      const index = expanded.length + 1;
      expanded.splice(expanded.length - 1, 0, {
        ...page(
          `page-${String(index).padStart(2, "0")}`,
          "interactive_model",
          `补充练习 ${index - 9}`,
          "用更多行动巩固来源到机制的连接",
          "选择一个来源锚点，说明它支持哪个概念，以及这个概念可以迁移到什么新场景。",
          sourceAnchorIds,
          { interaction: index % 2 === 0 ? "path" : "claim" }
        )
      });
    }
    return expanded;
  }

  const summary = basePages.find((pageItem) => pageItem.type === "summary_card") ?? basePages.at(-1);
  const bodyTarget = Math.max(0, targetPageCount - 1);
  return [...basePages.filter((pageItem) => pageItem !== summary).slice(0, bodyTarget), summary].filter(
    (item): item is Record<string, unknown> => Boolean(item)
  );
}

function page(
  id: string,
  type: string,
  title: string,
  learningGoal: string,
  narrative: string,
  sourceAnchorIds: string[],
  options: { visual?: boolean; interaction?: "path" | "claim"; assessment?: "quiz" | "misconception" | "transfer"; code?: boolean }
): Record<string, unknown> {
  return {
    id,
    type,
    title,
    learningGoal,
    narrative,
    sourceAnchorIds,
    ...(options.visual
      ? {
          visualSpec: {
            kind: "diagram",
            description: "用中文图示展示来源、结构、行动和反馈之间的关系。",
            keyElements: ["来源依据", "核心机制", "学习动作", "反馈", "迁移"]
          }
        }
      : {}),
    ...(options.interaction ? { interactionSpec: interactionSpec(options.interaction) } : {}),
    ...(options.assessment ? assessmentFields(options.assessment) : {}),
    ...(options.code
      ? {
          code: {
            language: "text",
            value: "1. 读取来源锚点\n2. 抽取核心概念\n3. 设计学习动作\n4. 用反馈修正误区\n5. 迁移到新问题"
          }
        }
      : {})
  };
}

function interactionSpec(kind: "path" | "claim"): Record<string, unknown> {
  if (kind === "claim") {
    return {
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
    };
  }

  return {
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
  };
}

function assessmentFields(kind: "quiz" | "misconception" | "transfer"): Record<string, unknown> {
  if (kind === "transfer") {
    return {
      assessmentSpec: {
        kind: "transfer",
        prompt: "如果换成一份专利或论文，你会先检查哪三类信息？",
        options: ["来源依据、核心机制、适用边界", "标题、作者、页数"],
        correctAnswer: "来源依据、核心机制、适用边界"
      },
      feedbackSpec: {
        correctFeedback: "正确。迁移时先抓依据、机制和边界，才能避免把摘要误当理解。",
        incorrectFeedback: "不对。标题和页数只能帮助定位，不能证明你理解了机制。"
      }
    };
  }
  if (kind === "misconception") {
    return {
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "资料很长时，最容易出现的学习误区是什么？",
        options: ["以为摘要越完整就越懂", "先找来源依据和概念结构"],
        correctAnswer: "以为摘要越完整就越懂"
      },
      feedbackSpec: {
        correctFeedback: "正确。摘要只是入口，真正理解还需要动作、反馈和迁移。",
        incorrectFeedback: "不对。先找来源和结构是降低复杂度的有效方法。"
      }
    };
  }
  return {
    assessmentSpec: {
      kind: "multiple_choice",
      prompt: "哪种学习结果最能说明你建立了心智模型？",
      options: ["能把机制迁移到新问题", "记住了更多原文句子"],
      correctAnswer: "能把机制迁移到新问题"
    },
    feedbackSpec: {
      correctFeedback: "正确。迁移说明你抓住了机制，而不是只记住表述。",
      incorrectFeedback: "不对。记住原文有帮助，但不能单独证明你能应用机制。"
    }
  };
}

function usableSourceTitle(topic: string | undefined): string | undefined {
  const normalized = topic?.trim();
  if (!normalized || ["中文", "课程", "学习材料", "学习网页"].includes(normalized)) {
    return undefined;
  }
  return normalized;
}

function lessonConceptLabels(config: RunConfig, semanticConceptLabels: string[]): string[] {
  const selectedTopics = config.coursePack?.selectedTopics ?? [];
  const [overviewConcept, ...restSemanticConcepts] = semanticConceptLabels;
  return uniqueStrings([overviewConcept ?? "全局地图", ...selectedTopics, ...restSemanticConcepts]);
}

function primarySourceValue(config: RunConfig): string | undefined {
  if (config.source.type === "mixed") {
    return config.source.items[0]?.value;
  }
  return config.source.value;
}

function withFallbackAnchorIds<T extends { sourceAnchorIds: string[] }>(items: T[], fallbackAnchorIds: string[]): T[] {
  return items.map((item) => ({
    ...item,
    sourceAnchorIds: item.sourceAnchorIds.length > 0 ? item.sourceAnchorIds : fallbackAnchorIds.slice(0, 1)
  }));
}

function ensureAnchorIds(anchorIds: string[], config: RunConfig): string[] {
  if (anchorIds.length > 0) {
    return uniqueStrings(anchorIds);
  }
  const sourceId = config.sources[0]?.id ?? "source-001";
  return [`${sourceId}:root`];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
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

async function readLatestRevisionBrief(workspaceRoot: string, runId: string): Promise<RevisionBrief | undefined> {
  const revisionsDir = path.join(workspaceRoot, "runs", runId, "learning-revisions");
  let entries: string[];
  try {
    entries = await readdir(revisionsDir);
  } catch (error) {
    if (isFileNotFound(error)) {
      return undefined;
    }
    throw error;
  }
  const latest = entries.filter((entry) => /^revision-[0-9]{3}\.json$/u.test(entry)).sort().at(-1);
  if (!latest) {
    return undefined;
  }
  const parsed = JSON.parse(await readFile(path.join(revisionsDir, latest), "utf8")) as unknown;
  if (!isRecord(parsed) || typeof parsed.revisionId !== "string" || typeof parsed.feedback !== "string") {
    return undefined;
  }
  return {
    revisionId: parsed.revisionId,
    feedback: parsed.feedback,
    ...(typeof parsed.focus === "string" ? { focus: parsed.focus } : {})
  };
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
