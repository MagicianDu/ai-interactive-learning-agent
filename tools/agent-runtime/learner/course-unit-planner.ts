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
};

export type CourseUnitPlan = {
  overviewUnitId: "unit-overview";
  strategy: CoursePlanningStrategy;
  strategyReason: string;
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

export function planCourseUnits(input: CourseUnitPlanInput): CourseUnitPlan {
  const strategy = normalizeStrategy(input.strategy);
  const focusConcepts = uniqueStrings([...input.selectedTopics, ...input.concepts.filter((concept) => concept !== "全局地图")]).slice(0, 4);
  const paddedFocusConcepts =
    focusConcepts.length >= 2 ? focusConcepts : uniqueStrings([...focusConcepts, "核心机制", "迁移应用"]);
  const focused = paddedFocusConcepts.slice(0, Math.max(2, Math.min(4, paddedFocusConcepts.length)));
  const focusedKind = unitKind(strategy);
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
      targetPageCount: input.unitPageCount,
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
    ...focused.map((concept, index) => {
      const unitIndex = index + 1;
      const unitExpectations = expectationsForUnit(focusedKind, concept, commonCoverage);
      return {
        unitId: `unit-${focusedKind}-${String(unitIndex).padStart(2, "0")}`,
        title: `${input.topic}：${concept}`,
        kind: focusedKind,
        lessonId: `${input.runId}-${focusedKind}-${String(unitIndex).padStart(2, "0")}`,
        targetPageCount: input.unitPageCount,
        sourceAnchorIds: anchorSlice(input.sourceAnchorIds, unitIndex, focused.length + 1),
        sourceNodeIds: input.sourceNodeIds,
        chapterRefs: input.selectedChapters,
        conceptIds: [conceptId(unitIndex)],
        focusConcepts: [concept],
        ...unitExpectations
      } satisfies PlannedCourseUnit;
    })
  ];

  return {
    overviewUnitId: "unit-overview",
    strategy,
    strategyReason: strategyReason(input.strategy, strategy, input.sourceKind),
    acceptanceExpectations: acceptanceExpectations(strategy, commonCoverage.preserveChapterRefs),
    units
  };
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
    return "按任务组织，适合把资料转成可操作步骤、判断题和迁移练习。";
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
