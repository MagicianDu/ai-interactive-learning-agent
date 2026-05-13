import type { CourseIntent } from "./course-intent.js";

export type PlannedCourseUnit = {
  unitId: string;
  title: string;
  kind: "overview" | "chapter" | "topic" | "task" | "practice" | "assessment" | "teacher" | "hybrid";
  lessonId: string;
  targetPageCount: number;
  sourceAnchorIds: string[];
  sourceNodeIds: string[];
  chapterRefs?: string[];
  conceptIds: string[];
  focusConcepts: string[];
  taskLabel?: string;
  transferExpectation: string;
  expectedInteractions: string[];
  expectedAssessments: string[];
  expectedSourceCoverage: {
    minSourceAnchorCount: number;
    preserveChapterRefs: boolean;
  };
};

export type SourceChapterPlanHint = {
  title: string;
  sourceNodeId: string;
  sourceAnchorIds: string[];
};

export type CourseUnitPlanInput = {
  runId: string;
  topic: string;
  sourceKind: string;
  strategy: string;
  unitPageCount: number;
  selectedTopics: string[];
  selectedChapters: string[];
  concepts: string[];
  sourceAnchorIds: string[];
  sourceNodeIds: string[];
  sourceChapters?: SourceChapterPlanHint[];
  courseIntent?: CourseIntent;
  targetTotalPages?: number;
  totalPagesSpecified?: boolean;
};

export type CourseUnitPlan = {
  overviewUnitId: "unit-overview";
  strategy: CoursePlanningStrategy;
  strategyReason: string;
  estimatedTotalPages: number;
  planningNotes: string[];
  sourceCoveragePlan: CourseSourceCoveragePlan;
  acceptanceExpectations: CoursePlanAcceptanceExpectation[];
  units: PlannedCourseUnit[];
};

export type CoursePlanningStrategy = "overview_plus_topic" | "chapter_guided" | "topic_guided" | "task_guided" | "hybrid";

export type CoursePlanAcceptanceExpectation = {
  id: string;
  scope: "course" | "unit";
  required: boolean;
  description: string;
};

export type CourseSourceCoveragePlan = {
  coverageMode: "selected_chapters" | "selected_topics" | "inferred_chapters" | "inferred_concepts" | "fallback";
  requestedChapterCount: number;
  requestedTopicCount: number;
  focusedUnitCount: number;
  totalUnitCount: number;
  totalPageBudget: number;
  recommendation: string;
};

type FocusPlanItem = {
  label: string;
  sourceAnchorIds?: string[];
  sourceNodeIds?: string[];
  chapterRefs?: string[];
};

export function planCourseUnits(input: CourseUnitPlanInput): CourseUnitPlan {
  const strategy = normalizeStrategy(input.strategy);
  const focusPlan = buildFocusPlan(input, strategy);
  const focused = focusPlan.focusItems;
  const focusedKind = unitKind(strategy);
  const appliedTargetTotalPages = appliedTargetTotalPagesForPlan(input, focusPlan.coverageMode);
  const pageCounts = pageCountsForUnits(focused.length + 1, input.unitPageCount, appliedTargetTotalPages);
  const commonCoverage = {
    minSourceAnchorCount: input.sourceAnchorIds.length > 0 ? 1 : 0,
    preserveChapterRefs: shouldPreserveChapterRefs(strategy, input.selectedChapters)
  };
  const units: PlannedCourseUnit[] = [
    {
      unitId: "unit-overview",
      title: `${input.topic}：总览课`,
      kind: "overview",
      lessonId: `${input.runId}-overview`,
      targetPageCount: pageCounts[0] ?? input.unitPageCount,
      sourceAnchorIds: input.sourceAnchorIds,
      sourceNodeIds: input.sourceNodeIds,
      chapterRefs: input.selectedChapters,
      conceptIds: input.concepts.map((_, index) => conceptId(index)),
      focusConcepts: input.concepts,
      transferExpectation: "把总览地图迁移到后续每个 focused unit 的学习路径中。",
      expectedInteractions: ["prediction", "comparison"],
      expectedAssessments: ["comprehension_check", "misconception_check"],
      expectedSourceCoverage: commonCoverage
    },
    ...focused.map((item, index) => {
      const unitIndex = index + 1;
      const unitExpectations = expectationsForUnit(focusedKind, item.label, commonCoverage);
      return {
        unitId: `unit-${focusedKind}-${String(unitIndex).padStart(2, "0")}`,
        title: `${input.topic}：${item.label}`,
        kind: focusedKind,
        lessonId: `${input.runId}-${focusedKind}-${String(unitIndex).padStart(2, "0")}`,
        targetPageCount: pageCounts[unitIndex] ?? input.unitPageCount,
        sourceAnchorIds: item.sourceAnchorIds?.length ? item.sourceAnchorIds : anchorSlice(input.sourceAnchorIds, unitIndex, focused.length + 1),
        sourceNodeIds: item.sourceNodeIds?.length ? item.sourceNodeIds : input.sourceNodeIds,
        chapterRefs: item.chapterRefs ?? input.selectedChapters,
        conceptIds: [conceptId(unitIndex)],
        focusConcepts: [item.label],
        ...unitExpectations
      } satisfies PlannedCourseUnit;
    })
  ];
  const estimatedTotalPages = units.reduce((sum, unit) => sum + unit.targetPageCount, 0);
  const sourceCoveragePlan = {
    coverageMode: focusPlan.coverageMode,
    requestedChapterCount: input.selectedChapters.length,
    requestedTopicCount: input.selectedTopics.length,
    focusedUnitCount: focused.length,
    totalUnitCount: units.length,
    totalPageBudget: estimatedTotalPages,
    recommendation: coverageRecommendation(focusPlan.coverageMode, strategy, focused.length, estimatedTotalPages)
  } satisfies CourseSourceCoveragePlan;

  return {
    overviewUnitId: "unit-overview",
    strategy,
    strategyReason: strategyReason(input.strategy, strategy, input.sourceKind),
    estimatedTotalPages,
    planningNotes: planningNotes(sourceCoveragePlan, input.unitPageCount, input.targetTotalPages, appliedTargetTotalPages, input.totalPagesSpecified),
    sourceCoveragePlan,
    acceptanceExpectations: acceptanceExpectations(strategy, commonCoverage.preserveChapterRefs),
    units
  };
}

function appliedTargetTotalPagesForPlan(
  input: CourseUnitPlanInput,
  coverageMode: CourseSourceCoveragePlan["coverageMode"]
): number | undefined {
  if (!input.targetTotalPages) {
    return undefined;
  }
  if (input.totalPagesSpecified === true) {
    return input.targetTotalPages;
  }
  if (input.totalPagesSpecified === false && (coverageMode === "selected_topics" || coverageMode === "selected_chapters")) {
    return undefined;
  }
  return input.targetTotalPages;
}

function buildFocusPlan(
  input: CourseUnitPlanInput,
  strategy: CoursePlanningStrategy
): { focusItems: FocusPlanItem[]; coverageMode: CourseSourceCoveragePlan["coverageMode"] } {
  if (strategy === "chapter_guided" && input.selectedChapters.length > 0) {
    return {
      focusItems: ensureMinimumFocusedItems(
        uniqueStrings(input.selectedChapters).map((label) => ({ label, chapterRefs: [label] })),
        input.concepts
      ),
      coverageMode: "selected_chapters"
    };
  }

  const selectedTopics = uniqueStrings(input.selectedTopics);
  if (selectedTopics.length > 0) {
    return {
      focusItems: ensureMinimumFocusedItems(
        selectedTopics.map((label) => ({ label })),
        input.concepts
      ),
      coverageMode: "selected_topics"
    };
  }

  const chapterItems = sourceChapterFocusItems(input);
  if ((strategy === "chapter_guided" || strategy === "overview_plus_topic" || strategy === "topic_guided" || strategy === "hybrid") && chapterItems.length > 0) {
    return {
      focusItems: chapterItems,
      coverageMode: "inferred_chapters"
    };
  }

  const focusConcepts = uniqueStrings(input.concepts.filter((concept) => concept !== "全局地图")).slice(0, 4);
  if (focusConcepts.length > 0) {
    const paddedFocusConcepts =
      focusConcepts.length >= 2 ? focusConcepts : uniqueStrings([...focusConcepts, "核心机制", "迁移应用"]);
    return {
      focusItems: paddedFocusConcepts.slice(0, Math.max(2, Math.min(4, paddedFocusConcepts.length))).map((label) => ({ label })),
      coverageMode: "inferred_concepts"
    };
  }

  return {
    focusItems: ["核心机制", "迁移应用"].map((label) => ({ label })),
    coverageMode: "fallback"
  };
}

function sourceChapterFocusItems(input: CourseUnitPlanInput): FocusPlanItem[] {
  const chapterHints = (input.sourceChapters ?? []).filter((chapter) => chapter.title.trim().length > 0);
  if (chapterHints.length === 0 || input.sourceKind !== "book") {
    return [];
  }
  const maxInferredChapters =
    input.strategy === "chapter_guided"
      ? chapterHints.length
      : input.courseIntent === "student_self_study_textbook" && input.targetTotalPages
        ? Math.min(chapterHints.length, Math.max(2, Math.ceil(input.targetTotalPages / 10) - 1))
        : Math.min(6, chapterHints.length);
  return chapterHints.slice(0, maxInferredChapters).map((chapter) => ({
    label: chapter.title,
    sourceAnchorIds: chapter.sourceAnchorIds,
    sourceNodeIds: [chapter.sourceNodeId],
    chapterRefs: [chapter.title]
  }));
}

function ensureMinimumFocusedItems(items: FocusPlanItem[], concepts: string[]): FocusPlanItem[] {
  if (items.length >= 2) {
    return items;
  }
  const existingLabels = items.map((item) => item.label);
  const fallbackLabels = uniqueStrings([...existingLabels, ...concepts.filter((concept) => concept !== "全局地图"), "核心机制", "迁移应用"]).slice(0, 2);
  return fallbackLabels.map((label) => items.find((item) => item.label === label) ?? { label });
}

function coverageRecommendation(
  coverageMode: CourseSourceCoveragePlan["coverageMode"],
  strategy: CoursePlanningStrategy,
  focusedUnitCount: number,
  totalPageBudget: number
): string {
  if (coverageMode === "selected_chapters") {
    return `按 ${focusedUnitCount} 个指定章节生成 focused units；每章保留来源映射，总页数约 ${totalPageBudget} 页。`;
  }
  if (coverageMode === "selected_topics") {
    return `按 ${focusedUnitCount} 个指定 topic 生成 focused units；保留章节映射，避免按原文顺序被动复述。`;
  }
  if (coverageMode === "inferred_chapters") {
    return `从来源 TOC/章节结构推断 ${focusedUnitCount} 个核心 pattern 单元；每个单元绑定对应章节 anchors，总页数约 ${totalPageBudget} 页。`;
  }
  if (strategy === "chapter_guided") {
    return "未提供具体章节时先按核心概念拆单元；如用户需要全书覆盖，应补充章节清单或选择 topic 范围。";
  }
  return "先给总览课，再按核心概念拆课；如资料很长，可继续补充章节或 topic 范围扩展单元数。";
}

function planningNotes(
  sourceCoveragePlan: CourseSourceCoveragePlan,
  unitPageCount: number,
  targetTotalPages: number | undefined,
  appliedTargetTotalPages: number | undefined,
  totalPagesSpecified: boolean | undefined
): string[] {
  const pageBudgetNote = appliedTargetTotalPages
    ? `目标总页数约 ${appliedTargetTotalPages} 页；当前计划 ${sourceCoveragePlan.totalUnitCount} 个单元，总页数约 ${sourceCoveragePlan.totalPageBudget} 页。`
    : targetTotalPages && totalPagesSpecified === false
      ? `默认总页数约 ${targetTotalPages} 页仅作为全书展开提醒；当前已限定范围，按每个单元 ${unitPageCount} 页规划 ${sourceCoveragePlan.totalUnitCount} 个单元，总页数约 ${sourceCoveragePlan.totalPageBudget} 页。`
      : `每个单元 ${unitPageCount} 页；当前计划 ${sourceCoveragePlan.totalUnitCount} 个单元，总页数约 ${sourceCoveragePlan.totalPageBudget} 页。`;
  return [
    sourceCoveragePlan.recommendation,
    pageBudgetNote,
    sourceCoveragePlan.coverageMode === "selected_chapters"
      ? "章节单元必须保留章节边界；Codex 可以在每章内部再按核心 topic 安排页面。"
      : "非章节模式仍需在页面或单元级保留来源锚点映射。"
  ];
}

function pageCountsForUnits(unitCount: number, defaultUnitPageCount: number, targetTotalPages: number | undefined): number[] {
  if (!targetTotalPages || unitCount <= 0) {
    return Array.from({ length: unitCount }, () => defaultUnitPageCount);
  }
  const boundedTotal = Math.max(unitCount, Math.min(300, targetTotalPages));
  const base = Math.floor(boundedTotal / unitCount);
  const remainder = boundedTotal - base * unitCount;
  return Array.from({ length: unitCount }, (_, index) => Math.max(1, Math.min(40, base + (index < remainder ? 1 : 0))));
}

function unitKind(strategy: CoursePlanningStrategy): PlannedCourseUnit["kind"] {
  if (strategy === "chapter_guided") return "chapter";
  if (strategy === "task_guided") return "task";
  if (strategy === "hybrid") return "hybrid";
  return "topic";
}

function normalizeStrategy(strategy: string): CoursePlanningStrategy {
  if (
    strategy === "overview_plus_topic" ||
    strategy === "chapter_guided" ||
    strategy === "topic_guided" ||
    strategy === "task_guided" ||
    strategy === "hybrid"
  ) {
    return strategy;
  }
  return "overview_plus_topic";
}

function strategyReason(inputStrategy: string, strategy: CoursePlanningStrategy, sourceKind: string): string {
  if (inputStrategy !== strategy) {
    return `未识别课程策略 ${inputStrategy || "空"}；推荐 overview_plus_topic，因为它先建立总览，再按核心 topic 拆解 ${sourceKind}。`;
  }
  if (strategy === "chapter_guided") {
    return "按章节组织，适合需要保留原书/原资料顺序和章节边界的学习任务。";
  }
  if (strategy === "topic_guided") {
    return "按核心 topic 组织，适合先建立概念心智模型，再回看来源章节映射。";
  }
  if (strategy === "task_guided") {
    return "按任务组织，适合把资料转成可操作步骤、判断点和边界案例。";
  }
  if (strategy === "hybrid") {
    return "混合组织，适合先给总览，再按 topic 或章节保留来源映射。";
  }
  return "先给总览课，再按核心 topic 拆课，适合大多数长资料学习路径。";
}

function acceptanceExpectations(strategy: CoursePlanningStrategy, preserveChapterRefs: boolean): CoursePlanAcceptanceExpectation[] {
  return [
    {
      id: "overview-plus-focused-units",
      scope: "course",
      required: true,
      description: "长资料默认包含一个总览单元和至少两个 focused units。"
    },
    {
      id: "source-mapping-preserved",
      scope: "course",
      required: true,
      description: preserveChapterRefs ? "课程计划必须保留章节/来源映射。" : "课程计划必须保留来源锚点映射。"
    },
    {
      id: "page-budget-respected",
      scope: "unit",
      required: true,
      description: "每个单元应尊重 unitPageCount，并在内容过密时拆页。"
    },
    {
      id: strategy === "task_guided" ? "task-transfer-ready" : "misconception-and-transfer-ready",
      scope: "unit",
      required: true,
      description:
        strategy === "task_guided"
          ? "任务单元必须包含可迁移到新场景的操作判断。"
          : "每个 focused unit 必须包含误区检查和迁移任务。"
    }
  ];
}

function expectationsForUnit(
  kind: PlannedCourseUnit["kind"],
  concept: string,
  expectedSourceCoverage: PlannedCourseUnit["expectedSourceCoverage"]
): Pick<
  PlannedCourseUnit,
  "taskLabel" | "transferExpectation" | "expectedInteractions" | "expectedAssessments" | "expectedSourceCoverage"
> {
  if (kind === "task") {
    return {
      taskLabel: `任务：${concept}`,
      transferExpectation: "把同一判断步骤迁移到新的真实任务或资料片段。",
      expectedInteractions: ["debugging", "comparison", "prediction"],
      expectedAssessments: ["prediction_check", "misconception_check", "transfer_challenge"],
      expectedSourceCoverage
    };
  }
  return {
    transferExpectation: "把该概念迁移到一个新的技术资料或实践场景。",
    expectedInteractions: ["prediction", "comparison"],
    expectedAssessments: ["misconception_check", "transfer_challenge"],
    expectedSourceCoverage
  };
}

function shouldPreserveChapterRefs(strategy: CoursePlanningStrategy, selectedChapters: string[]): boolean {
  return selectedChapters.length > 0 || strategy === "chapter_guided" || strategy === "topic_guided" || strategy === "hybrid";
}

function conceptId(index: number): string {
  return `concept-${String(index + 1).padStart(2, "0")}`;
}

function anchorSlice(anchorIds: string[], index: number, total: number): string[] {
  if (anchorIds.length <= 2 || total <= 1) {
    return anchorIds;
  }
  const chunkSize = Math.max(1, Math.ceil(anchorIds.length / total));
  const start = Math.min(index * chunkSize, Math.max(0, anchorIds.length - 1));
  const chunk = anchorIds.slice(start, start + chunkSize);
  return chunk.length > 0 ? chunk : anchorIds.slice(0, 1);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
