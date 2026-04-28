import { access, readdir, unlink } from "node:fs/promises";
import path from "node:path";

import type { RuntimeAdapter } from "../adapters/mock-adapter.js";
import { ApprovalService } from "../approval-service.js";
import type { ArtifactStore, ArtifactVersion } from "../artifact-store.js";
import type { RunStore } from "../run-store.js";
import type { ApprovalGateId } from "../types.js";
import { roleSequence, type RoleStep } from "./role-sequence.js";

export type AgentWorkflowResult =
  | {
      status: "artifact_written";
      artifactId: string;
      version: ArtifactVersion;
      createsGate?: ApprovalGateId;
    }
  | {
      status: "approval_required";
      requiredGate: ApprovalGateId;
    }
  | {
      status: "complete";
    };

export class AgentWorkflow {
  constructor(
    private readonly runStore: RunStore,
    private readonly artifactStore: ArtifactStore,
    private readonly approvalService: ApprovalService,
    private readonly adapter: RuntimeAdapter
  ) {}

  async runNext(runId: string): Promise<AgentWorkflowResult> {
    const config = await this.runStore.readConfig(runId);
    const runPath = this.runStore.getRunPath(runId);

    for (const [stepIndex, step] of roleSequence.entries()) {
      if (
        step.requiredApprovedGateBefore &&
        !(await this.approvalService.isGateApprovedForCurrentArtifact(
          step.requiredApprovedGateBefore,
          step.requiredApprovedGateBefore
        ))
      ) {
        return { status: "approval_required", requiredGate: step.requiredApprovedGateBefore };
      }

      if (!(await this.hasDraftArtifact(runPath, step))) {
        const payload = await this.adapter.executeRole(config, step.roleId, step.artifactId);
        const result = await this.artifactStore.writeDraft(step.artifactId, payload);
        return {
          status: "artifact_written",
          artifactId: result.artifactId,
          version: result.version,
          ...(step.createsGate ? { createsGate: step.createsGate } : {})
        };
      }

      if (step.createsGate && !(await this.approvalService.isGateApprovedForCurrentArtifact(step.createsGate, step.artifactId))) {
        const decision = await this.approvalService.getGateDecisionForCurrentArtifact(step.createsGate, step.artifactId);
        if (decision?.decision === "revision_requested") {
          const payload = await this.adapter.executeRole(config, step.roleId, step.artifactId);
          const result = await this.artifactStore.writeDraft(step.artifactId, payload);
          await this.invalidateDownstreamArtifacts(runPath, stepIndex);
          return {
            status: "artifact_written",
            artifactId: result.artifactId,
            version: result.version,
            createsGate: step.createsGate
          };
        }
        return { status: "approval_required", requiredGate: step.createsGate };
      }
    }

    return { status: "complete" };
  }

  private async hasDraftArtifact(runPath: string, step: RoleStep): Promise<boolean> {
    return fileExists(path.join(runPath, "artifacts", `${step.artifactId}.draft.json`));
  }

  private async invalidateDownstreamArtifacts(runPath: string, stepIndex: number): Promise<void> {
    const downstreamSteps = roleSequence.slice(stepIndex + 1);
    const artifactIds = new Set(downstreamSteps.map((step) => step.artifactId));
    const gates = new Set(downstreamSteps.map((step) => step.createsGate).filter((gate): gate is ApprovalGateId => !!gate));
    const artifactsPath = path.join(runPath, "artifacts");
    const approvalsPath = path.join(runPath, "approvals");

    let artifactEntries: string[];
    try {
      artifactEntries = await readdir(artifactsPath);
    } catch (error) {
      if (isFileNotFound(error)) {
        artifactEntries = [];
      } else {
        throw error;
      }
    }

    await Promise.all(
      artifactEntries
        .filter((entry) => shouldRemoveArtifactEntry(entry, artifactIds))
        .map((entry) => unlinkIfExists(path.join(artifactsPath, entry)))
    );

    await Promise.all(
      Array.from(gates).flatMap((gate) => [
        unlinkIfExists(path.join(approvalsPath, `${gate}.approved.json`)),
        unlinkIfExists(path.join(approvalsPath, `${gate}.decision.json`))
      ])
    );
  }
}

function shouldRemoveArtifactEntry(entry: string, artifactIds: Set<string>): boolean {
  for (const artifactId of artifactIds) {
    if (
      entry === `${artifactId}.draft.json` ||
      entry === `${artifactId}.approved.json` ||
      new RegExp(`^${escapeRegex(artifactId)}\\.v[1-9][0-9]*\\.json$`).test(entry)
    ) {
      return true;
    }
  }
  return false;
}

async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isFileNotFound(error)) {
      return;
    }
    throw error;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (isFileNotFound(error)) {
      return false;
    }
    throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
