import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  AgentWorkflow,
  ApprovalService,
  ArtifactStore,
  AuthoringQualityComparisonService,
  AuthoringContextService,
  BetaStatusService,
  CalibrationService,
  CodexManualAdapter,
  ContentReviewService,
  CourseProductionPipelineService,
  CoursePackService,
  createRunConfigFromArgs,
  ImagegenAssetBatchService,
  ImagegenBatchStateService,
  LessonPromotionService,
  LearningCoursePublisher,
  GroundedCourseService,
  LearningPreviewService,
  LearningRevisionService,
  LearnerProjectService,
  ManualSubmissionService,
  MockRuntimeAdapter,
  OneShotLearningCourseService,
  PrepareLearningCourseService,
  QuickPreviewService,
  RunPlanService,
  RunStore
} from "../agent-runtime/index.js";
import type { ArtifactVersion } from "../agent-runtime/artifact-store.js";
import type { ContentReviewIssue, ContentReviewVerdict } from "../agent-runtime/index.js";
import { courseIntentValues, normalizeCourseIntent, type CourseIntent } from "../agent-runtime/learner/course-intent.js";
import { ProjectRegistry } from "../agent-runtime/learner/project-registry.js";
import { TargetedRevisionService } from "../agent-runtime/learner/targeted-revision-service.js";
import { ExportBundleService } from "../agent-runtime/learner/export-bundle-service.js";
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
      case "learning_agent.run_one_shot_learning_course":
        return this.runOneShotLearningCourse(input);
      case "learning_agent.prepare_learning_course":
        return this.prepareLearningCourse(input);
      case "learning_agent.start_course_production":
        return this.startCourseProduction(input);
      case "learning_agent.next_course_production_action":
        return this.nextCourseProductionAction(input);
      case "learning_agent.record_course_production_event":
        return this.recordCourseProductionEvent(input);
      case "learning_agent.list_learning_projects":
        return this.listLearningProjects(input);
      case "learning_agent.archive_learning_project":
        return this.archiveLearningProject(input);
      case "learning_agent.get_authoring_context":
        return this.getAuthoringContext(input);
      case "learning_agent.generate_grounded_course":
        return this.generateGroundedCourse(input);
      case "learning_agent.publish_learning_course":
        return this.publishLearningCourse(input);
      case "learning_agent.calibrate_learning_course":
        return this.calibrateLearningCourse(input);
      case "learning_agent.prepare_content_review":
        return this.prepareContentReview(input);
      case "learning_agent.record_content_review_report":
        return this.recordContentReviewReport(input);
      case "learning_agent.create_imagegen_manifest":
        return this.createImagegenManifest(input);
      case "learning_agent.record_imagegen_asset":
        return this.recordImagegenAsset(input);
      case "learning_agent.validate_imagegen_assets":
        return this.validateImagegenAssets(input);
      case "learning_agent.start_imagegen_batch":
        return this.startImagegenBatch(input);
      case "learning_agent.record_imagegen_batch_item":
        return this.recordImagegenBatchItem(input);
      case "learning_agent.compare_authoring_quality":
        return this.compareAuthoringQuality(input);
      case "learning_agent.create_quality_revision":
        return this.createQualityRevision(input);
      case "learning_agent.get_learning_preview":
        return this.getLearningPreview(input);
      case "learning_agent.generate_quick_preview":
        return this.generateQuickPreview(input);
      case "learning_agent.revise_learning_course":
        return this.reviseLearningCourse(input);
      case "learning_agent.apply_learning_revision":
        return this.applyLearningRevision(input);
      case "learning_agent.export_learning_course":
        return this.exportLearningCourse(input);
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
      difficultyLevel: optionalDifficultyLevel(options.difficultyLevel),
      courseIntent: optionalCourseIntent(options.courseIntent),
      unitPages: optionalNumber(options.unitPages),
      targetTotalPages: optionalNumber(options.targetTotalPages),
      strategy: optionalString(options.strategy),
      selectedChapters: optionalStringArray(options.selectedChapters),
      selectedTopics: optionalStringArray(options.selectedTopics)
    });
  }

  private async prepareLearningCourse(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new PrepareLearningCourseService(this.workspaceRoot).prepare({
      request: requiredString(options, "request"),
      runId: optionalString(options.runId),
      sourcePath: optionalString(options.sourcePath),
      sourceKind: optionalString(options.sourceKind),
      audience: optionalString(options.audience),
      difficultyLevel: optionalDifficultyLevel(options.difficultyLevel),
      courseIntent: optionalCourseIntent(options.courseIntent),
      unitPages: optionalNumber(options.unitPages),
      targetTotalPages: optionalNumber(options.targetTotalPages),
      strategy: optionalString(options.strategy),
      selectedChapters: optionalStringArray(options.selectedChapters),
      selectedTopics: optionalStringArray(options.selectedTopics),
      maxAnchors: optionalNumber(options.maxAnchors)
    });
  }

  private async runOneShotLearningCourse(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new OneShotLearningCourseService(this.workspaceRoot).run({
      request: requiredString(options, "request"),
      runId: optionalString(options.runId),
      sourcePath: optionalString(options.sourcePath),
      sourceKind: optionalString(options.sourceKind),
      audience: optionalString(options.audience),
      difficultyLevel: optionalDifficultyLevel(options.difficultyLevel),
      courseIntent: optionalCourseIntent(options.courseIntent),
      unitPages: optionalNumber(options.unitPages),
      targetTotalPages: optionalNumber(options.targetTotalPages),
      strategy: optionalString(options.strategy),
      selectedChapters: optionalStringArray(options.selectedChapters),
      selectedTopics: optionalStringArray(options.selectedTopics),
      maxAnchors: optionalNumber(options.maxAnchors)
    });
  }

  private async startCourseProduction(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new CourseProductionPipelineService(this.workspaceRoot).start({
      runId: requiredString(options, "runId"),
      sourceKind: requiredSourceKind(options),
      learnerRequest: requiredString(options, "learnerRequest"),
      targetMode: requiredTargetMode(options),
      defaults: requiredCourseProductionDefaults(options)
    });
  }

  private async nextCourseProductionAction(input: unknown): Promise<unknown> {
    return new CourseProductionPipelineService(this.workspaceRoot).nextAction({
      runId: requiredString(expectRecord(input), "runId")
    });
  }

  private async recordCourseProductionEvent(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new CourseProductionPipelineService(this.workspaceRoot).recordEvent({
      runId: requiredString(options, "runId"),
      eventKind: requiredString(options, "eventKind"),
      summary: requiredString(options, "summary"),
      artifactPaths: requiredStringArray(options, "artifactPaths")
    });
  }

  private async listLearningProjects(input: unknown): Promise<unknown> {
    expectRecord(input);
    return {
      status: "projects_ready",
      projects: await new ProjectRegistry(this.workspaceRoot).listProjects()
    };
  }

  private async archiveLearningProject(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    const runId = requiredString(options, "runId");
    return {
      status: "project_archived",
      runId,
      project: await new ProjectRegistry(this.workspaceRoot).archiveProject(runId)
    };
  }

  private async getAuthoringContext(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new AuthoringContextService(this.workspaceRoot).getContext({
      runId: requiredString(options, "runId"),
      maxAnchors: optionalNumber(options.maxAnchors)
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
      publishNotes: optionalString(options.publishNotes),
      outputMode: optionalOutputMode(options.outputMode)
    });
  }

  private async calibrateLearningCourse(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new CalibrationService(this.workspaceRoot).calibrate({
      runId: requiredString(options, "runId"),
      maxRounds: optionalNumber(options.maxRounds),
      minScore: optionalNumber(options.minScore),
      failOnWarnings: optionalBoolean(options.failOnWarnings),
      focus: optionalCalibrationFocus(options.focus)
    });
  }

  private async prepareContentReview(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new ContentReviewService(this.workspaceRoot).prepareReview({
      runId: requiredString(options, "runId"),
      maxRounds: optionalNumber(options.maxRounds),
      minScore: optionalNumber(options.minScore)
    });
  }

  private async recordContentReviewReport(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new ContentReviewService(this.workspaceRoot).recordReviewReport({
      runId: requiredString(options, "runId"),
      round: requiredNumber(options, "round"),
      reviewerVerdict: optionalReviewVerdict(options.reviewerVerdict),
      summary: requiredString(options, "summary"),
      issues: requiredReviewIssues(options, "issues")
    });
  }

  private async createImagegenManifest(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new ImagegenAssetBatchService(this.workspaceRoot).createManifest({
      runId: requiredString(options, "runId")
    });
  }

  private async recordImagegenAsset(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new ImagegenAssetBatchService(this.workspaceRoot).recordAsset({
      runId: requiredString(options, "runId"),
      lessonId: requiredString(options, "lessonId"),
      pageId: requiredString(options, "pageId"),
      sourceImagePath: requiredString(options, "sourceImagePath"),
      generator: optionalString(options.generator) as "imagegen" | "placeholder" | "imported" | "unknown" | undefined,
      recordedBy: optionalString(options.recordedBy)
    });
  }

  private async validateImagegenAssets(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new ImagegenAssetBatchService(this.workspaceRoot).validateAssets({
      runId: requiredString(options, "runId")
    });
  }

  private async startImagegenBatch(input: unknown): Promise<unknown> {
    return new ImagegenBatchStateService(this.workspaceRoot).start({
      runId: requiredString(expectRecord(input), "runId")
    });
  }

  private async recordImagegenBatchItem(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    const status = requiredString(options, "status");
    if (status === "succeeded") {
      return new ImagegenBatchStateService(this.workspaceRoot).recordItem({
        runId: requiredString(options, "runId"),
        lessonId: requiredString(options, "lessonId"),
        pageId: requiredString(options, "pageId"),
        status,
        sourceImagePath: requiredString(options, "sourceImagePath"),
        generator: optionalString(options.generator) as "imagegen" | "placeholder" | "imported" | "unknown" | undefined,
        recordedBy: optionalString(options.recordedBy)
      });
    }
    if (status === "failed") {
      return new ImagegenBatchStateService(this.workspaceRoot).recordItem({
        runId: requiredString(options, "runId"),
        lessonId: requiredString(options, "lessonId"),
        pageId: requiredString(options, "pageId"),
        status,
        failureReason: requiredString(options, "failureReason")
      });
    }
    throw new Error("status must be succeeded or failed");
  }

  private async compareAuthoringQuality(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new AuthoringQualityComparisonService(this.workspaceRoot).compare({
      authoredRunId: requiredString(options, "authoredRunId"),
      draftRunId: requiredString(options, "draftRunId")
    });
  }

  private async createQualityRevision(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new LearningRevisionService(this.workspaceRoot).requestQualityRevision({
      runId: requiredString(options, "runId"),
      comparisonReportPath: optionalString(options.comparisonReportPath)
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

  private async applyLearningRevision(input: unknown): Promise<unknown> {
    return new TargetedRevisionService(this.workspaceRoot).applyLatestRevision({
      runId: requiredString(expectRecord(input), "runId")
    });
  }

  private async exportLearningCourse(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    return new ExportBundleService(this.workspaceRoot).exportRun({
      runId: requiredString(options, "runId"),
      expertOverrideReason: optionalString(options.expertOverrideReason)
    });
  }

  private async initRun(input: unknown): Promise<unknown> {
    const options = expectRecord(input);
    const config = createRunConfigFromArgs({
      topic: optionalString(options.topic),
      pages: optionalString(options.pages),
      unitPages: optionalString(options.unitPages),
      targetTotalPages: optionalString(options.targetTotalPages),
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
    "learning_agent.run_one_shot_learning_course",
    "learning_agent.prepare_learning_course",
    "learning_agent.start_course_production",
    "learning_agent.next_course_production_action",
    "learning_agent.record_course_production_event",
    "learning_agent.list_learning_projects",
    "learning_agent.archive_learning_project",
    "learning_agent.get_authoring_context",
    "learning_agent.generate_grounded_course",
    "learning_agent.publish_learning_course",
    "learning_agent.calibrate_learning_course",
    "learning_agent.prepare_content_review",
    "learning_agent.record_content_review_report",
    "learning_agent.create_imagegen_manifest",
    "learning_agent.record_imagegen_asset",
    "learning_agent.validate_imagegen_assets",
    "learning_agent.start_imagegen_batch",
    "learning_agent.record_imagegen_batch_item",
    "learning_agent.compare_authoring_quality",
    "learning_agent.create_quality_revision",
    "learning_agent.get_learning_preview",
    "learning_agent.generate_quick_preview",
    "learning_agent.revise_learning_course",
    "learning_agent.apply_learning_revision",
    "learning_agent.export_learning_course",
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

function requiredStringArray(input: Record<string, unknown>, key: string): string[] {
  const value = requiredArray(input, key);
  if (!value.every((item): item is string => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`${key} must be an array of non-empty strings`);
  }
  return value.map((item) => item.trim());
}

function requiredNumber(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (typeof value !== "number") {
    throw new Error(`${key} must be a number`);
  }
  return value;
}

function requiredSourceKind(input: Record<string, unknown>): "book" | "paper" | "patent" | "blog" | "notes" | "topic" {
  const value = requiredString(input, "sourceKind");
  if (value === "book" || value === "paper" || value === "patent" || value === "blog" || value === "notes" || value === "topic") {
    return value;
  }
  throw new Error("sourceKind must be book, paper, patent, blog, notes, or topic");
}

function requiredTargetMode(input: Record<string, unknown>): "student_self_study_textbook" | "professor_web_deck" {
  const value = requiredString(input, "targetMode");
  if (value === "student_self_study_textbook" || value === "professor_web_deck") {
    return value;
  }
  throw new Error("targetMode must be student_self_study_textbook or professor_web_deck");
}

function requiredCourseProductionDefaults(input: Record<string, unknown>): {
  difficulty: "beginner" | "undergraduate" | "graduate" | "expert";
  strategy: "overview_plus_topic" | "chapter_guided" | "topic_guided";
  overviewPages: number;
  topicPages: number;
  topicCount: number;
  reviewRounds: number;
  minQualityScore: number;
} {
  const defaults = expectRecord(input.defaults);
  return {
    difficulty: requiredProductionDifficulty(defaults),
    strategy: requiredProductionStrategy(defaults),
    overviewPages: requiredNumber(defaults, "overviewPages"),
    topicPages: requiredNumber(defaults, "topicPages"),
    topicCount: requiredNumber(defaults, "topicCount"),
    reviewRounds: requiredNumber(defaults, "reviewRounds"),
    minQualityScore: requiredNumber(defaults, "minQualityScore")
  };
}

function requiredProductionDifficulty(input: Record<string, unknown>): "beginner" | "undergraduate" | "graduate" | "expert" {
  const value = requiredString(input, "difficulty");
  if (value === "beginner" || value === "undergraduate" || value === "graduate" || value === "expert") {
    return value;
  }
  throw new Error("difficulty must be beginner, undergraduate, graduate, or expert");
}

function requiredProductionStrategy(input: Record<string, unknown>): "overview_plus_topic" | "chapter_guided" | "topic_guided" {
  const value = requiredString(input, "strategy");
  if (value === "overview_plus_topic" || value === "chapter_guided" || value === "topic_guided") {
    return value;
  }
  throw new Error("strategy must be overview_plus_topic, chapter_guided, or topic_guided");
}

function requiredReviewIssues(input: Record<string, unknown>, key: string): ContentReviewIssue[] {
  return requiredArray(input, key) as ContentReviewIssue[];
}

function optionalReviewVerdict(value: unknown): ContentReviewVerdict | undefined {
  const verdict = optionalString(value);
  return verdict ? (verdict as ContentReviewVerdict) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalDifficultyLevel(value: unknown): "introductory" | "undergraduate_core" | "upper_undergraduate_or_graduate" | "research" | undefined {
  const normalized = optionalString(value);
  if (
    normalized === "introductory" ||
    normalized === "undergraduate_core" ||
    normalized === "upper_undergraduate_or_graduate" ||
    normalized === "research"
  ) {
    return normalized;
  }
  return undefined;
}

function optionalCourseIntent(value: unknown): CourseIntent | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = normalizeCourseIntent(value);
  if (normalized) {
    return normalized;
  }
  throw new Error(`courseIntent must be ${courseIntentValues.join(" or ")}`);
}

function optionalOutputMode(value: unknown): "preview" | "source" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "preview" || value === "source") {
    return value;
  }
  throw new Error("outputMode must be preview or source");
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function optionalCalibrationFocus(value: unknown): Array<"structure" | "source" | "learner"> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter((item): item is "structure" | "source" | "learner" =>
    item === "structure" || item === "source" || item === "learner"
  );
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
