import {
  AgentWorkflow,
  ApprovalService,
  ArtifactStore,
  CodexManualAdapter,
  CoursePackService,
  createRunConfigFromArgs,
  LessonPromotionService,
  ManualSubmissionService,
  MockRuntimeAdapter,
  RunStore
} from "../agent-runtime/index.js";
import type { ArtifactVersion } from "../agent-runtime/artifact-store.js";
import type { ApprovalGateId } from "../agent-runtime/types.js";
import type { LearningAgentToolName } from "./tool-contracts.js";

const gateToArtifact: Record<ApprovalGateId, string> = {
  "source-map": "source-map",
  "concept-map": "concept-map",
  "curriculum-plan": "curriculum-plan",
  "learning-architecture": "learning-architecture",
  lesson: "lesson",
  "critic-report": "critic-report",
  "publish-package": "publish-package"
};

export class LearningAgentRuntimeTools {
  private readonly runStore: RunStore;

  constructor(private readonly workspaceRoot = process.cwd()) {
    this.runStore = new RunStore(workspaceRoot);
  }

  async callTool(name: string, input: unknown): Promise<unknown> {
    if (!isLearningAgentToolName(name)) {
      throw new Error(`unsupported tool: ${name}`);
    }

    switch (name) {
      case "learning_agent.init_run":
        return this.initRun(input);
      case "learning_agent.status":
        return this.status(input);
      case "learning_agent.submit_artifact":
        return this.submitArtifact(input);
      case "learning_agent.approve_gate":
        return this.decideGate(input, "approved");
      case "learning_agent.revise_gate":
        return this.decideGate(input, "revision_requested");
      case "learning_agent.list_units":
        return this.listUnits(input);
      case "learning_agent.run_next":
        return this.runNext(input);
      case "learning_agent.run_course":
        return this.runCourse(input);
      case "learning_agent.promote_units":
        return this.promoteUnits(input);
      case "learning_agent.promote_lesson":
        return this.promoteLesson(input);
    }
  }

  private async initRun(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    const config = createRunConfigFromArgs({
      topic: optionalString(options.topic),
      pages: optionalString(options.pages),
      unitPages: optionalString(options.unitPages),
      sourceFile: optionalString(options.sourceFile),
      sourceFolder: optionalString(options.sourceFolder),
      sourceUrl: optionalString(options.sourceUrl),
      sourceText: optionalString(options.sourceText),
      sourceKind: optionalString(options.sourceKind),
      sourceTitle: optionalString(options.sourceTitle),
      planningMode: optionalString(options.planningMode),
      strategy: optionalString(options.strategy),
      units: optionalString(options.units),
      chapters: optionalString(options.chapters),
      topics: optionalString(options.topics),
      audience: optionalString(options.audience),
      language: optionalString(options.language),
      adapter: optionalString(options.adapter),
      run: optionalString(options.run)
    });
    const runPath = await this.runStore.createRun(config);
    return {
      status: "initialized",
      runId: config.runId,
      topic: config.topic,
      sourceKind: config.sourceKind,
      outputLanguage: config.outputLanguage,
      pageCount: config.pageCount,
      coursePack: config.coursePack,
      runPath
    };
  }

  private async status(input: unknown): Promise<unknown> {
    const runId = requiredString(expectRecord(input), "runId");
    const config = await this.runStore.readConfig(runId);
    return {
      runId: config.runId,
      topic: config.topic,
      sourceKind: config.sourceKind,
      outputLanguage: config.outputLanguage,
      pageCount: config.pageCount,
      coursePack: config.coursePack,
      selectedUnit: config.selectedUnit
    };
  }

  private async submitArtifact(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new ManualSubmissionService(this.workspaceRoot).submit({
      runId: requiredString(options, "runId"),
      artifactId: requiredString(options, "artifactId"),
      filePath: requiredString(options, "filePath")
    });
  }

  private async decideGate(input: unknown, decision: "approved" | "revision_requested"): Promise<unknown> {
    const options = expectRecord(input);
    const runId = requiredString(options, "runId");
    const gate = requiredGate(options);
    const version = toArtifactVersion(requiredString(options, "version"));
    const runPath = this.runStore.getRunPath(runId);
    const artifactStore = new ArtifactStore(runPath);
    const approvalService = new ApprovalService(runPath, artifactStore);
    return approvalService.approve({
      gate,
      runId,
      artifactId: gateToArtifact[gate],
      version,
      decision,
      operatorNotes: optionalString(options.notes) ?? ""
    });
  }

  private async listUnits(input: unknown): Promise<unknown> {
    return new CoursePackService(this.workspaceRoot).listUnits(requiredString(expectRecord(input), "runId"));
  }

  private async runNext(input: unknown): Promise<unknown> {
    const runId = requiredString(expectRecord(input), "runId");
    const workflow = await this.createWorkflow(runId);
    return workflow.runNext(runId);
  }

  private async runCourse(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new CoursePackService(this.workspaceRoot).orchestrateCourse({
      runId: requiredString(options, "runId"),
      unitSelector: optionalString(options.unitSelector) || "all",
      maxSteps: optionalNumber(options.maxSteps) ?? 20,
      promote: optionalBoolean(options.promote) ?? false
    });
  }

  private async promoteUnits(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new CoursePackService(this.workspaceRoot).promoteUnitRuns(
      requiredString(options, "runId"),
      optionalString(options.unitSelector) || "all"
    );
  }

  private async promoteLesson(input: unknown): Promise<unknown> {
    const runId = requiredString(expectRecord(input), "runId");
    const result = await new LessonPromotionService(this.workspaceRoot).promote(runId);
    return {
      status: "promoted",
      ...result
    };
  }

  private async createWorkflow(runId: string): Promise<AgentWorkflow> {
    const runPath = this.runStore.getRunPath(runId);
    const artifactStore = new ArtifactStore(runPath);
    const approvalService = new ApprovalService(runPath, artifactStore);
    const config = await this.runStore.readConfig(runId);
    const adapter = config.runtime.adapter === "codex-manual" ? new CodexManualAdapter() : new MockRuntimeAdapter();
    return new AgentWorkflow(this.runStore, artifactStore, approvalService, adapter);
  }
}

function isLearningAgentToolName(name: string): name is LearningAgentToolName {
  return [
    "learning_agent.init_run",
    "learning_agent.status",
    "learning_agent.submit_artifact",
    "learning_agent.approve_gate",
    "learning_agent.revise_gate",
    "learning_agent.list_units",
    "learning_agent.run_next",
    "learning_agent.run_course",
    "learning_agent.promote_units",
    "learning_agent.promote_lesson"
  ].includes(name);
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("tool input must be an object");
  }
  return value as Record<string, unknown>;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function requiredGate(input: Record<string, unknown>): ApprovalGateId {
  const gate = requiredString(input, "gate");
  if (!Object.hasOwn(gateToArtifact, gate)) {
    throw new Error(`gate must be one of ${Object.keys(gateToArtifact).join(", ")}`);
  }
  return gate as ApprovalGateId;
}

function toArtifactVersion(version: string): ArtifactVersion {
  if (!/^v[1-9][0-9]*$/.test(version)) {
    throw new Error("version must match /^v[1-9][0-9]*$/");
  }
  return version as ArtifactVersion;
}
