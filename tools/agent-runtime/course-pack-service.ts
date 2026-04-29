import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CodexManualAdapter } from "./adapters/codex-manual-adapter.js";
import { MockRuntimeAdapter } from "./adapters/mock-adapter.js";
import { ApprovalService } from "./approval-service.js";
import { ArtifactStore } from "./artifact-store.js";
import type { CourseOutputProduct, LearningUnitKind, LearningUnitPlan, SelectedLearningUnit } from "./corpus-types.js";
import { AgentRuntimeError } from "./errors.js";
import { LessonPromotionService } from "./promotion/lesson-promotion-service.js";
import { RunStore } from "./run-store.js";
import type { RunConfig } from "./types.js";
import { AgentWorkflow, type AgentWorkflowResult } from "./workflow/agent-workflow.js";
import { invalidateDownstreamArtifacts } from "./workflow/downstream-invalidation.js";

type CurriculumPlanLike = {
  coursePack?: {
    id?: string;
    units?: unknown;
  };
  units?: unknown;
};

export type UnitSummary = {
  id: string;
  title: string;
  kind: string;
  targetPageCount: number;
  sourceAnchorIds: string[];
  conceptIds: string[];
};

export type SelectUnitResult = {
  status: "unit_selected";
  runId: string;
  unitId: string;
  targetPageCount: number;
  invalidatedAfter: "curriculum-plan";
};

export type SpawnUnitRunsResult = {
  status: "unit_runs_spawned";
  parentRunId: string;
  childRuns: Array<{
    runId: string;
    unitId: string;
    title: string;
    runPath: string;
  }>;
};

export type RunUnitRunsResult = {
  status: "unit_runs_advanced";
  parentRunId: string;
  childRuns: Array<{
    runId: string;
    unitId: string;
    title: string;
    steps: AgentWorkflowResult[];
    finalStatus: AgentWorkflowResult["status"];
  }>;
};

export type PromoteUnitRunsResult = {
  status: "unit_runs_promoted";
  parentRunId: string;
  coursePackId: string;
  coursePackPath: string;
  childRuns: Array<{
    runId: string;
    unitId: string;
    title: string;
    lessonId: string;
    lessonPath: string;
  }>;
};

export type CourseOrchestrationResult = {
  status: "course_orchestrated";
  parentRunId: string;
  unitSelector: "all" | string;
  units: UnitSummary[];
  spawned: SpawnUnitRunsResult["childRuns"];
  childRuns: Array<{
    runId: string;
    unitId: string;
    title: string;
    finalStatus?: AgentWorkflowResult["status"];
    steps: AgentWorkflowResult[];
  }>;
  promoted?: PromoteUnitRunsResult;
  nextActions: string[];
};

const SEEDED_GATES = ["source-map", "concept-map", "curriculum-plan"] as const;

export class CoursePackService {
  private readonly runStore: RunStore;

  constructor(private readonly workspaceRoot: string = process.cwd()) {
    this.runStore = new RunStore(this.workspaceRoot);
  }

  async listUnits(runId: string): Promise<UnitSummary[]> {
    const { units } = await this.readApprovedCurriculumPlan(runId);
    return units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      kind: unit.kind,
      targetPageCount: unit.targetPageCount,
      sourceAnchorIds: unit.sourceAnchorIds,
      conceptIds: unit.conceptIds
    }));
  }

  async selectUnit(runId: string, unitId: string): Promise<SelectUnitResult> {
    const config = await this.runStore.readConfig(runId);
    const runPath = this.runStore.getRunPath(runId);
    const { coursePackId, units } = await this.readApprovedCurriculumPlan(runId);
    const unit = findUnit(units, unitId);
    const selectedUnit = toSelectedLearningUnit(unit, runId, coursePackId);
    const nextConfig = applySelectedUnit(config, selectedUnit);

    await this.runStore.writeConfig(nextConfig);
    await invalidateDownstreamArtifacts(runPath, "curriculum-plan");

    return {
      status: "unit_selected",
      runId,
      unitId: unit.id,
      targetPageCount: unit.targetPageCount,
      invalidatedAfter: "curriculum-plan"
    };
  }

  async spawnUnitRuns(runId: string, unitSelector: "all" | string): Promise<SpawnUnitRunsResult> {
    const parentConfig = await this.runStore.readConfig(runId);
    const parentRunPath = this.runStore.getRunPath(runId);
    const { coursePackId, units } = await this.readApprovedCurriculumPlan(runId);
    const selectedUnits = unitSelector === "all" ? units : [findUnit(units, unitSelector)];
    const childRuns: SpawnUnitRunsResult["childRuns"] = [];

    for (const unit of selectedUnits) {
      const selectedUnit = toSelectedLearningUnit(unit, runId, coursePackId);
      const childConfig = applySelectedUnit(
        {
          ...parentConfig,
          runId: buildChildRunId(parentConfig.runId, unit.id),
          topic: unit.title,
          approvalGates: [...parentConfig.approvalGates],
          userLearningProfile: { ...parentConfig.userLearningProfile },
          pageCount: { ...parentConfig.pageCount },
          models: {
            ...parentConfig.models,
            roleModels: parentConfig.models.roleModels ? { ...parentConfig.models.roleModels } : undefined
          },
          runtime: { ...parentConfig.runtime },
          coveragePolicy: {
            ...parentConfig.coveragePolicy,
            omissionRules: [...parentConfig.coveragePolicy.omissionRules]
          },
          coursePack: parentConfig.coursePack
            ? {
                ...parentConfig.coursePack,
                selectedChapters: parentConfig.coursePack.selectedChapters
                  ? [...parentConfig.coursePack.selectedChapters]
                  : undefined,
                selectedTopics: parentConfig.coursePack.selectedTopics ? [...parentConfig.coursePack.selectedTopics] : undefined,
                outputProducts: [...parentConfig.coursePack.outputProducts]
              }
            : undefined,
          sources: parentConfig.sources.map((source) => ({ ...source, metadata: source.metadata ? { ...source.metadata } : undefined }))
        },
        selectedUnit
      );
      const childRunPath = await this.runStore.createRun(childConfig);
      await seedApprovedCorpusArtifacts(parentRunPath, childRunPath, childConfig.runId);
      childRuns.push({
        runId: childConfig.runId,
        unitId: unit.id,
        title: unit.title,
        runPath: childRunPath
      });
    }

    return {
      status: "unit_runs_spawned",
      parentRunId: runId,
      childRuns
    };
  }

  async runUnitRuns(runId: string, unitSelector: "all" | string, maxSteps = 20): Promise<RunUnitRunsResult> {
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 100) {
      throw new AgentRuntimeError("maxSteps must be an integer between 1 and 100", "INVALID_RUN_CONFIG");
    }

    const childConfigs = await this.findChildUnitRunConfigs(runId, unitSelector);
    if (childConfigs.length === 0) {
      throw new AgentRuntimeError(`no child unit runs found for parent run: ${runId}`, "MISSING_RUN");
    }

    const childRuns: RunUnitRunsResult["childRuns"] = [];
    for (const config of childConfigs) {
      const workflow = await this.createWorkflow(config.runId);
      const steps: AgentWorkflowResult[] = [];

      for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
        const result = await workflow.runNext(config.runId);
        steps.push(result);
        if (result.status !== "artifact_written") {
          break;
        }
      }

      const finalStatus = steps.at(-1)?.status ?? "complete";
      childRuns.push({
        runId: config.runId,
        unitId: config.selectedUnit?.id ?? "",
        title: config.selectedUnit?.title ?? config.topic,
        steps,
        finalStatus
      });
    }

    return {
      status: "unit_runs_advanced",
      parentRunId: runId,
      childRuns
    };
  }

  async promoteUnitRuns(runId: string, unitSelector: "all" | string): Promise<PromoteUnitRunsResult> {
    const parentConfig = await this.runStore.readConfig(runId);
    const childConfigs = await this.findChildUnitRunConfigs(runId, unitSelector);
    if (childConfigs.length === 0) {
      throw new AgentRuntimeError(`no child unit runs found for parent run: ${runId}`, "MISSING_RUN");
    }

    const lessonPromotion = new LessonPromotionService(this.workspaceRoot);
    const promotedChildRuns: PromoteUnitRunsResult["childRuns"] = [];
    for (const config of childConfigs) {
      if (!config.selectedUnit) {
        throw new AgentRuntimeError(`child run has no selectedUnit: ${config.runId}`, "INVALID_RUN_CONFIG");
      }
      const result = await lessonPromotion.promote(config.runId);
      promotedChildRuns.push({
        runId: config.runId,
        unitId: config.selectedUnit.id,
        title: config.selectedUnit.title,
        lessonId: result.lessonId,
        lessonPath: result.lessonPath
      });
    }

    const coursePackId = runId;
    const coursePackPath = await this.writeCoursePackManifest(parentConfig, promotedChildRuns);
    return {
      status: "unit_runs_promoted",
      parentRunId: runId,
      coursePackId,
      coursePackPath,
      childRuns: promotedChildRuns
    };
  }

  async orchestrateCourse({
    runId,
    unitSelector,
    maxSteps = 20,
    promote = false
  }: {
    runId: string;
    unitSelector: "all" | string;
    maxSteps?: number;
    promote?: boolean;
  }): Promise<CourseOrchestrationResult> {
    const units = await this.listUnits(runId);
    const spawned = await this.ensureUnitRuns(runId, unitSelector);
    const advanced = await this.runUnitRuns(runId, unitSelector, maxSteps);
    const promoted = promote ? await this.promoteUnitRuns(runId, unitSelector) : undefined;

    return {
      status: "course_orchestrated",
      parentRunId: runId,
      unitSelector,
      units,
      spawned,
      childRuns: advanced.childRuns.map((childRun) => ({
        runId: childRun.runId,
        unitId: childRun.unitId,
        title: childRun.title,
        finalStatus: childRun.finalStatus,
        steps: childRun.steps
      })),
      promoted,
      nextActions: buildNextActions(runId, advanced, promote)
    };
  }

  private async ensureUnitRuns(runId: string, unitSelector: "all" | string): Promise<SpawnUnitRunsResult["childRuns"]> {
    const { units } = await this.readApprovedCurriculumPlan(runId);
    const selectedUnits = unitSelector === "all" ? units : [findUnit(units, unitSelector)];
    const existingConfigs = await this.findChildUnitRunConfigs(runId, "all");
    const existingUnitIds = new Set(existingConfigs.map((config) => config.selectedUnit?.id).filter(Boolean));
    const spawned: SpawnUnitRunsResult["childRuns"] = [];

    for (const unit of selectedUnits) {
      if (existingUnitIds.has(unit.id)) {
        continue;
      }
      const result = await this.spawnUnitRuns(runId, unit.id);
      spawned.push(...result.childRuns);
    }

    return spawned;
  }

  private async findChildUnitRunConfigs(runId: string, unitSelector: "all" | string): Promise<RunConfig[]> {
    const runIds = await this.runStore.listRunIds();
    const configs: RunConfig[] = [];
    for (const candidateRunId of runIds) {
      let config: RunConfig;
      try {
        config = await this.runStore.readConfig(candidateRunId);
      } catch (error) {
        if (error instanceof AgentRuntimeError && error.code === "INVALID_RUN_CONFIG") {
          continue;
        }
        throw error;
      }
      if (config.selectedUnit?.parentRunId !== runId) {
        continue;
      }
      if (unitSelector !== "all" && config.selectedUnit.id !== unitSelector) {
        continue;
      }
      configs.push(config);
    }

    return configs.sort((left, right) => {
      const leftUnit = left.selectedUnit?.id ?? left.runId;
      const rightUnit = right.selectedUnit?.id ?? right.runId;
      return leftUnit.localeCompare(rightUnit);
    });
  }

  private async createWorkflow(runId: string): Promise<AgentWorkflow> {
    const runPath = this.runStore.getRunPath(runId);
    const artifactStore = new ArtifactStore(runPath);
    const approvalService = new ApprovalService(runPath, artifactStore);
    const config = await this.runStore.readConfig(runId);
    const adapter = config.runtime.adapter === "codex-manual" ? new CodexManualAdapter() : new MockRuntimeAdapter();
    return new AgentWorkflow(this.runStore, artifactStore, approvalService, adapter);
  }

  private async writeCoursePackManifest(
    parentConfig: RunConfig,
    promotedRuns: PromoteUnitRunsResult["childRuns"]
  ): Promise<string> {
    const coursePacksRoot = path.join(this.workspaceRoot, "src", "course-packs");
    const coursePackDir = assertSafeChildPath(coursePacksRoot, parentConfig.runId);
    await mkdir(coursePackDir, { recursive: true });
    const coursePackPath = path.join(coursePackDir, "coursePack.ts");
    const units = promotedRuns.map((promotedRun) => {
      const childRunId = promotedRun.runId;
      return {
        promotedRun,
        configPromise: this.runStore.readConfig(childRunId)
      };
    });
    const unitConfigs = await Promise.all(
      units.map(async ({ promotedRun, configPromise }) => ({
        promotedRun,
        config: await configPromise
      }))
    );
    const manifest = {
      id: parentConfig.runId,
      title: `${parentConfig.topic}：课程包`,
      parentRunId: parentConfig.runId,
      sourceKind: parentConfig.sourceKind,
      strategy: parentConfig.coursePack?.strategy,
      units: unitConfigs.map(({ promotedRun, config }) => {
        const unit = config.selectedUnit;
        if (!unit) {
          throw new AgentRuntimeError(`child run has no selectedUnit: ${config.runId}`, "INVALID_RUN_CONFIG");
        }
        return compactObject({
          unitId: unit.id,
          title: unit.title,
          kind: unit.kind,
          lessonId: promotedRun.lessonId,
          targetPageCount: unit.targetPageCount,
          sourceAnchorIds: unit.sourceAnchorIds,
          sourceNodeIds: unit.sourceNodeIds,
          chapterRefs: unit.chapterRefs,
          conceptIds: unit.conceptIds
        });
      })
    };
    await writeFile(coursePackPath, renderCoursePackSource(manifest), "utf8");
    return coursePackPath;
  }

  private async readApprovedCurriculumPlan(runId: string): Promise<{ coursePackId?: string; units: LearningUnitPlan[] }> {
    const runPath = this.runStore.getRunPath(runId);
    const rawPlan = await readJsonFile<CurriculumPlanLike>(path.join(runPath, "artifacts", "curriculum-plan.approved.json"));
    const rawUnits = rawPlan.coursePack?.units ?? rawPlan.units;
    if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
      throw new AgentRuntimeError("approved curriculum-plan has no units", "INVALID_RUN_CONFIG");
    }
    const units = rawUnits.map(validateLearningUnit);
    return {
      coursePackId: rawPlan.coursePack?.id,
      units
    };
  }
}

function applySelectedUnit(config: RunConfig, selectedUnit: SelectedLearningUnit): RunConfig {
  const target = selectedUnit.targetPageCount;
  return {
    ...config,
    topic: selectedUnit.title,
    selectedUnit,
    userLearningProfile: {
      ...config.userLearningProfile,
      preferredPageCountPerUnit: target
    },
    pageCount: {
      target,
      min: Math.max(1, target - 2),
      max: Math.min(40, target + 2)
    },
    coursePack: config.coursePack
      ? {
          ...config.coursePack,
          unitPageCount: target,
          selectedChapters: selectedUnit.chapterRefs,
          selectedTopics: selectedUnit.kind === "topic" ? [selectedUnit.title] : config.coursePack.selectedTopics,
          outputProducts: [...config.coursePack.outputProducts]
        }
      : undefined
  };
}

async function seedApprovedCorpusArtifacts(parentRunPath: string, childRunPath: string, childRunId: string): Promise<void> {
  const childArtifacts = new ArtifactStore(childRunPath);
  const childApprovals = new ApprovalService(childRunPath, childArtifacts);

  for (const gate of SEEDED_GATES) {
    const payload = await readJsonFile(path.join(parentRunPath, "artifacts", `${gate}.approved.json`));
    await childArtifacts.writeDraft(gate, payload);
    await childApprovals.approve({
      gate,
      runId: childRunId,
      artifactId: gate,
      version: "v1",
      decision: "approved",
      operatorNotes: `Seeded from parent run ${path.basename(parentRunPath)} for unit generation.`
    });
  }
}

function findUnit(units: LearningUnitPlan[], unitId: string): LearningUnitPlan {
  const unit = units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    throw new AgentRuntimeError(`unit not found in approved curriculum-plan: ${unitId}`, "INVALID_RUN_CONFIG");
  }
  return unit;
}

function toSelectedLearningUnit(unit: LearningUnitPlan, parentRunId: string, parentCoursePackId?: string): SelectedLearningUnit {
  return {
    ...unit,
    sourceAnchorIds: [...unit.sourceAnchorIds],
    sourceNodeIds: unit.sourceNodeIds ? [...unit.sourceNodeIds] : undefined,
    chapterRefs: unit.chapterRefs ? [...unit.chapterRefs] : undefined,
    conceptIds: [...unit.conceptIds],
    outputProducts: [...unit.outputProducts],
    parentRunId,
    parentCoursePackId
  };
}

function buildNextActions(runId: string, advanced: RunUnitRunsResult, promote: boolean): string[] {
  const actions = new Set<string>();

  for (const childRun of advanced.childRuns) {
    const lastStep = childRun.steps.at(-1);
    if (!lastStep) {
      actions.add(`Run npm run agent:run-units -- --run ${runId} --unit ${childRun.unitId}`);
      continue;
    }
    if (lastStep.status === "manual_action_required") {
      actions.add(`Complete manual request for ${childRun.runId}: ${lastStep.promptPath}`);
      actions.add(`Submit the artifact with npm run agent:submit -- --run ${childRun.runId} --artifact ${lastStep.artifactId} --file <json-file>`);
      continue;
    }
    if (lastStep.status === "approval_required") {
      actions.add(`Review and approve/revise ${lastStep.requiredGate} for child runs that reached an approval gate.`);
      continue;
    }
    if (lastStep.status === "complete" && !promote) {
      actions.add(`If child lessons are approved, run npm run agent:promote-units -- --run ${runId} --all true`);
    }
  }

  if (actions.size === 0) {
    actions.add(`Inspect child run status with npm run agent:run-units -- --run ${runId} --all true`);
  }

  return Array.from(actions);
}

function validateLearningUnit(unit: unknown): LearningUnitPlan {
  if (!isRecord(unit)) {
    throw new AgentRuntimeError("curriculum-plan unit must be an object", "INVALID_RUN_CONFIG");
  }
  if (!isNonEmptyString(unit.id) || !isNonEmptyString(unit.title) || !isNonEmptyString(unit.purpose)) {
    throw new AgentRuntimeError("curriculum-plan unit is missing required strings", "INVALID_RUN_CONFIG");
  }
  const unitKind = normalizeUnitKind(unit.kind, unit.title);
  if (!["overview", "chapter", "topic", "task", "hybrid"].includes(unitKind)) {
    throw new AgentRuntimeError("curriculum-plan unit.kind is invalid", "INVALID_RUN_CONFIG");
  }
  if (
    typeof unit.targetPageCount !== "number" ||
    !Number.isInteger(unit.targetPageCount) ||
    unit.targetPageCount < 1 ||
    unit.targetPageCount > 40
  ) {
    throw new AgentRuntimeError("curriculum-plan unit.targetPageCount must be an integer between 1 and 40", "INVALID_RUN_CONFIG");
  }
  if (!isStringArray(unit.sourceAnchorIds)) {
    throw new AgentRuntimeError("curriculum-plan unit.sourceAnchorIds must be strings", "INVALID_RUN_CONFIG");
  }
  if (unit.sourceNodeIds !== undefined && !isStringArray(unit.sourceNodeIds)) {
    throw new AgentRuntimeError("curriculum-plan unit.sourceNodeIds must be strings", "INVALID_RUN_CONFIG");
  }
  if (unit.chapterRefs !== undefined && !isStringArray(unit.chapterRefs)) {
    throw new AgentRuntimeError("curriculum-plan unit.chapterRefs must be strings", "INVALID_RUN_CONFIG");
  }
  if (!isStringArray(unit.conceptIds)) {
    throw new AgentRuntimeError("curriculum-plan unit.conceptIds must be strings", "INVALID_RUN_CONFIG");
  }
  const outputProducts = normalizeOutputProducts(unit.outputProducts);

  return {
    id: unit.id,
    title: unit.title,
    kind: unitKind,
    purpose: unit.purpose,
    targetPageCount: unit.targetPageCount,
    sourceAnchorIds: unit.sourceAnchorIds,
    sourceNodeIds: unit.sourceNodeIds,
    chapterRefs: unit.chapterRefs,
    conceptIds: unit.conceptIds,
    outputProducts
  } as LearningUnitPlan;
}

function normalizeUnitKind(kind: unknown, title: string): LearningUnitKind {
  if (typeof kind === "string" && ["overview", "chapter", "topic", "task", "hybrid"].includes(kind)) {
    return kind as LearningUnitKind;
  }
  return /overview|总览|导读/u.test(title.toLowerCase()) ? "overview" : "topic";
}

function normalizeOutputProducts(value: unknown): CourseOutputProduct[] {
  if (!Array.isArray(value)) {
    throw new AgentRuntimeError("curriculum-plan unit.outputProducts must be an array", "INVALID_RUN_CONFIG");
  }

  return value.map((product) => {
    if (product === "web_deck") {
      return "web_lesson";
    }
    if (["web_lesson", "whiteboard_map", "playground", "assessment", "teacher_notes"].includes(String(product))) {
      return product as CourseOutputProduct;
    }
    throw new AgentRuntimeError("curriculum-plan unit.outputProducts contains unsupported products", "INVALID_RUN_CONFIG");
  });
}

function buildChildRunId(parentRunId: string, unitId: string): string {
  const normalizedUnitId = unitId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = normalizedUnitId || shortHash(unitId);
  const prefix = `${parentRunId}-${suffix}`.slice(0, 63).replace(/-+$/g, "");
  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(prefix) ? prefix : `unit-${shortHash(`${parentRunId}-${unitId}`)}`;
}

function renderCoursePackSource(coursePack: Record<string, unknown>): string {
  return [
    'import type { CoursePack } from "../../schemas/course-pack.schema";',
    "",
    `export const generatedCoursePack = ${toTypeScriptLiteral(coursePack)} satisfies CoursePack;`,
    ""
  ].join("\n");
}

function assertSafeChildPath(parentPath: string, childSegment: string): string {
  const resolvedParent = path.resolve(parentPath);
  const resolvedChild = path.resolve(resolvedParent, childSegment);
  const relativePath = path.relative(resolvedParent, resolvedChild);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new AgentRuntimeError("course pack id resolves outside src/course-packs", "INVALID_RUN_CONFIG");
  }

  return resolvedChild;
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function toTypeScriptLiteral(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    return `[\n${indent(value.map((item) => toTypeScriptLiteral(item)).join(",\n"))}\n]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }
    return `{\n${indent(entries.map(([key, item]) => `${formatPropertyKey(key)}: ${toTypeScriptLiteral(item)}`).join(",\n"))}\n}`;
  }
  return JSON.stringify(value);
}

function formatPropertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function indent(value: string): string {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (isFileNotFound(error)) {
      throw new AgentRuntimeError(`required approved artifact not found: ${filePath}`, "MISSING_ARTIFACT");
    }
    throw error;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}
