import { AgentRuntimeError } from "./errors.js";
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
const allowedApprovalGates = new Set<ApprovalGateId>([
  "learning-architecture",
  "lesson",
  "critic-report",
  "publish-package"
]);

const defaultApprovalGates: ApprovalGateId[] = [
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

  const runId = args.run?.trim() || `${slugifyTopic(topic)}-001`;
  const adapter = normalizeAdapter(args.adapter);

  return validateRunConfig({
    runId,
    topic,
    source: { type: "topic", value: topic },
    audience: "具备基础技术背景、希望通过中文互动课程建立心智模型的学习者。",
    outputLanguage: args.language?.trim() || "zh-CN",
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
