import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { ArtifactStore } from "../artifact-store.js";
import { AgentRuntimeError } from "../errors.js";
import { RunStore } from "../run-store.js";
import type { RunConfig } from "../types.js";

const tempRoots: string[] = [];

function baseConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    runId: "database-index-001",
    topic: "数据库索引",
    source: { type: "topic", value: "数据库索引" },
    audience: "learners",
    outputLanguage: "zh-CN",
    targetOutput: "web_deck",
    pageCount: { target: 10, min: 8, max: 12 },
    runtime: { adapter: "mock", mode: "interactive" },
    models: { defaultModel: { provider: "mock", model: "mock", temperature: 0.2 } },
    modelFallbackPolicy: "require_approval",
    approvalGates: ["learning-architecture", "lesson", "critic-report", "publish-package"],
    ...overrides
  };
}

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "agent-runtime-stores-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("RunStore", () => {
  test("creates run directory layout and writes config", async () => {
    const workspaceRoot = await createTempRoot();
    const store = new RunStore(workspaceRoot);

    const runPath = await store.createRun(baseConfig());

    expect(runPath).toBe(path.join(workspaceRoot, "runs", "database-index-001"));
    await expect(stat(path.join(runPath, "artifacts")).then((stats) => stats.isDirectory())).resolves.toBe(true);
    await expect(stat(path.join(runPath, "approvals")).then((stats) => stats.isDirectory())).resolves.toBe(true);
    await expect(stat(path.join(runPath, "logs")).then((stats) => stats.isDirectory())).resolves.toBe(true);
    await expect(stat(path.join(runPath, "exports")).then((stats) => stats.isDirectory())).resolves.toBe(true);

    const configJson = await readFile(path.join(runPath, "run.config.json"), "utf8");
    expect(configJson).toContain('"outputLanguage": "zh-CN"');
    expect(configJson.endsWith("\n")).toBe(true);

    const orchestrationLog = await readFile(path.join(runPath, "logs", "orchestration.md"), "utf8");
    expect(orchestrationLog).toContain("Run created");

    const eventLog = await readFile(path.join(runPath, "logs", "runtime-events.jsonl"), "utf8");
    expect(eventLog).toBe("");
  });

  test("readConfig returns validated config and rejects manually corrupted config", async () => {
    const workspaceRoot = await createTempRoot();
    const store = new RunStore(workspaceRoot);
    const runPath = await store.createRun(baseConfig());

    expect(await store.readConfig("database-index-001")).toMatchObject({
      runId: "database-index-001",
      outputLanguage: "zh-CN"
    });

    await writeFile(path.join(runPath, "run.config.json"), `${JSON.stringify(baseConfig({ runId: "bad/run" }))}\n`);
    await expect(store.readConfig("database-index-001")).rejects.toThrow(/runId must match/);

    await writeFile(
      path.join(runPath, "run.config.json"),
      `${JSON.stringify(baseConfig({ outputLanguage: "en-US" }))}\n`
    );
    await expect(store.readConfig("database-index-001")).rejects.toThrow(/outputLanguage/);
  });

  test("getRunPath rejects empty run ids", async () => {
    const store = new RunStore(await createTempRoot());

    expect(() => store.getRunPath("")).toThrow(AgentRuntimeError);
    expect(() => store.getRunPath("")).toThrow(/runId is required/);
  });

  test("getRunPath rejects unsafe run ids", async () => {
    const store = new RunStore(await createTempRoot());

    expect(() => store.getRunPath("../outside")).toThrow(AgentRuntimeError);
    expect(() => store.getRunPath("../outside")).toThrow(/runId must match/);
  });

  test("readConfig rejects unsafe run ids before reading outside runs directory", async () => {
    const workspaceRoot = await createTempRoot();
    const outsideRunPath = path.join(workspaceRoot, "outside");
    await mkdir(outsideRunPath, { recursive: true });
    await writeFile(path.join(outsideRunPath, "run.config.json"), `${JSON.stringify(baseConfig())}\n`);

    const store = new RunStore(workspaceRoot);

    await expect(store.readConfig("../outside")).rejects.toThrow(/runId must match/);
  });
});

describe("ArtifactStore", () => {
  test("writes versioned artifacts and draft alias", async () => {
    const workspaceRoot = await createTempRoot();
    const runPath = await new RunStore(workspaceRoot).createRun(baseConfig());
    const store = new ArtifactStore(runPath);

    const firstPayload = { concepts: ["full table scan"] };
    const secondPayload = { concepts: ["index lookup"], dependencies: ["selectivity"] };

    const first = await store.writeDraft("source-ingest", firstPayload);
    const second = await store.writeDraft("source-ingest", secondPayload);

    expect(first).toMatchObject({ artifactId: "source-ingest", version: "v1" });
    expect(first.version).toBe("v1");
    expect(first.path).toBe(path.join(runPath, "artifacts", "source-ingest.v1.json"));
    expect(first.draftPath).toBe(path.join(runPath, "artifacts", "source-ingest.draft.json"));
    expect(second).toMatchObject({ artifactId: "source-ingest", version: "v2" });
    expect(second.version).toBe("v2");
    expect(second.path).toBe(path.join(runPath, "artifacts", "source-ingest.v2.json"));

    await expect(store.readVersion<typeof firstPayload>("source-ingest", "v1")).resolves.toEqual(firstPayload);
    await expect(store.readVersion<typeof secondPayload>("source-ingest", "v2")).resolves.toEqual(secondPayload);
    await expect(store.readDraft<typeof secondPayload>("source-ingest")).resolves.toEqual(secondPayload);
  });

  test("copyApprovedAlias copies exact version content, not draft alias", async () => {
    const workspaceRoot = await createTempRoot();
    const runPath = await new RunStore(workspaceRoot).createRun(baseConfig());
    const store = new ArtifactStore(runPath);

    const firstPayload = { lesson: "v1", pages: 8 };
    const secondPayload = { lesson: "v2", pages: 10 };

    await store.writeDraft("lesson", firstPayload);
    await store.writeDraft("lesson", secondPayload);

    const approvedPath = await store.copyApprovedAlias("lesson", "v1");

    expect(approvedPath).toBe(path.join(runPath, "artifacts", "lesson.approved.json"));
    await expect(readFile(approvedPath, "utf8")).resolves.toBe(`${JSON.stringify(firstPayload, null, 2)}\n`);
    await expect(store.readDraft<typeof secondPayload>("lesson")).resolves.toEqual(secondPayload);
  });

  test("writeDraft rejects artifact ids that can escape artifacts directory", async () => {
    const workspaceRoot = await createTempRoot();
    const runPath = await new RunStore(workspaceRoot).createRun(baseConfig());
    const store = new ArtifactStore(runPath);
    const outsidePath = path.join(runPath, "approvals", "pwn.draft.json");

    await expect(store.writeDraft("../approvals/pwn", {})).rejects.toThrow(/artifactId must match/);
    await expect(stat(outsidePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("readVersion rejects invalid version segments", async () => {
    const workspaceRoot = await createTempRoot();
    const runPath = await new RunStore(workspaceRoot).createRun(baseConfig());
    const store = new ArtifactStore(runPath);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(store.readVersion("lesson", "bad" as any)).rejects.toThrow(/version must match/);
  });

  test("copyApprovedAlias rejects invalid version segments", async () => {
    const workspaceRoot = await createTempRoot();
    const runPath = await new RunStore(workspaceRoot).createRun(baseConfig());
    const store = new ArtifactStore(runPath);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(store.copyApprovedAlias("lesson", "../v1" as any)).rejects.toThrow(/version must match/);
  });
});
