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
  draftPath?: string;
  approvedVersion?: string;
  approvedPath?: string;
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

export type BetaToolCallHint = {
  toolName: string;
  input: Record<string, string | number | boolean>;
  reason: string;
};

export type BetaReviewItem = {
  runId: string;
  scope: "parent" | "child";
  gate: ApprovalGateId;
  artifactId: GateArtifactId;
  version: string;
  artifactPath: string;
  readArtifact: BetaToolCallHint;
  approveGate: BetaToolCallHint;
  reviseGate: BetaToolCallHint;
};

export type BetaOperatorHints = {
  reviewQueue: BetaReviewItem[];
  nextToolCalls: BetaToolCallHint[];
  readyToPromote: boolean;
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
  operatorHints: BetaOperatorHints;
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
    const artifacts = await collectArtifactStatuses(this.runStore.getRunPath(runId), this.workspaceRoot);
    const artifactById = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
    const parent = summarizeGateStatus(runId, artifactById, "parent");
    const childCollection = await this.collectChildRuns(runId);
    const reviewQueue = [
      buildReviewItem(runId, "parent", parent.currentGate, artifactById),
      ...childCollection.reviewQueue
    ].filter((item): item is BetaReviewItem => Boolean(item));

    return {
      status: "beta_status",
      runId,
      topic: config.topic,
      sourceKind: config.sourceKind,
      outputLanguage: config.outputLanguage,
      parent,
      artifacts,
      childRuns: childCollection.childRuns,
      operatorHints: {
        reviewQueue,
        nextToolCalls: buildOperatorToolHints(runId, parent, childCollection.childRuns, reviewQueue),
        readyToPromote: childCollection.readyToPromote
      }
    };
  }

  private async collectChildRuns(parentRunId: string): Promise<{
    childRuns: BetaChildRunStatus[];
    reviewQueue: BetaReviewItem[];
    readyToPromote: boolean;
  }> {
    const runIds = await this.runStore.listRunIds();
    const childRuns: BetaChildRunStatus[] = [];
    const reviewQueue: BetaReviewItem[] = [];

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

      const artifacts = await collectArtifactStatuses(this.runStore.getRunPath(runId), this.workspaceRoot);
      const artifactById = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
      const gateStatus = summarizeGateStatus(runId, artifactById, "child");
      const reviewItem = buildReviewItem(runId, "child", gateStatus.currentGate, artifactById);
      if (reviewItem) {
        reviewQueue.push(reviewItem);
      }
      childRuns.push({
        runId,
        unitId: config.selectedUnit.id,
        title: config.selectedUnit.title,
        currentGate: gateStatus.currentGate,
        approvedGates: gateStatus.approvedGates,
        nextActions: gateStatus.nextActions
      });
    }

    const sortedChildRuns = childRuns.sort((left, right) => (left.unitId ?? left.runId).localeCompare(right.unitId ?? right.runId));
    return {
      childRuns: sortedChildRuns,
      reviewQueue: reviewQueue.sort((left, right) => left.runId.localeCompare(right.runId)),
      readyToPromote:
        sortedChildRuns.length > 0 && sortedChildRuns.every((childRun) => childRun.approvedGates.includes("critic-report"))
    };
  }
}

async function collectArtifactStatuses(runPath: string, workspaceRoot: string): Promise<BetaArtifactStatus[]> {
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
      const draftVersion = hasDraft.has(artifactId) ? versions.at(-1) : undefined;
      return {
        artifactId,
        ...(draftVersion ? { draftVersion, draftPath: relativeArtifactPath(workspaceRoot, runPath, artifactId, draftVersion) } : {}),
        ...(approvedVersion
          ? { approvedVersion, approvedPath: relativeArtifactPath(workspaceRoot, runPath, artifactId, approvedVersion) }
          : {}),
        approved: Boolean(approvedVersion)
      };
    })
  );
}

function buildReviewItem(
  runId: string,
  scope: "parent" | "child",
  currentGate: ApprovalGateId | undefined,
  artifactById: Map<GateArtifactId, BetaArtifactStatus>
): BetaReviewItem | undefined {
  if (!currentGate) {
    return undefined;
  }

  const artifactId = gateToArtifact[currentGate];
  const artifact = artifactById.get(artifactId);
  if (!artifact?.draftVersion || !artifact.draftPath) {
    return undefined;
  }

  return {
    runId,
    scope,
    gate: currentGate,
    artifactId,
    version: artifact.draftVersion,
    artifactPath: artifact.draftPath,
    readArtifact: {
      toolName: "learning_agent.read_artifact",
      input: { runId, artifactId, version: artifact.draftVersion },
      reason: `Read ${currentGate} ${artifact.draftVersion} before approval.`
    },
    approveGate: {
      toolName: "learning_agent.approve_gate",
      input: { runId, gate: currentGate, version: artifact.draftVersion },
      reason: `Approve ${currentGate} only after review.`
    },
    reviseGate: {
      toolName: "learning_agent.revise_gate",
      input: { runId, gate: currentGate, version: artifact.draftVersion, notes: "<revision notes>" },
      reason: `Request revision if ${currentGate} is not acceptable.`
    }
  };
}

function buildOperatorToolHints(
  parentRunId: string,
  parent: BetaRunGateStatus,
  childRuns: BetaChildRunStatus[],
  reviewQueue: BetaReviewItem[]
): BetaToolCallHint[] {
  const firstReview = reviewQueue.at(0);
  if (firstReview) {
    return [firstReview.readArtifact];
  }

  if (!parent.approvedGates.includes("source-map") || parent.currentGate) {
    return [
      {
        toolName: "learning_agent.run_until_gate",
        input: { runId: parentRunId, maxSteps: 20 },
        reason: "Advance the parent run to the next artifact or approval gate."
      }
    ];
  }

  if (parent.approvedGates.includes("curriculum-plan")) {
    if (childRuns.length > 0 && childRuns.every((childRun) => childRun.approvedGates.includes("critic-report"))) {
      return [
        {
          toolName: "learning_agent.promote_units",
          input: { runId: parentRunId, unitSelector: "all" },
          reason: "All child critic reports are approved, so the course pack can be promoted."
        }
      ];
    }

    return [
      {
        toolName: "learning_agent.run_course",
        input: { runId: parentRunId, unitSelector: "all", maxSteps: 20 },
        reason: "Create or advance child unit runs."
      }
    ];
  }

  return [
    {
      toolName: "learning_agent.run_until_gate",
      input: { runId: parentRunId, maxSteps: 20 },
      reason: "Continue parent planning gates."
    }
  ];
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

function relativeArtifactPath(
  workspaceRoot: string,
  runPath: string,
  artifactId: GateArtifactId,
  version: string
): string {
  return path
    .relative(workspaceRoot, path.join(runPath, "artifacts", `${artifactId}.${version}.json`))
    .split(path.sep)
    .join("/");
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
