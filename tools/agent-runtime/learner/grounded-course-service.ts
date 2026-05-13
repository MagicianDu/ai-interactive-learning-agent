import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { ArtifactStore } from "../artifact-store.js";
import type { SourceAnchor } from "../corpus-types.js";
import { AgentRuntimeError } from "../errors.js";
import { buildLessonCriticReport, type LessonCriticReport } from "../quality/lesson-critic.js";
import { analyzeSourceEvidence, type SourceEvidenceSummary } from "../quality/source-evidence-analyzer.js";
import { createRunConfigFromArgs } from "../run-config.js";
import type { RunConfig } from "../types.js";
import { buildSourceGraph, type SourceGraph } from "../source/source-graph.js";
import { normalizeSources } from "../source/source-normalizer.js";
import { planCourseUnits, type PlannedCourseUnit } from "./course-unit-planner.js";
import { LearningCoursePublisher, type PublishLearningCourseResult } from "./learning-course-publisher.js";
import { difficultyLabel, type TeachingDifficultyLevel } from "./learner-project-service.js";
import { extractSourceSemantics, type SourceSemantics } from "./source-semantic-extractor.js";

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
    difficultyLevel?: TeachingDifficultyLevel;
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
  sourceGraph: {
    status: "passed" | "warning" | "failed";
    sourceKind: SourceGraph["sourceKind"];
    graphPath: string;
    anchorsPath: string;
    conceptsPath: string;
    coveragePath: string;
    sourceUnitCount: number;
    conceptCount: number;
    misconceptionCount: number;
    candidateInteractionCount: number;
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
    const semantics = extractSourceSemantics({
      sourceKind: config.sourceKind ?? "unknown",
      anchors: normalizedSources.anchors
    });
    const sourceIngest = buildSourceIngestArtifact(config, normalizedSources.anchors, sourceAnchorIds, normalizedSources.extractionWarnings, semantics);
    const sourceGraph = buildSourceGraph({
      runId: input.runId,
      sourceKind: config.sourceKind ?? "unknown",
      structure: normalizedSources.structure,
      anchors: normalizedSources.anchors,
      semantics
    });
    const artifactStore = new ArtifactStore(path.join(this.workspaceRoot, "runs", input.runId));
    const sourceIngestWrite = await artifactStore.writeDraft("source-ingest", sourceIngest);
    const sourceGraphWrites = {
      graph: await artifactStore.writeDraft("source-graph", sourceGraph),
      anchors: await artifactStore.writeDraft("source-anchors", {
        artifactId: "source-anchors",
        roleId: "source-ingest",
        runId: input.runId,
        sourceAnchorIds,
        anchors: normalizedSources.anchors
      }),
      concepts: await artifactStore.writeDraft("source-concepts", {
        artifactId: "source-concepts",
        roleId: "source-ingest",
        runId: input.runId,
        concepts: sourceGraph.concepts,
        examples: sourceGraph.examples,
        misconceptions: sourceGraph.misconceptions,
        candidateInteractions: sourceGraph.candidateInteractions
      }),
      coverage: await artifactStore.writeDraft("source-coverage", {
        artifactId: "source-coverage",
        roleId: "source-ingest",
        runId: input.runId,
        coverage: sourceGraph.coverage,
        sourceUnits: sourceGraph.sourceUnits.map((unit) => ({
          id: unit.id,
          title: unit.title,
          kind: unit.kind,
          role: unit.role,
          anchorIds: unit.anchorIds
        }))
      })
    };
    const revision = await readLatestRevisionBrief(this.workspaceRoot, input.runId);
    const bundle = buildGroundedBundle({
      config,
      sourceAnchorIds: sourceAnchorIds.slice(0, maxAnchorsPerLesson),
      concepts: lessonConceptLabels(config, sourceIngest.concepts.map((concept) => concept.label)),
      sourceTerms: semantics.keyTerms.map((term) => term.term),
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
      ignoreContentBlueprint: true,
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
      sourceGraph: {
        status: sourceGraphStatus(sourceGraph),
        sourceKind: sourceGraph.sourceKind,
        graphPath: sourceGraphWrites.graph.path,
        anchorsPath: sourceGraphWrites.anchors.path,
        conceptsPath: sourceGraphWrites.concepts.path,
        coveragePath: sourceGraphWrites.coverage.path,
        sourceUnitCount: sourceGraph.coverage.sourceUnitCount,
        conceptCount: sourceGraph.coverage.conceptCount,
        misconceptionCount: sourceGraph.coverage.misconceptionCount,
        candidateInteractionCount: sourceGraph.coverage.candidateInteractionCount
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
    difficultyLevel: brief.difficultyLevel,
    adapter: "mock"
  });
}

function buildSourceIngestArtifact(
  config: RunConfig,
  anchors: SourceAnchor[],
  sourceAnchorIds: string[],
  extractionWarnings: unknown[],
  semantics: SourceSemantics
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

function sourceGraphStatus(sourceGraph: SourceGraph): "passed" | "warning" | "failed" {
  if (sourceGraph.coverage.sourceUnitCount === 0 || sourceGraph.coverage.conceptCount === 0) {
    return "failed";
  }
  if (
    sourceGraph.coverage.conceptCount < 5 ||
    sourceGraph.coverage.misconceptionCount < 2 ||
    sourceGraph.coverage.candidateInteractionCount < 2
  ) {
    return "warning";
  }
  return "passed";
}

function buildGroundedBundle({
  config,
  sourceAnchorIds,
  concepts,
  sourceTerms,
  revision
}: {
  config: RunConfig;
  sourceAnchorIds: string[];
  concepts: string[];
  sourceTerms: string[];
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
      sourceTerms,
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
    conceptIds: unit.conceptIds,
    ...(unit.taskLabel ? { taskLabel: unit.taskLabel } : {}),
    transferExpectation: unit.transferExpectation,
    expectedInteractions: unit.expectedInteractions,
    expectedAssessments: unit.expectedAssessments,
    expectedSourceCoverage: unit.expectedSourceCoverage
  };
}

function buildLesson({
  id,
  title,
  unitTitle,
  config,
  sourceAnchorIds,
  concepts,
  sourceTerms,
  targetPageCount,
  revision
}: {
  id: string;
  title: string;
  unitTitle: string;
  config: RunConfig;
  sourceAnchorIds: string[];
  concepts: string[];
  sourceTerms: string[];
  targetPageCount: number;
  revision?: RevisionBrief;
}): Record<string, unknown> {
  const safeAnchors = sourceAnchorIds.length > 0 ? sourceAnchorIds : ensureAnchorIds([], config);
  const difficulty = difficultyProfile(teachingDifficultyLevel(config));
  return {
    id,
    title,
    audience: config.audience,
    difficultyLevel: difficulty.level,
    academicLabel: difficulty.label,
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
    prerequisites: ["能阅读基础技术材料", ...difficulty.prerequisites, "希望通过中文互动课程建立可迁移心智模型"],
    learningObjectives: [
      `解释${unitTitle}的核心问题和来源依据`,
      `用可视化结构说明${concepts[0] ?? "核心概念"}如何发挥作用`,
      difficulty.objective,
      "通过行动、反馈和迁移任务检查理解是否可靠"
    ],
    pages: buildPages({ unitTitle, concepts, sourceTerms, sourceAnchorIds: safeAnchors, targetPageCount, revision, difficulty }),
    misconceptions: [
      {
        id: "misconception-summary",
        statement: "读完摘要就等于理解了资料。",
        correction: `理解需要把来源证据、机制、操作动作、反馈和迁移场景连接起来。${difficulty.misconceptionCorrection}`
      }
    ],
    transferTasks: [
      {
        id: "transfer-new-source",
        prompt: difficulty.transferPrompt,
        targetMentalModel: difficulty.transferMentalModel
      }
    ],
    summary: [
      `${unitTitle} 的学习重点是先建立来源地图，再进入机制。本单元定位为${difficulty.label}。`,
      difficulty.summaryLine,
      "每个可靠解释都应该连接来源锚点、因果链和适用边界。",
      "能在新材料中复用这套判断方式，才说明心智模型真正形成。"
    ]
  };
}

function buildPages({
  unitTitle,
  concepts,
  sourceTerms,
  sourceAnchorIds,
  targetPageCount,
  revision,
  difficulty
}: {
  unitTitle: string;
  concepts: string[];
  sourceTerms: string[];
  sourceAnchorIds: string[];
  targetPageCount: number;
  revision?: RevisionBrief;
  difficulty: DifficultyProfile;
}): Array<Record<string, unknown>> {
  const revisionLine = revision ? "已根据最新反馈降低术语密度，并增加新手行动提示。" : "";
  const basePages: Array<Record<string, unknown>> = [
    page("page-01", "problem_scene", `${unitTitle}：先看学习问题`, "识别这份资料最需要解决的理解问题", `${unitTitle} 不能只被压缩成摘要；学习者需要看见问题、机制和边界。${difficulty.openingFrame}${revisionLine}`, sourceAnchorIds, {
      visual: true
    }, difficulty, sourceTerms),
    page("page-02", "intuition_visual", "先画来源地图，再进入细节", "用地图直觉理解总览课", `把资料看成一张地图：先知道核心区域，再决定深入 ${concepts[0] ?? "核心概念"}。${difficulty.intuitionFrame}`, sourceAnchorIds, {
      visual: true
    }, difficulty, sourceTerms),
    page("page-03", "structure_diagram", "问题、机制、证据、边界", "看见可靠解释的结构", `可靠学习路径要把 ${concepts.slice(0, 3).join("、") || "核心概念"} 放进同一张结构图。${difficulty.structureFrame}`, sourceAnchorIds, {
      visual: true
    }, difficulty, sourceTerms),
    page("page-04", "interactive_model", "选择下一步学习路径", "通过选择理解学习顺序", difficulty.actionPrompt, sourceAnchorIds, {
      interaction: "path"
    }, difficulty, sourceTerms),
    page("page-05", "interactive_model", "判断解释是否可靠", "用来源和反馈校验解释", `学习者判断一个说法是否既有来源依据，也说明了因果机制和适用边界。${difficulty.claimFrame}`, sourceAnchorIds, {
      interaction: "claim"
    }, difficulty, sourceTerms),
    page("page-06", "quiz", "哪种理解更可靠", "检查是否区分摘要和心智模型", `先做预测，再用反馈修正学习策略。${difficulty.assessmentFrame}`, sourceAnchorIds, {
      assessment: "quiz"
    }, difficulty, sourceTerms),
    page("page-07", "misconception_check", "误区：资料越长越难学", "识别资料长度误区", `难点通常不是页数，而是没有把概念、例子、边界和行动连接起来。${difficulty.misconceptionFrame}`, sourceAnchorIds, {
      assessment: "misconception"
    }, difficulty, sourceTerms),
    page("page-08", "summary_card", "总览记忆卡", "压缩可迁移学习模型", `用五步记住这课：问题、来源、结构、行动、迁移。${difficulty.summaryLine}`, sourceAnchorIds, {
      visual: true
    }, difficulty, sourceTerms),
    page("page-09", "code_walkthrough", "把资料变成执行协议", "把学习路径连接到可执行步骤", `用短协议描述：读取来源、抽概念、设计互动、检查反馈、发布网页。${difficulty.protocolFrame}`, sourceAnchorIds, {
      code: true
    }, difficulty, sourceTerms),
    page("page-10", "transfer_challenge", "迁移到下一份资料", "把同一心智模型迁移到新材料", difficulty.transferPrompt, sourceAnchorIds, {
      assessment: "transfer"
    }, difficulty, sourceTerms)
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
          `选择一个来源锚点，说明它支持哪个概念，以及这个概念可以迁移到什么新场景。${difficulty.practiceFrame}`,
          sourceAnchorIds,
          { interaction: index % 2 === 0 ? "path" : "claim" },
          difficulty,
          sourceTerms
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
  options: { visual?: boolean; interaction?: "path" | "claim"; assessment?: "quiz" | "misconception" | "transfer"; code?: boolean },
  difficulty: DifficultyProfile,
  sourceTerms: string[] = []
): Record<string, unknown> {
  const groundedNarrative = narrativeWithSourceTerms(narrative, sourceAnchorIds, sourceTerms);
  return {
    id,
    type,
    title,
    learningGoal,
    narrative: groundedNarrative,
    sourceAnchorIds,
    ...(options.visual
      ? {
          visualSpec: {
            kind: "diagram",
            description: difficulty.visualDescription,
            keyElements: ["来源依据", "核心机制", "学习动作", "反馈", "迁移", ...difficulty.visualKeyElements]
          }
        }
      : {}),
    ...(options.interaction ? { interactionSpec: interactionSpec(options.interaction, difficulty) } : {}),
    ...(options.assessment ? assessmentFields(options.assessment, difficulty) : {}),
    ...(options.code
      ? {
          code: {
            language: "text",
            value: difficulty.protocol
          }
        }
      : {})
  };
}

function narrativeWithSourceTerms(narrative: string, sourceAnchorIds: string[], sourceTerms: string[]): string {
  const usefulTerms = sourceTerms.filter((term) => term.trim().length > 0).slice(0, 3);
  if (sourceAnchorIds.length === 0 || usefulTerms.length === 0 || usefulTerms.some((term) => includesIgnoreCase(narrative, term))) {
    return narrative;
  }
  return `${narrative}来源术语：${usefulTerms.join("、")}。`;
}

function includesIgnoreCase(text: string, term: string): boolean {
  return text.toLocaleLowerCase().includes(term.toLocaleLowerCase());
}

function interactionSpec(kind: "path" | "claim", difficulty: DifficultyProfile): Record<string, unknown> {
  if (kind === "claim") {
    return {
      kind: "choice",
      learnerAction: difficulty.claimAction,
      expectedObservation: difficulty.claimObservation,
      cognitivePurpose: difficulty.claimPurpose,
      options: [
        {
          id: "grounded",
          label: difficulty.groundedClaimLabel,
          resultTitle: difficulty.groundedClaimTitle,
          outcomeId: "grounded-claim",
          resultTone: "success",
          explanation: difficulty.groundedClaimFeedback
        },
        {
          id: "loose",
          label: difficulty.looseClaimLabel,
          resultTitle: difficulty.looseClaimTitle,
          outcomeId: "loose-claim",
          resultTone: "warning",
          explanation: difficulty.looseClaimFeedback
        }
      ]
    };
  }

  return {
    kind: "choice",
    learnerAction: difficulty.pathAction,
    expectedObservation: difficulty.pathObservation,
    cognitivePurpose: difficulty.pathPurpose,
    options: [
      {
        id: "overview-first",
        label: difficulty.primaryPathLabel,
        resultTitle: difficulty.primaryPathTitle,
        outcomeId: "overview-path",
        resultTone: "success",
        explanation: difficulty.primaryPathFeedback
      },
      {
        id: "edge-first",
        label: difficulty.secondaryPathLabel,
        resultTitle: difficulty.secondaryPathTitle,
        outcomeId: "edge-path",
        resultTone: "neutral",
        explanation: difficulty.secondaryPathFeedback
      }
    ]
  };
}

function assessmentFields(kind: "quiz" | "misconception" | "transfer", difficulty: DifficultyProfile): Record<string, unknown> {
  if (kind === "transfer") {
    return {
      assessmentSpec: {
        kind: "transfer",
        prompt: difficulty.transferAssessmentPrompt,
        options: difficulty.transferOptions,
        correctAnswer: difficulty.transferCorrectAnswer
      },
      feedbackSpec: {
        correctFeedback: difficulty.transferCorrectFeedback,
        incorrectFeedback: difficulty.transferIncorrectFeedback
      }
    };
  }
  if (kind === "misconception") {
    return {
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: difficulty.misconceptionPrompt,
        options: difficulty.misconceptionOptions,
        correctAnswer: difficulty.misconceptionAnswer
      },
      feedbackSpec: {
        correctFeedback: difficulty.misconceptionCorrectFeedback,
        incorrectFeedback: difficulty.misconceptionIncorrectFeedback
      }
    };
  }
  return {
    assessmentSpec: {
      kind: "multiple_choice",
      prompt: difficulty.quizPrompt,
      options: difficulty.quizOptions,
      correctAnswer: difficulty.quizAnswer
    },
    feedbackSpec: {
      correctFeedback: difficulty.quizCorrectFeedback,
      incorrectFeedback: difficulty.quizIncorrectFeedback
    }
  };
}

type DifficultyProfile = {
  level: TeachingDifficultyLevel;
  label: string;
  prerequisites: string[];
  objective: string;
  openingFrame: string;
  intuitionFrame: string;
  structureFrame: string;
  actionPrompt: string;
  claimFrame: string;
  assessmentFrame: string;
  misconceptionFrame: string;
  misconceptionCorrection: string;
  summaryLine: string;
  protocolFrame: string;
  practiceFrame: string;
  transferPrompt: string;
  transferMentalModel: string;
  visualDescription: string;
  visualKeyElements: string[];
  protocol: string;
  pathAction: string;
  pathObservation: string;
  pathPurpose: string;
  primaryPathLabel: string;
  primaryPathTitle: string;
  primaryPathFeedback: string;
  secondaryPathLabel: string;
  secondaryPathTitle: string;
  secondaryPathFeedback: string;
  claimAction: string;
  claimObservation: string;
  claimPurpose: string;
  groundedClaimLabel: string;
  groundedClaimTitle: string;
  groundedClaimFeedback: string;
  looseClaimLabel: string;
  looseClaimTitle: string;
  looseClaimFeedback: string;
  quizPrompt: string;
  quizOptions: string[];
  quizAnswer: string;
  quizCorrectFeedback: string;
  quizIncorrectFeedback: string;
  misconceptionPrompt: string;
  misconceptionOptions: string[];
  misconceptionAnswer: string;
  misconceptionCorrectFeedback: string;
  misconceptionIncorrectFeedback: string;
  transferAssessmentPrompt: string;
  transferOptions: string[];
  transferCorrectAnswer: string;
  transferCorrectFeedback: string;
  transferIncorrectFeedback: string;
};

function teachingDifficultyLevel(config: RunConfig): TeachingDifficultyLevel {
  const match = /teachingDifficulty=(introductory|undergraduate_core|upper_undergraduate_or_graduate|research)/u.exec(
    config.userLearningProfile.notes ?? ""
  )?.[1];
  return (match as TeachingDifficultyLevel | undefined) ?? "upper_undergraduate_or_graduate";
}

function difficultyProfile(level: TeachingDifficultyLevel): DifficultyProfile {
  const label = difficultyLabel(level);
  const common = {
    level,
    label,
    visualDescription: `按${label}组织中文图示，展示来源、结构、行动和反馈之间的关系。`,
    pathObservation: "看到先总览、先机制或先误区会带来不同理解成本。",
    groundedClaimLabel: "有来源、有机制、有边界",
    groundedClaimTitle: "可靠解释",
    looseClaimLabel: "只有一句结论",
    looseClaimTitle: "需要补证据",
    misconceptionOptions: ["以为摘要越完整就越懂", "先找来源依据和概念结构"],
    misconceptionAnswer: "以为摘要越完整就越懂"
  };

  switch (level) {
    case "introductory":
      return {
        ...common,
        prerequisites: ["入门衔接：只假设理解基本技术词汇，不预设完整领域背景", "少术语：每个新术语先解释再使用"],
        objective: "先用具体例子解释资料中的核心机制，再逐步引入术语",
        openingFrame: "入门衔接阶段先用具体例子进入，不要求学习者先掌握完整术语表。",
        intuitionFrame: "少术语处理：先把例子讲清楚，再给概念命名。",
        structureFrame: "结构图只保留问题、例子、机制和结果四层，避免一次铺开太多抽象关系。",
        actionPrompt: "新手行动提示：先选一个你最不确定的概念，再查看它连接了哪些来源依据。",
        claimFrame: "判断时先问这句话有没有例子支撑，再看它是否解释了为什么。",
        assessmentFrame: "入门衔接检查重在能不能用自己的话复述因果关系。",
        misconceptionFrame: "入门阶段最常见误区是把术语熟悉感误当理解。",
        misconceptionCorrection: "入门衔接要用例子和反馈确认每个术语背后的动作含义。",
        summaryLine: "入门衔接记忆法：例子先行、少术语、再命名、最后迁移。",
        protocolFrame: "协议会把每一步写成可观察动作，降低抽象负担。",
        practiceFrame: "先用一句话解释例子发生了什么，再补上术语。",
        transferPrompt: "把同一套例子先行方法迁移到另一份技术资料：先找一个具体场景，再标出来源依据、核心机制和误区。",
        transferMentalModel: "先用具体例子站稳，再把例子抽象成可复用机制。",
        visualKeyElements: ["具体例子", "术语解释"],
        protocol: "1. 找一个具体例子\n2. 用自己的话说发生了什么\n3. 给关键动作命名\n4. 用反馈修正误区\n5. 换一个例子再试",
        pathAction: "选择一个最容易开始的学习路径",
        pathPurpose: "帮助入门学习者先建立抓手，再逐步进入抽象机制。",
        primaryPathLabel: "先看例子",
        primaryPathTitle: "适合入门衔接",
        primaryPathFeedback: "具体例子能降低术语压力，让你先看到机制在做什么。",
        secondaryPathLabel: "先看术语",
        secondaryPathTitle: "需要放慢",
        secondaryPathFeedback: "术语可以帮助命名，但在入门阶段必须回到例子验证。",
        claimAction: "选择一个解释是否真正讲清了例子",
        claimObservation: "看到解释是否从例子走向机制，而不是堆叠术语。",
        claimPurpose: "训练学习者把术语还原成可观察动作。",
        groundedClaimFeedback: "这个选择更稳，因为它先用具体例子说明机制，再给概念命名。",
        looseClaimFeedback: "只有结论或术语会让人以为自己懂了，但无法解释例子为什么发生。",
        quizPrompt: "入门衔接阶段，哪种学习结果更可靠？",
        quizOptions: ["能用具体例子解释机制", "背下更多术语名称"],
        quizAnswer: "能用具体例子解释机制",
        quizCorrectFeedback: "正确。入门阶段先确认你能解释例子，再逐步增加术语密度。",
        quizIncorrectFeedback: "不对。术语名称有帮助，但不能替代对例子和因果机制的理解。",
        misconceptionPrompt: "入门学习者最容易把什么误当理解？",
        misconceptionCorrectFeedback: "正确。摘要和术语熟悉感只是入口，还需要例子、动作和反馈。",
        misconceptionIncorrectFeedback: "不对。先找来源和结构是降低复杂度的有效方法。",
        transferAssessmentPrompt: "如果换成一篇新博客，你会先做哪件事？",
        transferOptions: ["找一个具体例子并解释机制", "先背完整术语表"],
        transferCorrectAnswer: "找一个具体例子并解释机制",
        transferCorrectFeedback: "正确。先用例子建模，再把术语补上。",
        transferIncorrectFeedback: "不对。术语表可以后补，但不能替代具体例子的理解。"
      };
    case "undergraduate_core":
      return {
        ...common,
        prerequisites: ["本科核心课程：默认掌握基础概念和常见技术表达", "能把核心概念、定义和典型例题连接起来"],
        objective: "用核心概念、标准判断和基础迁移题检验理解",
        openingFrame: "本科核心课程阶段需要把问题转成可检查的核心概念。",
        intuitionFrame: "直觉之后要落到标准定义和典型例题，避免只停留在比喻。",
        structureFrame: "结构图突出核心概念、标准判断、典型例题和基础迁移。",
        actionPrompt: "本科核心练习：选择一个核心概念，判断它在来源材料中解决了哪个标准问题。",
        claimFrame: "判断时要检查概念定义、例题证据和适用条件是否一致。",
        assessmentFrame: "本科核心课程检查重在能否完成标准判断，而不是泛泛复述。",
        misconceptionFrame: "本科阶段常见误区是只记定义，不会判断何时适用。",
        misconceptionCorrection: "本科核心课程要把定义、例题和标准判断一起练。",
        summaryLine: "本科核心课程记忆法：核心概念、标准判断、典型例题、基础迁移。",
        protocolFrame: "协议会把资料拆成定义、例题、判断和迁移四个学习动作。",
        practiceFrame: "把这个锚点转成一个标准判断题，并说明判据。",
        transferPrompt: "把同一套本科核心判断迁移到另一份资料：先抽核心概念，再设计一个标准判断题和一个基础迁移题。",
        transferMentalModel: "用核心概念组织知识，再用标准判断检查是否会用。",
        visualKeyElements: ["核心概念", "标准判断", "典型例题"],
        protocol: "1. 读取来源锚点\n2. 抽取核心概念\n3. 写出标准判断\n4. 用例题反馈修正误区\n5. 迁移到基础新问题",
        pathAction: "选择先看核心概念、例题还是误区",
        pathPurpose: "训练学习者把课程知识组织成可考试、可应用的判断结构。",
        primaryPathLabel: "先看核心概念",
        primaryPathTitle: "适合本科核心课程",
        primaryPathFeedback: "核心概念能把分散材料压缩成可复用的判断框架。",
        secondaryPathLabel: "先做标准题",
        secondaryPathTitle: "适合检测掌握度",
        secondaryPathFeedback: "标准判断题能暴露你是否只记住定义而不会应用。",
        claimAction: "选择一个解释是否满足本科核心判断标准",
        claimObservation: "看到解释是否同时有定义、例题和适用条件。",
        claimPurpose: "训练学习者把来源证据转成标准判断。",
        groundedClaimFeedback: "这个选择更稳，因为它连接了核心概念、来源例题和标准判断。",
        looseClaimFeedback: "只有结论不够。本科核心课程要求能说明概念何时适用。",
        quizPrompt: "本科核心课程中，哪种结果最能说明掌握了核心概念？",
        quizOptions: ["能完成标准判断并解释依据", "能复述材料标题"],
        quizAnswer: "能完成标准判断并解释依据",
        quizCorrectFeedback: "正确。标准判断能检查你是否真的会用核心概念。",
        quizIncorrectFeedback: "不对。复述标题不能证明你掌握了概念的适用条件。",
        misconceptionPrompt: "本科核心课程里最常见的理解误区是什么？",
        misconceptionCorrectFeedback: "正确。只记摘要或定义不够，还要会做标准判断。",
        misconceptionIncorrectFeedback: "不对。先找来源和结构是建立核心概念的有效方法。",
        transferAssessmentPrompt: "如果换成一份课程讲义，你会先检查哪三类信息？",
        transferOptions: ["核心概念、标准判断、适用条件", "标题、页数、排版"],
        transferCorrectAnswer: "核心概念、标准判断、适用条件",
        transferCorrectFeedback: "正确。本科核心课程的迁移重点是把概念转成可判断的使用规则。",
        transferIncorrectFeedback: "不对。标题和排版只能帮助定位，不能证明掌握了概念。"
      };
    case "upper_undergraduate_or_graduate":
      return {
        ...common,
        prerequisites: ["大学高年级/研究生课程：默认具备相关先修概念和阅读技术资料的能力", "能沿着知识节点和关键链路阅读复杂资料"],
        objective: "使用先修概念、正式术语、知识节点和关键链路深化理解",
        openingFrame: "大学高年级/研究生课程阶段需要把资料问题放进先修概念框架。",
        intuitionFrame: "直觉模型之后要引入正式术语，并说明它与先修概念的关系。",
        structureFrame: "结构图突出先修概念、正式术语、知识节点、关键链路和边界条件。",
        actionPrompt: "案例判断：选择一个先修概念，说明它如何支撑当前关键链路；再比较一个相邻资料场景。",
        claimFrame: "判断时要检查正式术语、来源证据、适用边界和讨论价值。",
        assessmentFrame: "大学高年级/研究生课程检查重在能否说清知识节点、关键链路和边界条件。",
        misconceptionFrame: "高阶课程常见误区是会讲术语，但不能说明适用边界。",
        misconceptionCorrection: "大学高年级/研究生课程要把正式术语、证据和适用边界一起检查。",
        summaryLine: "大学高年级/研究生课程记忆法：先修概念、正式术语、知识节点、关键链路、边界条件。",
        protocolFrame: "协议会把资料组织成先修概念、正式术语、知识节点、关键链路和边界案例。",
        practiceFrame: "把这个锚点改写成一个案例判断，并补一个边界场景。",
        transferPrompt: "把同一套高阶课程方法应用到另一份技术资料：先列先修概念，再使用正式术语解释关键链路，最后给出边界案例。",
        transferMentalModel: "用先修概念承接正式术语，再通过边界案例检验适用条件。",
        visualKeyElements: ["先修概念", "正式术语", "知识节点", "关键链路"],
        protocol: "1. 标注先修概念\n2. 引入正式术语\n3. 连接来源证据\n4. 画出关键链路\n5. 标出边界案例",
        pathAction: "选择先看先修概念、关键链路还是讨论题",
        pathPurpose: "训练学习者把来源材料组织成大学高年级/研究生课程的知识链路。",
        primaryPathLabel: "先看先修概念",
        primaryPathTitle: "适合高阶课程起步",
        primaryPathFeedback: "先修概念能帮助正式术语落地，避免把课程写成泛泛科普。",
        secondaryPathLabel: "先看边界案例",
        secondaryPathTitle: "适合研究生自学",
        secondaryPathFeedback: "边界案例能暴露机制边界和应用难点。",
        claimAction: "选择一个解释是否达到高阶课程要求",
        claimObservation: "看到解释是否同时连接先修概念、正式术语、来源证据和适用边界。",
        claimPurpose: "训练学习者把资料转成有节点、有链路、有边界的高阶课程内容。",
        groundedClaimFeedback: "这个选择更稳，因为它用正式术语连接了先修概念、来源证据和适用边界。",
        looseClaimFeedback: "只有结论不够。高阶课程需要能支撑案例判断和边界说明。",
        quizPrompt: "大学高年级/研究生课程中，哪种学习结果更可靠？",
        quizOptions: ["能用正式术语解释机制并设计迁移作业", "能复述更多原文句子"],
        quizAnswer: "能用正式术语解释机制并设计迁移作业",
        quizCorrectFeedback: "正确。高阶课程需要正式术语、机制解释和迁移作业共同支撑。",
        quizIncorrectFeedback: "不对。复述原文不能证明你能自测边界或完成迁移。",
        misconceptionPrompt: "高阶课程里最常见的理解误区是什么？",
        misconceptionCorrectFeedback: "正确。摘要式理解无法支撑正式术语、关键链路和边界案例。",
        misconceptionIncorrectFeedback: "不对。先找来源和结构是进入高阶自学的基础。",
        transferAssessmentPrompt: "如果换成一份研究生课程资料，你会先检查哪三类信息？",
        transferOptions: ["先修概念、正式术语、边界案例", "标题、作者、页数"],
        transferCorrectAnswer: "先修概念、正式术语、边界案例",
        transferCorrectFeedback: "正确。高阶课程要能从先修概念走向正式术语和边界案例。",
        transferIncorrectFeedback: "不对。标题和页数不能证明课程深度。"
      };
    case "research":
      return {
        ...common,
        prerequisites: ["研究论文精读/前沿讨论：默认能阅读技术论文或专利式证据表达", "能区分研究问题、方法假设、证据链和局限边界"],
        objective: "围绕研究问题、证据链、局限边界和可复现讨论形成批判性理解",
        openingFrame: "研究论文精读/前沿讨论阶段先定位研究问题和贡献边界。",
        intuitionFrame: "直觉模型只是入口，随后要追踪方法假设、证据链和反例。",
        structureFrame: "结构图突出研究问题、方法机制、证据链、局限边界和后续问题。",
        actionPrompt: "研究精读任务：选择一个核心主张，标出它依赖的来源证据链和局限边界。",
        claimFrame: "判断时要检查主张、证据链、方法假设和局限边界是否匹配。",
        assessmentFrame: "研究精读检查重在能否提出批判性问题和后续验证方案。",
        misconceptionFrame: "研究阶段常见误区是把作者结论直接当成可迁移真理。",
        misconceptionCorrection: "研究论文精读要把证据链、局限边界和替代解释一起纳入判断。",
        summaryLine: "研究精读记忆法：研究问题、方法假设、证据链、局限边界、后续验证。",
        protocolFrame: "协议会把资料拆成 research question、claim、evidence、limitation 和 transfer hypothesis。",
        practiceFrame: "把这个锚点转成一个可质疑的研究主张，并写出它的局限边界。",
        transferPrompt: "把同一套研究精读方法迁移到另一篇论文、专利或技术博客：先写研究问题，再画证据链，最后标出局限边界和后续验证。",
        transferMentalModel: "围绕研究问题建立主张-证据-边界链，再判断能否迁移。",
        visualKeyElements: ["研究问题", "证据链", "局限边界", "批判性讨论"],
        protocol: "1. 定位研究问题\n2. 拆出核心主张\n3. 追踪证据链\n4. 标注局限边界\n5. 设计后续验证或迁移假设",
        pathAction: "选择先看研究问题、证据链还是局限边界",
        pathPurpose: "训练学习者把材料当作可审查的研究论证，而不是结论摘要。",
        primaryPathLabel: "先看研究问题",
        primaryPathTitle: "适合研究精读",
        primaryPathFeedback: "研究问题决定后续证据链该如何解读。",
        secondaryPathLabel: "先看局限边界",
        secondaryPathTitle: "适合前沿讨论",
        secondaryPathFeedback: "局限边界能暴露主张的适用范围和后续研究空间。",
        claimAction: "选择一个主张是否具备可审查的证据链",
        claimObservation: "看到主张是否连接研究问题、证据链、方法假设和局限边界。",
        claimPurpose: "训练学习者进行研究级批判性阅读。",
        groundedClaimFeedback: "这个选择更稳，因为它把研究问题、证据链和局限边界连成了可审查论证。",
        looseClaimFeedback: "只有作者结论不够。研究精读必须追踪证据链和局限边界。",
        quizPrompt: "研究论文精读中，哪种结果最能说明理解可靠？",
        quizOptions: ["能说明主张的证据链和局限边界", "能背下论文结论"],
        quizAnswer: "能说明主张的证据链和局限边界",
        quizCorrectFeedback: "正确。研究级理解必须能审查证据链和边界。",
        quizIncorrectFeedback: "不对。结论只是论证结果，不能替代证据链分析。",
        misconceptionPrompt: "研究精读最危险的误区是什么？",
        misconceptionCorrectFeedback: "正确。把摘要或结论当真理会忽略假设、证据链和局限边界。",
        misconceptionIncorrectFeedback: "不对。先找来源和结构是展开证据链分析的基础。",
        transferAssessmentPrompt: "如果换成另一篇论文，你会先检查哪三类信息？",
        transferOptions: ["研究问题、证据链、局限边界", "标题、作者、页数"],
        transferCorrectAnswer: "研究问题、证据链、局限边界",
        transferCorrectFeedback: "正确。研究精读的迁移核心是把主张放回证据链和边界中判断。",
        transferIncorrectFeedback: "不对。标题和页数不能支持研究级判断。"
      };
  }
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
