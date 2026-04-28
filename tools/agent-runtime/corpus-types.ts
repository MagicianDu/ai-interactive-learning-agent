export type SourceRecord = {
  id: string;
  type: "topic" | "text" | "file" | "folder" | "url";
  title: string;
  value?: string;
  uri?: string;
  contentType?: string;
  language?: string;
  metadata?: Record<string, string | number | boolean>;
};

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

export type CurriculumPlanningMode = "chapter_guided" | "concept_guided" | "task_guided" | "hybrid";

export type CoveragePolicy = {
  requiredCoverage: "all_source" | "selected_sections" | "core_concepts" | "goal_relevant";
  allowOmission: boolean;
  omissionRules: string[];
};
