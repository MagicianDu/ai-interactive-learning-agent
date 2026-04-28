import { AgentRuntimeError } from "./errors.js";
import type { CoveragePolicy, CurriculumPlanningMode, SourceRecord, UserLearningProfile } from "./corpus-types.js";
import type { ApprovalGateId, CliInitArgs, RunConfig, RuntimeAdapterId } from "./types.js";

const safeRunIdPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const allowedTargetOutputs = new Set<RunConfig["targetOutput"]>([
  "web_deck",
  "canvas_map",
  "playground",
  "ai_tutor",
  "teacher_mode",
  "assessment_mode",
  "package"
]);
const allowedRuntimeModes = new Set<RunConfig["runtime"]["mode"]>(["interactive", "supervised", "batch"]);
const allowedModelFallbackPolicies = new Set<RunConfig["modelFallbackPolicy"]>([
  "require_approval",
  "use_default",
  "fail"
]);
const allowedSourceTypes = new Set(["topic", "text", "file", "url"]);
const allowedSourceRecordTypes = new Set<SourceRecord["type"]>(["topic", "text", "file", "folder", "url"]);
const allowedCurriculumPlanningModes = new Set<CurriculumPlanningMode>([
  "chapter_guided",
  "concept_guided",
  "task_guided",
  "hybrid"
]);
const allowedLearningLevels = new Set<UserLearningProfile["level"]>([
  "beginner",
  "basic",
  "intermediate",
  "advanced",
  "expert"
]);
const allowedReadingHabits = new Set<UserLearningProfile["readingHabit"]>([
  "follow_original",
  "visual_first",
  "case_first",
  "practice_first",
  "quick_overview",
  "deep_dive"
]);
const allowedLearningGoals = new Set<UserLearningProfile["goal"]>([
  "understand",
  "teach",
  "implement",
  "replicate_research",
  "prepare_exam",
  "evaluate_patent",
  "custom"
]);
const allowedRequiredCoverage = new Set<CoveragePolicy["requiredCoverage"]>([
  "all_source",
  "selected_sections",
  "core_concepts",
  "goal_relevant"
]);
const allowedApprovalGates = new Set<ApprovalGateId>([
  "source-map",
  "concept-map",
  "curriculum-plan",
  "learning-architecture",
  "lesson",
  "critic-report",
  "publish-package"
]);

const defaultApprovalGates: ApprovalGateId[] = [
  "source-map",
  "concept-map",
  "curriculum-plan",
  "learning-architecture",
  "lesson",
  "critic-report",
  "publish-package"
];

const topicSlugMap: Record<string, string> = {
  哈希表: "hash-table",
  数据库索引: "database-index"
};

export function createRunConfigFromArgs(args: CliInitArgs): RunConfig {
  const topic = args.topic?.trim();
  if (!topic) {
    throw new AgentRuntimeError("topic is required", "INVALID_RUN_CONFIG");
  }

  const targetPages = Number(args.pages ?? "10");
  if (!Number.isInteger(targetPages) || targetPages < 1 || targetPages > 40) {
    throw new AgentRuntimeError("pages must be between 1 and 40", "INVALID_RUN_CONFIG");
  }
  const outputLanguage = args.language?.trim() || "zh-CN";

  const runId = args.run?.trim() || `${slugifyTopic(topic)}-001`;
  const adapter = normalizeAdapter(args.adapter);

  return validateRunConfig({
    runId,
    topic,
    source: { type: "topic", value: topic },
    sources: [
      {
        id: "source-001",
        type: "topic",
        title: topic,
        value: topic,
        language: outputLanguage
      }
    ],
    audience: "具备基础技术背景、希望通过中文互动课程建立心智模型的学习者。",
    userLearningProfile: {
      level: "basic",
      readingHabit: "visual_first",
      goal: "understand",
      preferredPageCountPerUnit: targetPages
    },
    curriculumPlanningMode: "hybrid",
    coveragePolicy: {
      requiredCoverage: "core_concepts",
      allowOmission: true,
      omissionRules: ["topic-only runs may omit source coverage beyond generated concept anchors"]
    },
    outputLanguage,
    targetOutput: "web_deck",
    pageCount: {
      target: targetPages,
      min: Math.max(1, targetPages - 2),
      max: targetPages + 2
    },
    runtime: {
      adapter,
      mode: "interactive"
    },
    models: {
      defaultModel: {
        provider: adapter === "mock" ? "mock" : "configured-provider",
        model: adapter === "mock" ? "mock-learning-agent" : "configured-model",
        reasoningEffort: "medium",
        temperature: 0.3
      }
    },
    modelFallbackPolicy: "require_approval",
    approvalGates: defaultApprovalGates
  });
}

export function validateRunConfig(config: RunConfig): RunConfig {
  if (!isNonEmptyString(config.runId)) {
    throw new AgentRuntimeError("runId is required", "INVALID_RUN_CONFIG");
  }
  if (!safeRunIdPattern.test(config.runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/", "INVALID_RUN_CONFIG");
  }
  if (!isNonEmptyString(config.topic)) {
    throw new AgentRuntimeError("topic is required", "INVALID_RUN_CONFIG");
  }
  if (config.outputLanguage !== "zh-CN") {
    throw new AgentRuntimeError("only zh-CN outputLanguage is supported in this MVP", "INVALID_RUN_CONFIG");
  }
  if (!allowedTargetOutputs.has(config.targetOutput)) {
    throw new AgentRuntimeError("targetOutput must be one of the supported lesson outputs", "INVALID_RUN_CONFIG");
  }
  validateSource(config.source);
  if (!config.pageCount) {
    throw new AgentRuntimeError("pageCount is required", "INVALID_RUN_CONFIG");
  }
  const { min, target, max } = config.pageCount;
  if (!Number.isInteger(min) || !Number.isInteger(target) || !Number.isInteger(max)) {
    throw new AgentRuntimeError("pageCount min/target/max must be integers", "INVALID_RUN_CONFIG");
  }
  if (min < 1) {
    throw new AgentRuntimeError("pageCount.min must be at least 1", "INVALID_RUN_CONFIG");
  }
  if (max > 40) {
    throw new AgentRuntimeError("pageCount.max must be at most 40", "INVALID_RUN_CONFIG");
  }
  if (min > target || target > max) {
    throw new AgentRuntimeError("pageCount min/target/max are inconsistent", "INVALID_RUN_CONFIG");
  }
  if (!allowedRuntimeModes.has(config.runtime?.mode)) {
    throw new AgentRuntimeError("runtime.mode must be interactive, supervised, or batch", "INVALID_RUN_CONFIG");
  }
  if (config.runtime.adapter !== "mock" && config.runtime.adapter !== "codex-manual") {
    throw new AgentRuntimeError(`unsupported adapter: ${config.runtime.adapter}`, "UNSUPPORTED_ADAPTER");
  }
  if (!isNonEmptyString(config.models?.defaultModel?.provider)) {
    throw new AgentRuntimeError("models.defaultModel.provider is required", "INVALID_RUN_CONFIG");
  }
  if (!isNonEmptyString(config.models.defaultModel.model)) {
    throw new AgentRuntimeError("models.defaultModel.model is required", "INVALID_RUN_CONFIG");
  }
  validateRoleModels(config.models.roleModels);
  if (!allowedModelFallbackPolicies.has(config.modelFallbackPolicy)) {
    throw new AgentRuntimeError("modelFallbackPolicy must be require_approval, use_default, or fail", "INVALID_RUN_CONFIG");
  }
  validateSources(config.sources);
  validateUserLearningProfile(config.userLearningProfile);
  if (!allowedCurriculumPlanningModes.has(config.curriculumPlanningMode)) {
    throw new AgentRuntimeError(
      "curriculumPlanningMode must be chapter_guided, concept_guided, task_guided, or hybrid",
      "INVALID_RUN_CONFIG"
    );
  }
  validateCoveragePolicy(config.coveragePolicy);
  if (!Array.isArray(config.approvalGates)) {
    throw new AgentRuntimeError("approvalGates must be an array of canonical gate ids", "INVALID_RUN_CONFIG");
  }
  for (const gate of config.approvalGates) {
    if (!allowedApprovalGates.has(gate)) {
      throw new AgentRuntimeError("approvalGates must only contain canonical gate ids", "INVALID_RUN_CONFIG");
    }
  }
  return config;
}

function normalizeAdapter(adapter?: string): RuntimeAdapterId {
  const normalized = (adapter || "mock").trim();
  if (normalized === "mock" || normalized === "codex-manual") {
    return normalized;
  }
  throw new AgentRuntimeError(`unsupported adapter: ${normalized}`, "UNSUPPORTED_ADAPTER");
}

function slugifyTopic(topic: string): string {
  if (topicSlugMap[topic]) {
    return topicSlugMap[topic];
  }
  const asciiSlug = topic
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (/[\u3400-\u9fff]/.test(topic)) {
    const prefix = asciiSlug ? `${asciiSlug.slice(0, 40).replace(/-+$/g, "")}-` : "topic-";
    return `${prefix}${shortHash(topic)}`;
  }

  if (asciiSlug) {
    return asciiSlug.slice(0, 54).replace(/-+$/g, "");
  }

  return `topic-${shortHash(topic)}`;
}

function validateSource(source: RunConfig["source"]): void {
  if (!source || typeof source !== "object" || !("type" in source)) {
    throw new AgentRuntimeError("source is required", "INVALID_RUN_CONFIG");
  }
  if (source.type === "mixed") {
    if (!Array.isArray(source.items) || source.items.length === 0) {
      throw new AgentRuntimeError("source.items must contain at least one item", "INVALID_RUN_CONFIG");
    }
    source.items.forEach((item, index) => {
      const path = `source.items[${index}]`;
      if (!isRecord(item) || Array.isArray(item)) {
        throw new AgentRuntimeError(`${path} must be an object`, "INVALID_RUN_CONFIG");
      }
      validateSingleSource(item, path);
    });
    return;
  }
  validateSingleSource(source, "source");
}

function validateSources(sources: RunConfig["sources"]): void {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new AgentRuntimeError("sources must be a non-empty array", "INVALID_RUN_CONFIG");
  }
  for (const [index, source] of sources.entries()) {
    const path = `sources[${index}]`;
    if (!isRecord(source) || Array.isArray(source)) {
      throw new AgentRuntimeError(`${path} must be an object`, "INVALID_RUN_CONFIG");
    }
    if (!isNonEmptyString(source.id)) {
      throw new AgentRuntimeError(`${path}.id is required`, "INVALID_RUN_CONFIG");
    }
    if (!allowedSourceRecordTypes.has(source.type)) {
      throw new AgentRuntimeError(`${path}.type must be topic, text, file, folder, or url`, "INVALID_RUN_CONFIG");
    }
    if (!isNonEmptyString(source.title)) {
      throw new AgentRuntimeError(`${path}.title is required`, "INVALID_RUN_CONFIG");
    }
  }
}

function validateUserLearningProfile(profile: RunConfig["userLearningProfile"]): void {
  if (!isRecord(profile) || Array.isArray(profile)) {
    throw new AgentRuntimeError("userLearningProfile must be an object", "INVALID_RUN_CONFIG");
  }
  if (!allowedLearningLevels.has(profile.level)) {
    throw new AgentRuntimeError("userLearningProfile.level is invalid", "INVALID_RUN_CONFIG");
  }
  if (!allowedReadingHabits.has(profile.readingHabit)) {
    throw new AgentRuntimeError("userLearningProfile.readingHabit is invalid", "INVALID_RUN_CONFIG");
  }
  if (!allowedLearningGoals.has(profile.goal)) {
    throw new AgentRuntimeError("userLearningProfile.goal is invalid", "INVALID_RUN_CONFIG");
  }
  if (
    profile.preferredPageCountPerUnit !== undefined &&
    (!Number.isInteger(profile.preferredPageCountPerUnit) ||
      profile.preferredPageCountPerUnit < 1 ||
      profile.preferredPageCountPerUnit > 40)
  ) {
    throw new AgentRuntimeError(
      "userLearningProfile.preferredPageCountPerUnit must be an integer between 1 and 40",
      "INVALID_RUN_CONFIG"
    );
  }
  if (
    profile.preferredUnitCount !== undefined &&
    (!Number.isInteger(profile.preferredUnitCount) || profile.preferredUnitCount < 1 || profile.preferredUnitCount > 20)
  ) {
    throw new AgentRuntimeError(
      "userLearningProfile.preferredUnitCount must be an integer between 1 and 20",
      "INVALID_RUN_CONFIG"
    );
  }
  if (profile.timeBudgetMinutes !== undefined && (!Number.isInteger(profile.timeBudgetMinutes) || profile.timeBudgetMinutes < 1)) {
    throw new AgentRuntimeError("userLearningProfile.timeBudgetMinutes must be a positive integer", "INVALID_RUN_CONFIG");
  }
}

function validateCoveragePolicy(policy: CoveragePolicy): void {
  if (!isRecord(policy) || Array.isArray(policy)) {
    throw new AgentRuntimeError("coveragePolicy must be an object", "INVALID_RUN_CONFIG");
  }
  if (!allowedRequiredCoverage.has(policy.requiredCoverage)) {
    throw new AgentRuntimeError("coveragePolicy.requiredCoverage is invalid", "INVALID_RUN_CONFIG");
  }
  if (typeof policy.allowOmission !== "boolean") {
    throw new AgentRuntimeError("coveragePolicy.allowOmission must be boolean", "INVALID_RUN_CONFIG");
  }
  if (!Array.isArray(policy.omissionRules) || !policy.omissionRules.every((rule) => typeof rule === "string")) {
    throw new AgentRuntimeError("coveragePolicy.omissionRules must be strings", "INVALID_RUN_CONFIG");
  }
}

function validateRoleModels(roleModels: RunConfig["models"]["roleModels"]): void {
  if (roleModels === undefined) {
    return;
  }
  if (!isRecord(roleModels) || Array.isArray(roleModels)) {
    throw new AgentRuntimeError("models.roleModels must be an object", "INVALID_RUN_CONFIG");
  }
  for (const [role, roleModel] of Object.entries(roleModels)) {
    const path = `models.roleModels.${role}`;
    if (!isRecord(roleModel)) {
      throw new AgentRuntimeError(`${path} must be an object`, "INVALID_RUN_CONFIG");
    }
    if (!isNonEmptyString(roleModel.provider)) {
      throw new AgentRuntimeError(`${path}.provider is required`, "INVALID_RUN_CONFIG");
    }
    if (!isNonEmptyString(roleModel.model)) {
      throw new AgentRuntimeError(`${path}.model is required`, "INVALID_RUN_CONFIG");
    }
  }
}

function validateSingleSource(source: { type: unknown; value: unknown }, path: string): void {
  if (!allowedSourceTypes.has(String(source.type))) {
    throw new AgentRuntimeError(`${path}.type must be topic, text, file, or url`, "INVALID_RUN_CONFIG");
  }
  if (!isNonEmptyString(source.value)) {
    throw new AgentRuntimeError(`${path}.value is required`, "INVALID_RUN_CONFIG");
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}
