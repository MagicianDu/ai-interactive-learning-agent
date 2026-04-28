import type { CoveragePolicy, CurriculumPlanningMode, SourceRecord, UserLearningProfile } from "./corpus-types.js";

export type SourceConfig =
  | { type: "topic" | "text" | "file" | "url"; value: string; label?: string; notes?: string }
  | {
      type: "mixed";
      items: Array<{ type: "topic" | "text" | "file" | "url"; value: string; label?: string; notes?: string }>;
      notes?: string;
    };

export type RuntimeAdapterId = "mock" | "codex-manual" | "openai" | "anthropic" | "gemini" | "custom";

export type RunConfig = {
  runId: string;
  topic: string;
  source: SourceConfig;
  sources: SourceRecord[];
  audience: string;
  userLearningProfile: UserLearningProfile;
  curriculumPlanningMode: CurriculumPlanningMode;
  coveragePolicy: CoveragePolicy;
  outputLanguage: string;
  targetOutput: "web_deck" | "canvas_map" | "playground" | "ai_tutor" | "teacher_mode" | "assessment_mode" | "package";
  pageCount: {
    target: number;
    min: number;
    max: number;
  };
  runtime: {
    adapter: RuntimeAdapterId;
    mode: "interactive" | "supervised" | "batch";
  };
  models: {
    defaultModel: {
      provider: string;
      model: string;
      reasoningEffort?: "low" | "medium" | "high" | "xhigh";
      temperature?: number;
    };
    roleModels?: Record<string, { provider: string; model: string; reasoningEffort?: string; temperature?: number }>;
  };
  modelFallbackPolicy: "require_approval" | "use_default" | "fail";
  approvalGates: ApprovalGateId[];
};

export type ApprovalGateId =
  | "source-map"
  | "concept-map"
  | "curriculum-plan"
  | "learning-architecture"
  | "lesson"
  | "critic-report"
  | "publish-package";

export type CliInitArgs = {
  topic?: string;
  pages?: string;
  language?: string;
  adapter?: string;
  run?: string;
};
