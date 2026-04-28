import { access } from "node:fs/promises";
import path from "node:path";

import type { RuntimeAdapter } from "../adapters/mock-adapter.js";
import { ApprovalService } from "../approval-service.js";
import type { ArtifactStore, ArtifactVersion } from "../artifact-store.js";
import type { RunStore } from "../run-store.js";
import type { ApprovalGateId } from "../types.js";
import { invalidateDownstreamArtifacts } from "./downstream-invalidation.js";
import { roleSequence, type RoleStep } from "./role-sequence.js";

export type AgentWorkflowResult =
  | {
      status: "artifact_written";
      artifactId: string;
      version: ArtifactVersion;
      createsGate?: ApprovalGateId;
    }
  | {
      status: "manual_action_required";
      roleId: string;
      artifactId: string;
      promptPath: string;
      message: string;
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

    for (const step of roleSequence) {
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
        const adapterResult = await this.adapter.executeRole({
          config,
          runPath,
          roleId: step.roleId,
          artifactId: step.artifactId
        });
        if (adapterResult.kind === "manual_action_required") {
          return {
            status: "manual_action_required",
            roleId: adapterResult.roleId,
            artifactId: adapterResult.artifactId,
            promptPath: adapterResult.promptPath,
            message: adapterResult.message
          };
        }
        const result = await this.artifactStore.writeDraft(step.artifactId, adapterResult.payload);
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
          const adapterResult = await this.adapter.executeRole({
            config,
            runPath,
            roleId: step.roleId,
            artifactId: step.artifactId
          });
          if (adapterResult.kind === "manual_action_required") {
            return {
              status: "manual_action_required",
              roleId: adapterResult.roleId,
              artifactId: adapterResult.artifactId,
              promptPath: adapterResult.promptPath,
              message: adapterResult.message
            };
          }
          const result = await this.artifactStore.writeDraft(step.artifactId, adapterResult.payload);
          await invalidateDownstreamArtifacts(runPath, step.artifactId);
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
