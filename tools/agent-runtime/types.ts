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
  audience: string;
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

export type ApprovalGateId = "learning-architecture" | "lesson" | "critic-report" | "publish-package";

export type CliInitArgs = {
  topic?: string;
  pages?: string;
  language?: string;
  adapter?: string;
  run?: string;
};
