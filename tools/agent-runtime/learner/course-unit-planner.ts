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
  units: PlannedCourseUnit[];
};

export function planCourseUnits(input: CourseUnitPlanInput): CourseUnitPlan {
  const focusConcepts = uniqueStrings([...input.selectedTopics, ...input.concepts.filter((concept) => concept !== "全局地图")]).slice(0, 4);
  const paddedFocusConcepts =
    focusConcepts.length >= 2 ? focusConcepts : uniqueStrings([...focusConcepts, "核心机制", "迁移应用"]);
  const focused = paddedFocusConcepts.slice(0, Math.max(2, Math.min(4, paddedFocusConcepts.length)));
  const focusedKind = unitKind(input.strategy);
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
      focusConcepts: input.concepts
    },
    ...focused.map((concept, index) => {
      const unitIndex = index + 1;
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
        focusConcepts: [concept]
      } satisfies PlannedCourseUnit;
    })
  ];

  return { overviewUnitId: "unit-overview", units };
}

function unitKind(strategy: string): PlannedCourseUnit["kind"] {
  if (strategy === "chapter_guided") return "chapter";
  if (strategy === "task_guided") return "task";
  if (strategy === "hybrid") return "hybrid";
  return "topic";
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
