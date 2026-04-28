import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactStore, ArtifactVersion } from "./artifact-store.js";
import { AgentRuntimeError } from "./errors.js";
import type { ApprovalGateId } from "./types.js";

export type ApprovalDecision = "approved" | "approved_with_notes" | "revision_requested" | "rejected";

export type ApprovalRequest = {
  gate: ApprovalGateId;
  runId: string;
  artifactId: string;
  version: ArtifactVersion;
  decision: ApprovalDecision;
  operatorNotes?: string;
};

export type ApprovalRecord = {
  gate: ApprovalGateId;
  runId: string;
  approvedArtifact: string;
  decision: ApprovalDecision;
  operatorNotes: string;
  decidedAt: string;
};

const supportedDecisions = new Set<ApprovalDecision>([
  "approved",
  "approved_with_notes",
  "revision_requested",
  "rejected"
]);
const approvalGateArtifactIds: Record<ApprovalGateId, string> = {
  "source-map": "source-map",
  "concept-map": "concept-map",
  "curriculum-plan": "curriculum-plan",
  "learning-architecture": "learning-architecture",
  lesson: "lesson",
  "critic-report": "critic-report",
  "publish-package": "publish-package"
};
const safeRunIdPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export class ApprovalService {
  private readonly approvalsPath: string;
  private readonly artifactsPath: string;

  constructor(
    runPath: string,
    private readonly artifactStore: ArtifactStore
  ) {
    this.approvalsPath = path.join(runPath, "approvals");
    this.artifactsPath = path.join(runPath, "artifacts");
  }

  async approve(request: ApprovalRequest): Promise<ApprovalRecord> {
    validateGate(request.gate);
    validateRunId(request.runId);
    validateDecision(request.decision);

    await this.artifactStore.readVersion(request.artifactId, request.version);
    if (request.artifactId !== approvalGateArtifactIds[request.gate]) {
      throw new AgentRuntimeError("artifactId must match gate", "INVALID_RUN_CONFIG");
    }

    const record: ApprovalRecord = {
      gate: request.gate,
      runId: request.runId,
      approvedArtifact: `artifacts/${request.artifactId}.${request.version}.json`,
      decision: request.decision,
      operatorNotes: request.operatorNotes ?? "",
      decidedAt: new Date().toISOString()
    };
    const isApprovedDecision = request.decision === "approved" || request.decision === "approved_with_notes";
    const recordKind = isApprovedDecision ? "approved" : "decision";

    await mkdir(this.approvalsPath, { recursive: true });
    await writeJson(path.join(this.approvalsPath, `${request.gate}.${recordKind}.json`), record);

    if (isApprovedDecision) {
      await removeFileIfExists(path.join(this.approvalsPath, `${request.gate}.decision.json`));
      await this.artifactStore.copyApprovedAlias(request.artifactId, request.version);
    }

    return record;
  }

  async isGateApprovedForCurrentArtifact(gate: ApprovalGateId, artifactId: string): Promise<boolean> {
    validateGate(gate);
    if (artifactId !== approvalGateArtifactIds[gate]) {
      throw new AgentRuntimeError("artifactId must match gate", "INVALID_RUN_CONFIG");
    }

    const currentVersion = await this.getCurrentArtifactVersion(artifactId);
    if (!currentVersion) {
      return false;
    }

    const approvalRecord = await this.readApprovalRecord(path.join(this.approvalsPath, `${gate}.approved.json`));
    if (!approvalRecord) {
      return false;
    }

    if (approvalRecord.approvedArtifact !== `artifacts/${artifactId}.${currentVersion}.json`) {
      return false;
    }

    const decisionRecord = await this.readApprovalRecord(path.join(this.approvalsPath, `${gate}.decision.json`));
    if (decisionRecord && !isRecordLater(approvalRecord, decisionRecord)) {
      return false;
    }

    return true;
  }

  async getGateDecisionForCurrentArtifact(
    gate: ApprovalGateId,
    artifactId: string
  ): Promise<ApprovalRecord | undefined> {
    validateGate(gate);
    if (artifactId !== approvalGateArtifactIds[gate]) {
      throw new AgentRuntimeError("artifactId must match gate", "INVALID_RUN_CONFIG");
    }

    const currentVersion = await this.getCurrentArtifactVersion(artifactId);
    if (!currentVersion) {
      return undefined;
    }

    const decisionRecord = await this.readApprovalRecord(path.join(this.approvalsPath, `${gate}.decision.json`));
    if (decisionRecord?.approvedArtifact !== `artifacts/${artifactId}.${currentVersion}.json`) {
      return undefined;
    }

    return decisionRecord;
  }

  private async getCurrentArtifactVersion(artifactId: string): Promise<ArtifactVersion | undefined> {
    let entries: string[];
    try {
      entries = await readdir(this.artifactsPath);
    } catch (error) {
      if (isFileNotFound(error)) {
        return undefined;
      }
      throw error;
    }

    const versionPattern = new RegExp(`^${escapeRegex(artifactId)}\\.v(\\d+)\\.json$`);
    const latestVersion = entries
      .map((entry) => versionPattern.exec(entry)?.[1])
      .filter((version): version is string => version !== undefined)
      .map(Number)
      .sort((left, right) => right - left)[0];

    return latestVersion === undefined ? undefined : `v${latestVersion}`;
  }

  private async readApprovalRecord(filePath: string): Promise<ApprovalRecord | undefined> {
    try {
      return JSON.parse(await readFile(filePath, "utf8")) as ApprovalRecord;
    } catch (error) {
      if (isFileNotFound(error)) {
        return undefined;
      }
      throw error;
    }
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validateGate(gate: ApprovalGateId): void {
  if (!Object.hasOwn(approvalGateArtifactIds, gate)) {
    throw new AgentRuntimeError(
      `gate must be one of ${Object.keys(approvalGateArtifactIds).join(", ")}`,
      "INVALID_RUN_CONFIG"
    );
  }
}

function validateRunId(runId: string): void {
  if (!safeRunIdPattern.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/", "INVALID_RUN_CONFIG");
  }
}

function validateDecision(decision: ApprovalDecision): void {
  if (!supportedDecisions.has(decision)) {
    throw new AgentRuntimeError(
      `decision must be one of ${Array.from(supportedDecisions).join(", ")}`,
      "INVALID_RUN_CONFIG"
    );
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecordLater(left: ApprovalRecord, right: ApprovalRecord): boolean {
  return new Date(left.decidedAt).getTime() > new Date(right.decidedAt).getTime();
}

async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isFileNotFound(error)) {
      return;
    }
    throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
