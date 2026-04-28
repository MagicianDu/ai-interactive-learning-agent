import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { CodexManualAdapter } from "../adapters/codex-manual-adapter.js";
import { ApprovalService } from "../approval-service.js";
import { ArtifactStore } from "../artifact-store.js";
import { ManualSubmissionService } from "../manual-submission-service.js";
import { RunStore } from "../run-store.js";
import type { RunConfig } from "../types.js";
import { AgentWorkflow } from "../workflow/agent-workflow.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("codex-manual workflow", () => {
  test("generates a manual role prompt and does not write a draft artifact", async () => {
    const { artifactPath, workflow } = await createHarness();

    await expect(workflow.runNext("hash-table-manual")).resolves.toMatchObject({
      status: "manual_action_required",
      roleId: "source-ingest",
      artifactId: "source-ingest",
      promptPath: expect.stringContaining("manual-requests/source-ingest.md")
    });

    await expect(stat(artifactPath("source-ingest.draft.json"))).rejects.toMatchObject({ code: "ENOENT" });

    const prompt = await readFile(path.join(path.dirname(artifactPath("x")), "..", "manual-requests", "source-ingest.md"), "utf8");
    expect(prompt).toContain("source-ingest");
    expect(prompt).toContain("哈希表");
    expect(prompt).toContain("npm run agent:submit");
  });

  test("submits a manually generated artifact through the versioned artifact store", async () => {
    const root = await createTempRoot();
    const runStore = new RunStore(root);
    const config = baseConfig();
    const runPath = await runStore.createRun(config);
    const outputPath = path.join(root, "manual-output.json");
    await writeFile(outputPath, JSON.stringify({ concepts: ["哈希表"], language: "zh-CN" }), "utf8");

    const service = new ManualSubmissionService(root);
    const result = await service.submit({
      runId: config.runId,
      artifactId: "source-ingest",
      filePath: outputPath
    });

    expect(result).toMatchObject({ status: "artifact_submitted", artifactId: "source-ingest", version: "v1" });
    await expect(readFile(path.join(runPath, "artifacts", "source-ingest.v1.json"), "utf8")).resolves.toContain("哈希表");
    await expect(readFile(path.join(runPath, "artifacts", "source-ingest.draft.json"), "utf8")).resolves.toContain("zh-CN");
  });

  test("submitting a revised upstream artifact invalidates downstream drafts", async () => {
    const root = await createTempRoot();
    const runStore = new RunStore(root);
    const config = baseConfig();
    const runPath = await runStore.createRun(config);
    const artifactStore = new ArtifactStore(runPath);
    await artifactStore.writeDraft("learning-architecture", { pageSequence: ["旧路径"] });
    await artifactStore.writeDraft("visual-plan", { visualPlan: ["旧视觉"] });
    await artifactStore.writeDraft("lesson", { pages: ["旧课程"] });
    const outputPath = path.join(root, "manual-learning-architecture.json");
    await writeFile(outputPath, JSON.stringify({ pageSequence: ["新路径"] }), "utf8");

    const service = new ManualSubmissionService(root);
    const result = await service.submit({
      runId: config.runId,
      artifactId: "learning-architecture",
      filePath: outputPath
    });

    expect(result).toMatchObject({ artifactId: "learning-architecture", version: "v2" });
    await expect(readFile(path.join(runPath, "artifacts", "learning-architecture.draft.json"), "utf8")).resolves.toContain(
      "新路径"
    );
    await expect(stat(path.join(runPath, "artifacts", "visual-plan.draft.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(runPath, "artifacts", "lesson.draft.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function createHarness(): Promise<{
  artifactPath: (fileName: string) => string;
  workflow: AgentWorkflow;
}> {
  const root = await createTempRoot();
  const runStore = new RunStore(root);
  const config = baseConfig();
  const runPath = await runStore.createRun(config);
  const artifactStore = new ArtifactStore(runPath);
  const approvalService = new ApprovalService(runPath, artifactStore);
  const workflow = new AgentWorkflow(runStore, artifactStore, approvalService, new CodexManualAdapter());

  return {
    artifactPath: (fileName: string) => path.join(runPath, "artifacts", fileName),
    workflow
  };
}

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "agent-runtime-codex-manual-"));
  tempRoots.push(root);
  return root;
}

function baseConfig(): RunConfig {
  return {
    runId: "hash-table-manual",
    topic: "哈希表",
    source: { type: "topic", value: "哈希表" },
    audience: "具备基础技术背景的中文学习者",
    outputLanguage: "zh-CN",
    targetOutput: "web_deck",
    pageCount: { target: 8, min: 6, max: 10 },
    runtime: { adapter: "codex-manual", mode: "interactive" },
    models: { defaultModel: { provider: "codex", model: "manual-codex-session" } },
    modelFallbackPolicy: "require_approval",
    approvalGates: ["learning-architecture", "lesson", "critic-report", "publish-package"]
  };
}
