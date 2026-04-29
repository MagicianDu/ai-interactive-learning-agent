import { AgentRuntimeError } from "./errors.js";
import path from "node:path";

import type {
  CoursePackConfig,
  CoursePackStrategy,
  CoveragePolicy,
  CurriculumPlanningMode,
  SourceMaterialKind,
  SourceRecord,
  UserLearningProfile
} from "./corpus-types.js";
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
const allowedSourceTypes = new Set(["topic", "text", "file", "folder", "url"]);
const allowedSourceRecordTypes = new Set<SourceRecord["type"]>(["topic", "text", "file", "folder", "url"]);
const allowedSourceMaterialKinds = new Set<SourceMaterialKind>([
  "book",
  "paper",
  "patent",
  "blog",
  "documentation",
  "notes",
  "course",
  "mixed",
  "unknown"
]);
const allowedCurriculumPlanningModes = new Set<CurriculumPlanningMode>([
  "chapter_guided",
  "topic_guided",
  "concept_guided",
  "task_guided",
  "hybrid"
]);
const allowedCoursePackStrategies = new Set<CoursePackStrategy>([
  "overview_plus_topic",
  "chapter_guided",
  "topic_guided",
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

const operatorAdapters = new Set(["codex", "codex-manual", "claude", "claude-code", "openclaw", "openclaw-cli"]);

const topicSlugMap: Record<string, string> = {
  哈希表: "hash-table",
  数据库索引: "database-index"
};

type SingleSourceType = "topic" | "text" | "file" | "folder" | "url";

type ResolvedSourceInput = {
  type: SingleSourceType;
  value: string;
  title: string;
};

export function createRunConfigFromArgs(args: CliInitArgs): RunConfig {
  const outputLanguage = args.language?.trim() || "zh-CN";
  const sourceInput = resolveSourceInput(args, outputLanguage);
  const topic = args.topic?.trim() || args.sourceTitle?.trim() || sourceInput.title;

  if (!topic) {
    throw new AgentRuntimeError("topic or source is required", "INVALID_RUN_CONFIG");
  }

  const targetPages = Number(args.unitPages ?? args.pages ?? "10");
  if (!Number.isInteger(targetPages) || targetPages < 1 || targetPages > 40) {
    throw new AgentRuntimeError("pages must be between 1 and 40", "INVALID_RUN_CONFIG");
  }
  const requestedAdapter = (args.adapter || "mock").trim().toLowerCase();
  const adapter = normalizeAdapter(requestedAdapter);
  const manualAdapterId = manualAdapterHint(requestedAdapter);
  const provider = adapter === "mock" ? "mock" : manualAdapterId;
  const model = adapter === "mock" ? "mock-learning-agent" : `manual-${manualAdapterId}-session`;

  const runId = args.run?.trim() || `${slugifyTopic(topic)}-001`;
  const sourceKind = normalizeSourceKind(args.sourceKind, sourceInput);
  const planningMode = normalizePlanningMode(args.planningMode);
  const strategy = normalizeCoursePackStrategy(args.strategy);
  const preferredUnitCount = parseOptionalPositiveInteger(args.units, "units", 20);
  const selectedChapters = parseList(args.chapters);
  const selectedTopics = parseList(args.topics);
  const coursePack = buildCoursePackConfig({
    strategy,
    targetPages,
    preferredUnitCount,
    selectedChapters,
    selectedTopics
  });

  return validateRunConfig({
    runId,
    topic,
    source: {
      type: sourceInput.type,
      value: sourceInput.value,
      label: sourceInput.title
    },
    sourceKind,
    sources: [toSourceRecord(sourceInput, sourceKind, outputLanguage)],
    audience: args.audience?.trim() || "具备基础技术背景、希望通过中文互动课程建立心智模型的学习者。",
    userLearningProfile: {
      level: "basic",
      readingHabit: "visual_first",
      goal: "understand",
      preferredPageCountPerUnit: targetPages
    },
    curriculumPlanningMode: planningMode,
    coveragePolicy: buildDefaultCoveragePolicy(sourceInput.type, strategy),
    coursePack,
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
        provider,
        model,
        reasoningEffort: "medium",
        temperature: 0.3
      }
    },
    modelFallbackPolicy: "require_approval",
    approvalGates: defaultApprovalGates
  });
}

function resolveSourceInput(args: CliInitArgs, language: string): ResolvedSourceInput {
  const explicitSources: ResolvedSourceInput[] = [];

  if (args.sourceFile?.trim()) {
    explicitSources.push({
      type: "file",
      value: args.sourceFile.trim(),
      title: args.sourceTitle?.trim() || deriveTitleFromSource(args.sourceFile.trim(), "file")
    });
  }
  if (args.sourceFolder?.trim()) {
    explicitSources.push({
      type: "folder",
      value: args.sourceFolder.trim(),
      title: args.sourceTitle?.trim() || deriveTitleFromSource(args.sourceFolder.trim(), "folder")
    });
  }
  if (args.sourceUrl?.trim()) {
    explicitSources.push({
      type: "url",
      value: args.sourceUrl.trim(),
      title: args.sourceTitle?.trim() || deriveTitleFromSource(args.sourceUrl.trim(), "url")
    });
  }
  if (args.sourceText?.trim()) {
    explicitSources.push({
      type: "text",
      value: args.sourceText.trim(),
      title: args.sourceTitle?.trim() || args.topic?.trim() || `${language} pasted source`
    });
  }

  if (explicitSources.length > 1) {
    throw new AgentRuntimeError("only one explicit source is supported by init; use mixed source config for multi-source runs", "INVALID_RUN_CONFIG");
  }
  if (explicitSources.length === 1) {
    return explicitSources[0];
  }

  const topic = args.topic?.trim();
  if (!topic) {
    throw new AgentRuntimeError("topic or source is required", "INVALID_RUN_CONFIG");
  }
  return {
    type: "topic",
    value: topic,
    title: args.sourceTitle?.trim() || topic
  };
}

function deriveTitleFromSource(value: string, type: SingleSourceType): string {
  if (type === "url") {
    try {
      const url = new URL(value);
      const leaf = url.pathname.split("/").filter(Boolean).at(-1);
      return decodeURIComponent(leaf || url.hostname);
    } catch {
      return value;
    }
  }
  if (type === "file" || type === "folder") {
    const baseName = path.basename(value).replace(/\.[^.]+$/u, "");
    return baseName || value;
  }
  return value.slice(0, 80) || "source";
}

function normalizeSourceKind(kind: string | undefined, source: ResolvedSourceInput): SourceMaterialKind {
  const normalized = kind?.trim().toLowerCase();
  if (normalized) {
    if (!allowedSourceMaterialKinds.has(normalized as SourceMaterialKind)) {
      throw new AgentRuntimeError(
        "sourceKind must be book, paper, patent, blog, documentation, notes, course, mixed, or unknown",
        "INVALID_RUN_CONFIG"
      );
    }
    return normalized as SourceMaterialKind;
  }

  if (source.type === "topic") {
    return "unknown";
  }
  if (source.type === "url" && /blog|post|article/u.test(source.value.toLowerCase())) {
    return "blog";
  }
  return "unknown";
}

function normalizePlanningMode(mode: string | undefined): CurriculumPlanningMode {
  const normalized = mode?.trim().toLowerCase() || "hybrid";
  if (!allowedCurriculumPlanningModes.has(normalized as CurriculumPlanningMode)) {
    throw new AgentRuntimeError(
      "planningMode must be chapter_guided, topic_guided, concept_guided, task_guided, or hybrid",
      "INVALID_RUN_CONFIG"
    );
  }
  return normalized as CurriculumPlanningMode;
}

function normalizeCoursePackStrategy(strategy: string | undefined): CoursePackStrategy {
  const normalized = strategy?.trim().toLowerCase() || "overview_plus_topic";
  if (!allowedCoursePackStrategies.has(normalized as CoursePackStrategy)) {
    throw new AgentRuntimeError(
      "strategy must be overview_plus_topic, chapter_guided, topic_guided, task_guided, or hybrid",
      "INVALID_RUN_CONFIG"
    );
  }
  return normalized as CoursePackStrategy;
}

function parseOptionalPositiveInteger(value: string | undefined, fieldName: string, max: number): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new AgentRuntimeError(`${fieldName} must be an integer between 1 and ${max}`, "INVALID_RUN_CONFIG");
  }
  return parsed;
}

function parseList(value: string | undefined): string[] | undefined {
  const items = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items && items.length > 0 ? items : undefined;
}

function buildCoursePackConfig({
  strategy,
  targetPages,
  preferredUnitCount,
  selectedChapters,
  selectedTopics
}: {
  strategy: CoursePackStrategy;
  targetPages: number;
  preferredUnitCount?: number;
  selectedChapters?: string[];
  selectedTopics?: string[];
}): CoursePackConfig {
  return {
    strategy,
    includeOverview: strategy === "overview_plus_topic" || strategy === "hybrid",
    preserveSourceMapping: true,
    unitPageCount: targetPages,
    preferredUnitCount,
    selectedChapters,
    selectedTopics,
    outputProducts: ["web_lesson", "assessment"]
  };
}

function buildDefaultCoveragePolicy(sourceType: SingleSourceType, strategy: CoursePackStrategy): CoveragePolicy {
  if (sourceType === "topic") {
    return {
      requiredCoverage: "core_concepts",
      allowOmission: true,
      omissionRules: ["topic-only runs may omit source coverage beyond generated concept anchors"]
    };
  }

  return {
    requiredCoverage: strategy === "chapter_guided" ? "selected_sections" : "goal_relevant",
    allowOmission: true,
    omissionRules: [
      "source-grounded runs must preserve source anchors for omitted or deferred sections",
      "overview_plus_topic runs should create an overview unit before topic-focused units"
    ]
  };
}

function toSourceRecord(source: ResolvedSourceInput, sourceKind: SourceMaterialKind, language: string): SourceRecord {
  const record: SourceRecord = {
    id: "source-001",
    type: source.type,
    kind: sourceKind,
    title: source.title,
    language
  };

  if (source.type === "topic" || source.type === "text") {
    record.value = source.value;
  } else {
    record.uri = source.value;
    record.value = source.value;
  }

  return record;
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
  if (config.sourceKind !== undefined && !allowedSourceMaterialKinds.has(config.sourceKind)) {
    throw new AgentRuntimeError("sourceKind is invalid", "INVALID_RUN_CONFIG");
  }
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
      "curriculumPlanningMode must be chapter_guided, topic_guided, concept_guided, task_guided, or hybrid",
      "INVALID_RUN_CONFIG"
    );
  }
  validateCoveragePolicy(config.coveragePolicy);
  validateCoursePack(config.coursePack);
  validateSelectedUnit(config.selectedUnit);
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

function validateSelectedUnit(unit: RunConfig["selectedUnit"]): void {
  if (unit === undefined) {
    return;
  }
  if (!isRecord(unit) || Array.isArray(unit)) {
    throw new AgentRuntimeError("selectedUnit must be an object", "INVALID_RUN_CONFIG");
  }
  if (
    !isNonEmptyString(unit.id) ||
    !isNonEmptyString(unit.title) ||
    !isNonEmptyString(unit.kind) ||
    !isNonEmptyString(unit.purpose) ||
    !isNonEmptyString(unit.parentRunId)
  ) {
    throw new AgentRuntimeError("selectedUnit is missing required strings", "INVALID_RUN_CONFIG");
  }
  if (!["overview", "chapter", "topic", "task", "hybrid"].includes(unit.kind)) {
    throw new AgentRuntimeError("selectedUnit.kind is invalid", "INVALID_RUN_CONFIG");
  }
  if (!Number.isInteger(unit.targetPageCount) || unit.targetPageCount < 1 || unit.targetPageCount > 40) {
    throw new AgentRuntimeError("selectedUnit.targetPageCount must be an integer between 1 and 40", "INVALID_RUN_CONFIG");
  }
  if (!isStringArray(unit.sourceAnchorIds)) {
    throw new AgentRuntimeError("selectedUnit.sourceAnchorIds must be strings", "INVALID_RUN_CONFIG");
  }
  if (unit.sourceNodeIds !== undefined && !isStringArray(unit.sourceNodeIds)) {
    throw new AgentRuntimeError("selectedUnit.sourceNodeIds must be strings", "INVALID_RUN_CONFIG");
  }
  if (unit.chapterRefs !== undefined && !isStringArray(unit.chapterRefs)) {
    throw new AgentRuntimeError("selectedUnit.chapterRefs must be strings", "INVALID_RUN_CONFIG");
  }
  if (!isStringArray(unit.conceptIds)) {
    throw new AgentRuntimeError("selectedUnit.conceptIds must be strings", "INVALID_RUN_CONFIG");
  }
  if (
    !Array.isArray(unit.outputProducts) ||
    !unit.outputProducts.every((product) =>
      ["web_lesson", "whiteboard_map", "playground", "assessment", "teacher_notes"].includes(product)
    )
  ) {
    throw new AgentRuntimeError("selectedUnit.outputProducts contains unsupported products", "INVALID_RUN_CONFIG");
  }
}

function normalizeAdapter(adapter?: string): RuntimeAdapterId {
  const normalized = (adapter || "mock").trim().toLowerCase();
  if (normalized === "mock") {
    return normalized;
  }
  if (operatorAdapters.has(normalized)) {
    return "codex-manual";
  }
  throw new AgentRuntimeError(`unsupported adapter: ${normalized}`, "UNSUPPORTED_ADAPTER");
}

function manualAdapterHint(adapter: string): string {
  const normalized = adapter.toLowerCase();
  if (normalized === "claude" || normalized === "claude-code") {
    return "claude";
  }
  if (normalized === "openclaw" || normalized === "openclaw-cli") {
    return "openclaw";
  }
  if (normalized === "codex" || normalized === "codex-manual") {
    return "codex";
  }
  return "codex";
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
    if (source.kind !== undefined && !allowedSourceMaterialKinds.has(source.kind)) {
      throw new AgentRuntimeError(`${path}.kind is invalid`, "INVALID_RUN_CONFIG");
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

function validateCoursePack(coursePack: CoursePackConfig | undefined): void {
  if (coursePack === undefined) {
    return;
  }
  if (!isRecord(coursePack) || Array.isArray(coursePack)) {
    throw new AgentRuntimeError("coursePack must be an object", "INVALID_RUN_CONFIG");
  }
  if (!allowedCoursePackStrategies.has(coursePack.strategy)) {
    throw new AgentRuntimeError("coursePack.strategy is invalid", "INVALID_RUN_CONFIG");
  }
  if (typeof coursePack.includeOverview !== "boolean") {
    throw new AgentRuntimeError("coursePack.includeOverview must be boolean", "INVALID_RUN_CONFIG");
  }
  if (typeof coursePack.preserveSourceMapping !== "boolean") {
    throw new AgentRuntimeError("coursePack.preserveSourceMapping must be boolean", "INVALID_RUN_CONFIG");
  }
  if (!Number.isInteger(coursePack.unitPageCount) || coursePack.unitPageCount < 1 || coursePack.unitPageCount > 40) {
    throw new AgentRuntimeError("coursePack.unitPageCount must be an integer between 1 and 40", "INVALID_RUN_CONFIG");
  }
  if (
    coursePack.preferredUnitCount !== undefined &&
    (!Number.isInteger(coursePack.preferredUnitCount) || coursePack.preferredUnitCount < 1 || coursePack.preferredUnitCount > 20)
  ) {
    throw new AgentRuntimeError("coursePack.preferredUnitCount must be an integer between 1 and 20", "INVALID_RUN_CONFIG");
  }
  if (coursePack.selectedChapters !== undefined && !isStringArray(coursePack.selectedChapters)) {
    throw new AgentRuntimeError("coursePack.selectedChapters must be strings", "INVALID_RUN_CONFIG");
  }
  if (coursePack.selectedTopics !== undefined && !isStringArray(coursePack.selectedTopics)) {
    throw new AgentRuntimeError("coursePack.selectedTopics must be strings", "INVALID_RUN_CONFIG");
  }
  if (
    !Array.isArray(coursePack.outputProducts) ||
    !coursePack.outputProducts.every((product) =>
      ["web_lesson", "whiteboard_map", "playground", "assessment", "teacher_notes"].includes(product)
    )
  ) {
    throw new AgentRuntimeError("coursePack.outputProducts contains unsupported products", "INVALID_RUN_CONFIG");
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
    throw new AgentRuntimeError(`${path}.type must be topic, text, file, folder, or url`, "INVALID_RUN_CONFIG");
  }
  if (!isNonEmptyString(source.value)) {
    throw new AgentRuntimeError(`${path}.value is required`, "INVALID_RUN_CONFIG");
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
