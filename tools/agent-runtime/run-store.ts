import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "./errors.js";
import { validateRunConfig } from "./run-config.js";
import type { RunConfig } from "./types.js";

const safeRunIdPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export class RunStore {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  getRunPath(runId: string): string {
    if (!runId.trim()) {
      throw new AgentRuntimeError("runId is required", "MISSING_RUN");
    }
    if (!safeRunIdPattern.test(runId)) {
      throw new AgentRuntimeError("runId must match /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/", "INVALID_RUN_CONFIG");
    }
    return path.join(this.workspaceRoot, "runs", runId);
  }

  async createRun(config: RunConfig): Promise<string> {
    const validatedConfig = validateRunConfig(config);
    const runPath = this.getRunPath(validatedConfig.runId);

    await Promise.all(
      ["artifacts", "approvals", "logs", "exports"].map((dir) => mkdir(path.join(runPath, dir), { recursive: true }))
    );
    await writeJson(path.join(runPath, "run.config.json"), validatedConfig);
    await writeFile(path.join(runPath, "logs", "orchestration.md"), "Run created\n", "utf8");
    await writeFile(path.join(runPath, "logs", "runtime-events.jsonl"), "", "utf8");

    return runPath;
  }

  async readConfig(runId: string): Promise<RunConfig> {
    const configPath = path.join(this.getRunPath(runId), "run.config.json");
    const rawConfig = await readFile(configPath, "utf8");
    return validateRunConfig(JSON.parse(rawConfig) as RunConfig);
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
