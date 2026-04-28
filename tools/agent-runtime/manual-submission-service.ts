import { readFile } from "node:fs/promises";
import path from "node:path";

import { ArtifactStore, type ArtifactVersion } from "./artifact-store.js";
import { AgentRuntimeError } from "./errors.js";
import { RunStore } from "./run-store.js";
import { invalidateDownstreamArtifacts } from "./workflow/downstream-invalidation.js";

export type ManualSubmissionInput = {
  runId: string;
  artifactId: string;
  filePath: string;
};

export type ManualSubmissionResult = {
  status: "artifact_submitted";
  artifactId: string;
  version: ArtifactVersion;
  path: string;
  draftPath: string;
};

export class ManualSubmissionService {
  private readonly runStore: RunStore;

  constructor(private readonly workspaceRoot: string = process.cwd()) {
    this.runStore = new RunStore(workspaceRoot);
  }

  async submit(input: ManualSubmissionInput): Promise<ManualSubmissionResult> {
    const runPath = this.runStore.getRunPath(input.runId);
    const artifactStore = new ArtifactStore(runPath);
    const payload = await readJsonFile(path.resolve(this.workspaceRoot, input.filePath));
    const result = await artifactStore.writeDraft(input.artifactId, payload);
    await invalidateDownstreamArtifacts(runPath, input.artifactId);

    return {
      status: "artifact_submitted",
      artifactId: result.artifactId,
      version: result.version,
      path: result.path,
      draftPath: result.draftPath
    };
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AgentRuntimeError(`manual artifact file is not valid JSON: ${error.message}`, "INVALID_RUN_CONFIG");
    }
    throw error;
  }
}
