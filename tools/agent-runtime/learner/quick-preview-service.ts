import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ApprovalService } from "../approval-service.js";
import { ArtifactStore, type ArtifactVersion } from "../artifact-store.js";
import { CoursePackService, type PromoteUnitRunsResult } from "../course-pack-service.js";
import { AgentRuntimeError } from "../errors.js";
import { MockRuntimeAdapter } from "../adapters/mock-adapter.js";
import { RunPlanService } from "../natural-language/run-plan-service.js";
import { RunStore } from "../run-store.js";
import type { ApprovalGateId } from "../types.js";
import { AgentWorkflow, type AgentWorkflowResult } from "../workflow/agent-workflow.js";

export type GenerateQuickPreviewInput = {
  runId: string;
  maxSteps?: number;
};

export type GenerateQuickPreviewResult =
  | {
      status: "preview_ready";
      runId: string;
      autoApprovedGates: string[];
      coursePackId: string;
      coursePackPath: string;
      preview: {
        devCommand: "npm run dev";
        localUrl: "http://127.0.0.1:5173/";
        instructions: string[];
      };
    }
  | {
      status: "quality_blocked";
      runId: string;
      userMessage: string;
      blockingIssues: string[];
      autoApprovedGates: string[];
    };

type LearnerProjectFile = {
  request?: string;
};

const gateArtifactIds: Record<ApprovalGateId, string> = {
  "source-map": "source-map",
  "concept-map": "concept-map",
  "curriculum-plan": "curriculum-plan",
  "learning-architecture": "learning-architecture",
  lesson: "lesson",
  "critic-report": "critic-report",
  "publish-package": "publish-package"
};

export class QuickPreviewService {
  private readonly runStore: RunStore;

  constructor(private readonly workspaceRoot: string = process.cwd()) {
    this.runStore = new RunStore(workspaceRoot);
  }

  async generate(input: GenerateQuickPreviewInput): Promise<GenerateQuickPreviewResult> {
    const maxSteps = input.maxSteps ?? 80;
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 200) {
      throw new AgentRuntimeError("maxSteps must be an integer between 1 and 200", "INVALID_RUN_CONFIG");
    }

    await this.ensureRunInitialized(input.runId);

    const autoApprovedGates: string[] = [];
    const parentBlocked = await this.advanceRunAndApproveGates(input.runId, maxSteps, autoApprovedGates);
    if (parentBlocked) {
      return qualityBlocked(input.runId, parentBlocked, autoApprovedGates);
    }

    const promoted = await this.advanceCourseAndPromote(input.runId, maxSteps, autoApprovedGates);
    if (Array.isArray(promoted)) {
      return qualityBlocked(input.runId, promoted, autoApprovedGates);
    }

    const preview = await this.writePreviewManifest(input.runId, promoted);
    return {
      status: "preview_ready",
      runId: input.runId,
      autoApprovedGates,
      coursePackId: promoted.coursePackId,
      coursePackPath: promoted.coursePackPath,
      preview
    };
  }

  private async ensureRunInitialized(runId: string): Promise<void> {
    try {
      await this.runStore.readConfig(runId);
      return;
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
    }

    const projectPath = path.join(this.runStore.getRunPath(runId), "learner-project.json");
    const project = JSON.parse(await readFile(projectPath, "utf8")) as LearnerProjectFile;
    if (typeof project.request !== "string" || project.request.trim().length === 0) {
      throw new AgentRuntimeError("learner-project.json is missing request", "INVALID_RUN_CONFIG");
    }

    const plans = new RunPlanService(this.workspaceRoot);
    const plan = plans.createPlan(project.request, { runId, adapter: "mock" });
    await plans.writePlan(plan);
    await plans.initializeRunFromPlan(runId, { approve: true });
  }

  private async advanceRunAndApproveGates(
    runId: string,
    maxSteps: number,
    autoApprovedGates: string[]
  ): Promise<string[] | undefined> {
    const runPath = this.runStore.getRunPath(runId);
    const artifactStore = new ArtifactStore(runPath);
    const approvalService = new ApprovalService(runPath, artifactStore);
    const workflow = new AgentWorkflow(this.runStore, artifactStore, approvalService, new MockRuntimeAdapter());

    for (let step = 0; step < maxSteps; step += 1) {
      const result = await workflow.runNext(runId);
      if (result.status === "artifact_written") {
        continue;
      }
      if (result.status === "approval_required") {
        const issues = await this.autoApproveGate(runId, result.requiredGate, autoApprovedGates);
        if (issues.length > 0) {
          return issues;
        }
        if (result.requiredGate === "curriculum-plan") {
          return undefined;
        }
        continue;
      }
      if (result.status === "manual_action_required") {
        return [`${runId}:${result.artifactId} requires manual action: ${result.message}`];
      }
      return undefined;
    }

    return [`${runId} did not complete within maxSteps=${maxSteps}`];
  }

  private async advanceCourseAndPromote(
    runId: string,
    maxSteps: number,
    autoApprovedGates: string[]
  ): Promise<PromoteUnitRunsResult | string[]> {
    const courseService = new CoursePackService(this.workspaceRoot);

    for (let cycle = 0; cycle < maxSteps; cycle += 1) {
      const result = await courseService.orchestrateCourse({ runId, unitSelector: "all", maxSteps: 20, promote: false });
      const issues: string[] = [];
      let approvedGate = false;
      let hasIncompleteChildRun = false;

      for (const childRun of result.childRuns) {
        const lastStep = childRun.steps.at(-1);
        if (!lastStep) {
          hasIncompleteChildRun = true;
          continue;
        }
        if (lastStep.status === "approval_required") {
          const gateIssues = await this.autoApproveGate(childRun.runId, lastStep.requiredGate, autoApprovedGates);
          issues.push(...gateIssues);
          approvedGate = gateIssues.length === 0 || approvedGate;
          hasIncompleteChildRun = true;
          continue;
        }
        if (lastStep.status === "manual_action_required") {
          issues.push(`${childRun.runId}:${lastStep.artifactId} requires manual action: ${lastStep.message}`);
          hasIncompleteChildRun = true;
          continue;
        }
        if (lastStep.status !== "complete") {
          hasIncompleteChildRun = true;
        }
      }

      if (issues.length > 0) {
        return issues;
      }
      if (approvedGate || hasIncompleteChildRun) {
        continue;
      }
      return courseService.promoteUnitRuns(runId, "all");
    }

    return [`course child runs did not complete within maxSteps=${maxSteps}`];
  }

  private async autoApproveGate(runId: string, gate: ApprovalGateId, autoApprovedGates: string[]): Promise<string[]> {
    const artifactId = gateArtifactIds[gate];
    const runPath = this.runStore.getRunPath(runId);
    const artifactStore = new ArtifactStore(runPath);
    const payload = await artifactStore.readDraft(artifactId);
    const issues = validateAutoApprovalPayload(gate, payload);
    if (issues.length > 0) {
      return issues.map((issue) => `${runId}:${gate}: ${issue}`);
    }

    await new ApprovalService(runPath, artifactStore).approve({
      gate,
      runId,
      artifactId,
      version: await latestArtifactVersion(runPath, artifactId),
      decision: "approved",
      operatorNotes: "Auto-approved for learner-facing quick preview after structural checks."
    });
    autoApprovedGates.push(gate);
    return [];
  }

  private async writePreviewManifest(
    runId: string,
    promoted: PromoteUnitRunsResult
  ): Promise<{ devCommand: "npm run dev"; localUrl: "http://127.0.0.1:5173/"; instructions: string[] }> {
    const config = await this.runStore.readConfig(runId);
    const preview = {
      devCommand: "npm run dev" as const,
      localUrl: "http://127.0.0.1:5173/" as const,
      instructions: [
        "在项目根目录运行 npm run dev。",
        `打开 http://127.0.0.1:5173/，在课程包列表中选择「${config.topic}：课程包」。`,
        "这是 deterministic quick preview，用于先看产品形态；正式内容建议走 Codex-authored publish_learning_course。"
      ]
    };
    const runDir = this.runStore.getRunPath(runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify(
        {
          status: "preview_ready",
          runId,
          coursePackId: promoted.coursePackId,
          courseTitle: `${config.topic}：课程包`,
          lessonCount: promoted.childRuns.length,
          coursePackPath: promoted.coursePackPath,
          lessonPaths: promoted.childRuns.map((childRun) => childRun.lessonPath),
          preview
        },
        null,
        2
      ),
      "utf8"
    );
    return preview;
  }
}

function validateAutoApprovalPayload(gate: ApprovalGateId, payload: unknown): string[] {
  if (!isRecord(payload)) {
    return ["artifact payload must be an object"];
  }
  if (gate === "source-map" && !Array.isArray(payload.anchors)) {
    return ["source-map must include anchors"];
  }
  if (gate === "concept-map" && !Array.isArray(payload.concepts)) {
    return ["concept-map must include concepts"];
  }
  if (gate === "curriculum-plan") {
    const coursePack = isRecord(payload.coursePack) ? payload.coursePack : undefined;
    if (!Array.isArray(payload.units) && !Array.isArray(coursePack?.units)) {
      return ["curriculum-plan must include units"];
    }
  }
  if (gate === "learning-architecture" && !Array.isArray(payload.pageSequence)) {
    return ["learning-architecture must include pageSequence"];
  }
  if (gate === "lesson" && !Array.isArray(payload.pages)) {
    return ["lesson must include pages"];
  }
  if (gate === "critic-report" && payload.status !== "passed") {
    const blocking = Array.isArray(payload.blockingFixes) ? JSON.stringify(payload.blockingFixes) : "critic status is not passed";
    return [blocking];
  }
  return [];
}

async function latestArtifactVersion(runPath: string, artifactId: string): Promise<ArtifactVersion> {
  const entries = await readdir(path.join(runPath, "artifacts"));
  const versionPattern = new RegExp(`^${escapeRegex(artifactId)}\\.v(?<version>[1-9][0-9]*)\\.json$`);
  const latest = entries
    .map((entry) => Number(versionPattern.exec(entry)?.groups?.version ?? 0))
    .filter((version) => version > 0)
    .sort((left, right) => right - left)[0];
  if (!latest) {
    throw new AgentRuntimeError(`artifact version not found: ${artifactId}`, "MISSING_ARTIFACT");
  }
  return `v${latest}`;
}

function qualityBlocked(runId: string, blockingIssues: string[], autoApprovedGates: string[]): GenerateQuickPreviewResult {
  return {
    status: "quality_blocked",
    runId,
    userMessage: "自动质量检查发现阻塞问题，需要重新生成或切换 Codex-authored 发布路径。",
    blockingIssues,
    autoApprovedGates
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
