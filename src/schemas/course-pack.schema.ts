export type CoursePackUnit = {
  unitId: string;
  title: string;
  kind: "overview" | "chapter" | "topic" | "task" | "hybrid";
  lessonId: string;
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
  units: CoursePackUnit[];
};
