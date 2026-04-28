import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

import type { ApprovalGateId } from "../types.js";
import { roleSequence } from "./role-sequence.js";

export async function invalidateDownstreamArtifacts(runPath: string, submittedArtifactId: string): Promise<void> {
  const stepIndex = roleSequence.findIndex((step) => step.artifactId === submittedArtifactId);
  if (stepIndex < 0) {
    return;
  }

  const downstreamSteps = roleSequence.slice(stepIndex + 1);
  const artifactIds = new Set(downstreamSteps.map((step) => step.artifactId));
  const gates = new Set(downstreamSteps.map((step) => step.createsGate).filter((gate): gate is ApprovalGateId => !!gate));
  const artifactsPath = path.join(runPath, "artifacts");
  const approvalsPath = path.join(runPath, "approvals");
  const artifactEntries = await readdir(artifactsPath).catch((error: unknown) => {
    if (isFileNotFound(error)) {
      return [];
    }
    throw error;
  });

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

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
