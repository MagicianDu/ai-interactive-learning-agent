export type SourceRecord = {
  id: string;
  type: "topic" | "text" | "file" | "folder" | "url";
  kind?: SourceMaterialKind;
  title: string;
  value?: string;
  uri?: string;
  contentType?: string;
  language?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type SourceMaterialKind =
  | "book"
  | "paper"
  | "patent"
  | "blog"
  | "documentation"
  | "notes"
  | "course"
  | "mixed"
  | "unknown";

export type UserLearningProfile = {
  level: "beginner" | "basic" | "intermediate" | "advanced" | "expert";
  readingHabit:
    | "follow_original"
    | "visual_first"
    | "case_first"
    | "practice_first"
    | "quick_overview"
    | "deep_dive";
  goal:
    | "understand"
    | "teach"
    | "implement"
    | "replicate_research"
    | "prepare_exam"
    | "evaluate_patent"
    | "custom";
  timeBudgetMinutes?: number;
  preferredUnitCount?: number;
  preferredPageCountPerUnit?: number;
  notes?: string;
};

export type CurriculumPlanningMode =
  | "chapter_guided"
  | "topic_guided"
  | "concept_guided"
  | "task_guided"
  | "hybrid";

export type CoveragePolicy = {
  requiredCoverage: "all_source" | "selected_sections" | "core_concepts" | "goal_relevant";
  allowOmission: boolean;
  omissionRules: string[];
};

export type CourseOutputProduct =
  | "web_lesson"
  | "whiteboard_map"
  | "playground"
  | "assessment"
  | "teacher_notes";

export type CoursePackStrategy =
  | "overview_plus_topic"
  | "chapter_guided"
  | "topic_guided"
  | "task_guided"
  | "hybrid";

export type CoursePackConfig = {
  strategy: CoursePackStrategy;
  includeOverview: boolean;
  preserveSourceMapping: boolean;
  unitPageCount: number;
  preferredUnitCount?: number;
  selectedChapters?: string[];
  selectedTopics?: string[];
  outputProducts: CourseOutputProduct[];
};

export type LearningUnitKind = "overview" | "chapter" | "topic" | "task" | "hybrid";

export type LearningUnitPlan = {
  id: string;
  title: string;
  kind: LearningUnitKind;
  purpose: string;
  targetPageCount: number;
  sourceAnchorIds: string[];
  sourceNodeIds?: string[];
  chapterRefs?: string[];
  conceptIds: string[];
  outputProducts: CourseOutputProduct[];
};

export type SelectedLearningUnit = LearningUnitPlan & {
  parentRunId: string;
  parentCoursePackId?: string;
};

export type CoursePack = {
  id: string;
  title: string;
  sourceKind: SourceMaterialKind;
  strategy: CoursePackStrategy;
  audience: string;
  language: string;
  overviewUnitId?: string;
  units: LearningUnitPlan[];
  sourceCoverage: Array<{
    sourceNodeId: string;
    status: "covered" | "partial" | "deferred" | "omitted";
    unitIds: string[];
    notes?: string;
  }>;
  conceptCoverage: Array<{
    conceptId: string;
    status: "covered" | "partial" | "deferred" | "omitted";
    unitIds: string[];
    notes?: string;
  }>;
  chapterMapping: Array<{
    chapterId: string;
    title: string;
    unitIds: string[];
    anchorIds: string[];
  }>;
};
