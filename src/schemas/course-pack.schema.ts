export type CoursePackUnit = {
  unitId: string;
  title: string;
  kind: "overview" | "chapter" | "topic" | "task" | "practice" | "assessment" | "teacher" | "hybrid";
  lessonId?: string;
  targetPageCount: number;
  sourceAnchorIds: string[];
  sourceNodeIds?: string[];
  chapterRefs?: string[];
  conceptIds: string[];
};

export type CoursePack = {
  id: string;
  title: string;
  parentRunId: string;
  sourceKind?: string;
  strategy?: string;
  audience?: string;
  language?: string;
  overviewUnitId?: string;
  units: CoursePackUnit[];
  chapterMapping?: Array<{
    chapterId: string;
    title: string;
    unitIds: string[];
    anchorIds: string[];
  }>;
  sourceCoverage?: Array<{
    sourceNodeId: string;
    status: "covered" | "partial" | "deferred" | "omitted";
    unitIds: string[];
    notes?: string;
  }>;
  conceptCoverage?: Array<{
    conceptId: string;
    status: "covered" | "partial" | "deferred" | "omitted";
    unitIds: string[];
    notes?: string;
  }>;
};
