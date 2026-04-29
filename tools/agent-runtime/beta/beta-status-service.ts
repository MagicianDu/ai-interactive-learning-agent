import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { RunStore } from "../run-store.js";
import type { ApprovalGateId, RunConfig } from "../types.js";

type GateArtifactId =
  | "source-map"
  | "concept-map"
  | "curriculum-plan"
  | "learning-architecture"
  | "lesson"
  | "critic-report"
  | "publish-package";

export type BetaArtifactStatus = {
  artifactId: GateArtifactId;
  draftVersion?: string;
  approvedVersion?: string;
  approved: boolean;
};

export type BetaRunGateStatus = {
  currentGate?: ApprovalGateId;
  approvedGates: ApprovalGateId[];
  nextActions: string[];
};

export type BetaChildRunStatus = {
  runId: string;
  unitId?: string;
  title: string;
  currentGate?: ApprovalGateId;
  approvedGates: ApprovalGateId[];
  nextActions: string[];
};

export type BetaRunStatus = {
  status: "beta_status";
  runId: string;
  topic: string;
  sourceKind?: string;
  outputLanguage: string;
  parent: BetaRunGateStatus;
  artifacts: BetaArtifactStatus[];
  childRuns: BetaChildRunStatus[];
};

const gateOrder: ApprovalGateId[] = [
  "source-map",
  "concept-map",
  "curriculum-plan",
  "learning-architecture",
  "lesson",
  "critic-report",
  "publish-package"
];

const gateToArtifact: Record<ApprovalGateId, GateArtifactId> = {
  "source-map": "source-map",
  "concept-map": "concept-map",
  "curriculum-plan": "curriculum-plan",
  "learning-architecture": "learning-architecture",
  lesson: "lesson",
  "critic-report": "critic-report",
  "publish-package": "publish-package"
};

export class BetaStatusService {
  private readonly runStore: RunStore;

  constructor(private readonly workspaceRoot = process.cwd()) {
    this.runStore = new RunStore(workspaceRoot);
  }

  async getStatus(runId: string): Promise<BetaRunStatus> {
    const config = await this.runStore.readConfig(runId);
    const artifacts = await collectArtifactStatuses(this.runStore.getRunPath(runId));
    const artifactById = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
    const childRuns = await this.collectChildRuns(runId);

    return {
      status: "beta_status",
      runId,
      topic: config.topic,
      sourceKind: config.sourceKind,
      outputLanguage: config.outputLanguage,
      parent: summarizeGateStatus(runId, artifactById, "parent"),
      artifacts,
      childRuns
    };
  }

  private async collectChildRuns(parentRunId: string): Promise<BetaChildRunStatus[]> {
    const runIds = await this.runStore.listRunIds();
    const childRuns: BetaChildRunStatus[] = [];

    for (const runId of runIds) {
      let config: RunConfig;
      try {
        config = await this.runStore.readConfig(runId);
      } catch (error) {
        if (error instanceof AgentRuntimeError && error.code === "INVALID_RUN_CONFIG") {
          continue;
        }
        throw error;
      }

      if (config.selectedUnit?.parentRunId !== parentRunId) {
        continue;
      }

      const artifacts = await collectArtifactStatuses(this.runStore.getRunPath(runId));
      const artifactById = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
      const gateStatus = summarizeGateStatus(runId, artifactById, "child");
      childRuns.push({
        runId,
        unitId: config.selectedUnit.id,
        title: config.selectedUnit.title,
        currentGate: gateStatus.currentGate,
        approvedGates: gateStatus.approvedGates,
        nextActions: gateStatus.nextActions
      });
    }

    return childRuns.sort((left, right) => (left.unitId ?? left.runId).localeCompare(right.unitId ?? right.runId));
  }
}

async function collectArtifactStatuses(runPath: string): Promise<BetaArtifactStatus[]> {
  const artifactsPath = path.join(runPath, "artifacts");
  const approvalsPath = path.join(runPath, "approvals");
  const entries = await readDirIfExists(artifactsPath);
  const versionsByArtifact = new Map<GateArtifactId, string[]>();
  const hasDraft = new Set<GateArtifactId>();

  for (const entry of entries) {
    const parsed = /^(?<artifactId>[a-z][a-z0-9-]{0,63})\.(?<suffix>v[1-9][0-9]*|draft|approved)\.json$/u.exec(entry)
      ?.groups;
    const artifactId = parsed?.artifactId;
    const suffix = parsed?.suffix;
    if (!artifactId || !suffix || !isGateArtifactId(artifactId)) {
      continue;
    }

    if (suffix === "draft") {
      hasDraft.add(artifactId);
      continue;
    }
    if (/^v/u.test(suffix)) {
      const versions = versionsByArtifact.get(artifactId) ?? [];
      versions.push(suffix);
      versionsByArtifact.set(artifactId, versions);
    }
  }

  return Promise.all(
    gateOrder.map(async (gate) => {
      const artifactId = gateToArtifact[gate];
      const versions = (versionsByArtifact.get(artifactId) ?? []).sort(compareVersions);
      const approvedVersion = await readApprovedVersion(approvalsPath, gate, artifactId);
      return {
        artifactId,
        ...(hasDraft.has(artifactId) && versions.at(-1) ? { draftVersion: versions.at(-1) } : {}),
        ...(approvedVersion ? { approvedVersion } : {}),
        approved: Boolean(approvedVersion)
      };
    })
  );
}

function summarizeGateStatus(
  runId: string,
  artifactById: Map<GateArtifactId, BetaArtifactStatus>,
  scope: "parent" | "child"
): BetaRunGateStatus {
  const approvedGates = gateOrder.filter((gate) => artifactById.get(gateToArtifact[gate])?.approved);
  const currentGate = gateOrder.find((gate) => {
    const artifact = artifactById.get(gateToArtifact[gate]);
    return Boolean(artifact?.draftVersion && !artifact.approved);
  });

  return {
    ...(currentGate ? { currentGate } : {}),
    approvedGates,
    nextActions: buildNextActions(runId, currentGate, approvedGates, scope)
  };
}

function buildNextActions(
  runId: string,
  currentGate: ApprovalGateId | undefined,
  approvedGates: ApprovalGateId[],
  scope: "parent" | "child"
): string[] {
  if (currentGate) {
    return [
      `Review ${currentGate} for ${runId}, then call approve_gate or revise_gate with the exact artifact version.`
    ];
  }

  if (!approvedGates.includes("source-map")) {
    return [`Run ${scope === "parent" ? "run_until_gate" : "run_course"} for ${runId} to produce source-map or the next child artifact.`];
  }

  if (scope === "parent" && approvedGates.includes("curriculum-plan")) {
    return [`Run learning_agent.run_course for ${runId} to create or advance course units.`];
  }

  if (scope === "child" && approvedGates.includes("critic-report")) {
    return [`Child run ${runId} is ready for promote_units when all selected child runs are approved.`];
  }

  return [`Continue ${scope === "parent" ? "run_until_gate" : "run_course"} for ${runId}.`];
}

async function readApprovedVersion(
  approvalsPath: string,
  gate: ApprovalGateId,
  artifactId: GateArtifactId
): Promise<string | undefined> {
  const record = await readJsonIfExists<{ approvedArtifact?: unknown }>(path.join(approvalsPath, `${gate}.approved.json`));
  if (typeof record?.approvedArtifact !== "string") {
    return undefined;
  }
  const match = new RegExp(`^artifacts/${escapeRegex(artifactId)}\\.(v[1-9][0-9]*)\\.json$`, "u").exec(record.approvedArtifact);
  return match?.[1];
}

async function readDirIfExists(dirPath: string): Promise<string[]> {
  try {
    return await readdir(dirPath);
  } catch (error) {
    if (isFileNotFound(error)) {
      return [];
    }
    throw error;
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (isFileNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

function isGateArtifactId(value: string): value is GateArtifactId {
  return Object.values(gateToArtifact).includes(value as GateArtifactId);
}

function compareVersions(left: string, right: string): number {
  return Number(left.slice(1)) - Number(right.slice(1));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
