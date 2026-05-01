import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  AgentWorkflow,
  ApprovalService,
  ArtifactStore,
  BetaStatusService,
  CodexManualAdapter,
  CoursePackService,
  createRunConfigFromArgs,
  LessonPromotionService,
  LearningCoursePublisher,
  GroundedCourseService,
  LearningPreviewService,
  LearningRevisionService,
  LearnerProjectService,
  ManualSubmissionService,
  MockRuntimeAdapter,
  QuickPreviewService,
  RunPlanService,
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
      case "learning_agent.create_learning_project":
        return this.createLearningProject(input);
      case "learning_agent.generate_grounded_course":
        return this.generateGroundedCourse(input);
      case "learning_agent.publish_learning_course":
        return this.publishLearningCourse(input);
      case "learning_agent.get_learning_preview":
        return this.getLearningPreview(input);
      case "learning_agent.generate_quick_preview":
        return this.generateQuickPreview(input);
      case "learning_agent.revise_learning_course":
        return this.reviseLearningCourse(input);
      case "learning_agent.init_run":
        return this.initRun(input);
      case "learning_agent.plan_run":
        return this.planRun(input);
      case "learning_agent.init_from_plan":
        return this.initFromPlan(input);
      case "learning_agent.status":
        return this.status(input);
      case "learning_agent.beta_status":
        return this.betaStatus(input);
      case "learning_agent.run_until_gate":
        return this.runUntilGate(input);
      case "learning_agent.list_artifacts":
        return this.listArtifacts(input);
      case "learning_agent.read_artifact":
        return this.readArtifact(input);
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

  private async createLearningProject(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new LearnerProjectService(this.workspaceRoot).createProject({
      request: requiredString(options, "request"),
      runId: optionalString(options.runId),
      sourcePath: optionalString(options.sourcePath),
      sourceKind: optionalString(options.sourceKind),
      audience: optionalString(options.audience),
      unitPages: optionalNumber(options.unitPages),
      strategy: optionalString(options.strategy),
      selectedChapters: optionalStringArray(options.selectedChapters),
      selectedTopics: optionalStringArray(options.selectedTopics)
    });
  }

  private async generateGroundedCourse(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new GroundedCourseService(this.workspaceRoot).generate({
      runId: requiredString(options, "runId"),
      maxAnchorsPerLesson: optionalNumber(options.maxAnchorsPerLesson)
    });
  }

  private async publishLearningCourse(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new LearningCoursePublisher(this.workspaceRoot).publish({
      runId: requiredString(options, "runId"),
      lessons: requiredArray(options, "lessons"),
      coursePack: options.coursePack,
      publishNotes: optionalString(options.publishNotes)
    });
  }

  private async getLearningPreview(input: unknown): Promise<unknown> {
    return new LearningPreviewService(this.workspaceRoot).getPreview(requiredString(expectRecord(input), "runId"));
  }

  private async generateQuickPreview(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new QuickPreviewService(this.workspaceRoot).generate({
      runId: requiredString(options, "runId"),
      maxSteps: optionalNumber(options.maxSteps) ?? 80
    });
  }

  private async reviseLearningCourse(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new LearningRevisionService(this.workspaceRoot).requestRevision({
      runId: requiredString(options, "runId"),
      feedback: requiredString(options, "feedback"),
      focus: optionalString(options.focus)
    });
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

  private async planRun(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    const service = new RunPlanService(this.workspaceRoot);
    const plan = service.createPlan(requiredString(options, "request"), {
      runId: optionalString(options.runId),
      adapter: optionalString(options.adapter)
    });
    const planPath = await service.writePlan(plan);
    return {
      status: "plan_written",
      runId: plan.runId,
      planPath,
      summary: plan.summary,
      reviewItems: plan.reviewItems
    };
  }

  private async initFromPlan(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    const result = await new RunPlanService(this.workspaceRoot).initializeRunFromPlan(requiredString(options, "runId"), {
      approve: optionalBoolean(options.approve) ?? false
    });
    return {
      status: result.status,
      runId: result.runId,
      runPath: result.runPath,
      planPath: result.planPath,
      topic: result.config.topic,
      sourceKind: result.config.sourceKind,
      outputLanguage: result.config.outputLanguage,
      pageCount: result.config.pageCount,
      coursePack: result.config.coursePack
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

  private async betaStatus(input: unknown): Promise<unknown> {
    return new BetaStatusService(this.workspaceRoot).getStatus(requiredString(expectRecord(input), "runId"));
  }

  private async runUntilGate(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    const runId = requiredString(options, "runId");
    const maxSteps = optionalNumber(options.maxSteps) ?? 20;
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 100) {
      throw new Error("maxSteps must be an integer between 1 and 100");
    }

    const workflow = await this.createWorkflow(runId);
    const steps = [];

    for (let index = 0; index < maxSteps; index += 1) {
      const step = await workflow.runNext(runId);
      steps.push(step);
      if (step.status !== "artifact_written") {
        break;
      }
    }

    const lastStep = steps.at(-1) ?? { status: "complete" as const };
    return {
      status: "run_advanced",
      runId,
      steps,
      finalStatus: lastStep.status,
      ...(lastStep.status === "approval_required" ? { requiredGate: lastStep.requiredGate } : {}),
      ...(lastStep.status === "manual_action_required"
        ? { manualAction: { roleId: lastStep.roleId, artifactId: lastStep.artifactId, promptPath: lastStep.promptPath } }
        : {})
    };
  }

  private async listArtifacts(input: unknown): Promise<unknown> {
    const runId = requiredString(expectRecord(input), "runId");
    const artifactsPath = path.join(this.runStore.getRunPath(runId), "artifacts");
    const entries = await readdir(artifactsPath).catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    });
    const artifacts = new Map<string, { artifactId: string; versions: string[]; aliases: string[] }>();

    for (const entry of entries) {
      const parsed = /^(?<artifactId>[a-z][a-z0-9-]{0,63})\.(?<suffix>v[1-9][0-9]*|draft|approved)\.json$/u.exec(entry)?.groups;
      if (!parsed?.artifactId || !parsed.suffix) {
        continue;
      }
      const record = artifacts.get(parsed.artifactId) ?? { artifactId: parsed.artifactId, versions: [], aliases: [] };
      if (/^v/u.test(parsed.suffix)) {
        record.versions.push(parsed.suffix);
      } else {
        record.aliases.push(parsed.suffix);
      }
      artifacts.set(parsed.artifactId, record);
    }

    return {
      runId,
      artifacts: Array.from(artifacts.values())
        .map((artifact) => ({
          artifactId: artifact.artifactId,
          versions: artifact.versions.sort(compareVersions),
          aliases: artifact.aliases.sort()
        }))
        .sort((left, right) => left.artifactId.localeCompare(right.artifactId))
    };
  }

  private async readArtifact(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    const runId = requiredString(options, "runId");
    const artifactId = requiredString(options, "artifactId");
    const version = optionalString(options.version);
    const artifactStore = new ArtifactStore(this.runStore.getRunPath(runId));
    if (version) {
      const payload = await artifactStore.readVersion(artifactId, toArtifactVersion(version));
      return { runId, artifactId, version, payload };
    }

    const payload = await artifactStore.readDraft(artifactId);
    return { runId, artifactId, version: "draft", payload };
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
      "learning_agent.create_learning_project",
      "learning_agent.generate_grounded_course",
      "learning_agent.publish_learning_course",
    "learning_agent.get_learning_preview",
    "learning_agent.generate_quick_preview",
    "learning_agent.revise_learning_course",
    "learning_agent.init_run",
    "learning_agent.plan_run",
    "learning_agent.init_from_plan",
    "learning_agent.status",
    "learning_agent.beta_status",
    "learning_agent.run_until_gate",
    "learning_agent.list_artifacts",
    "learning_agent.read_artifact",
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

function compareVersions(left: string, right: string): number {
  return Number(left.slice(1)) - Number(right.slice(1));
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

function requiredArray(input: Record<string, unknown>, key: string): unknown[] {
  const value = input[key];
  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : undefined;
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
