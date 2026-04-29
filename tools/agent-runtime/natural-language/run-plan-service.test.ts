import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { RunPlanService } from "./run-plan-service.js";
import { RunStore } from "../run-store.js";

describe("RunPlanService", () => {
  test("creates a reviewable plan from Chinese natural language", () => {
    const service = new RunPlanService("/workspace");
    const plan = service.createPlan(
      "用 /Users/dm/Documents/BOOKS/Agentic_Design_Patterns.pdf 这本书生成中文课程，先做总览课，再按核心 topic 拆课。每个单元 10 页，面向中文开发者。",
      { runId: "agentic-design-plan" }
    );

    expect(plan.runId).toBe("agentic-design-plan");
    expect(plan.status).toBe("draft");
    expect(plan.intent.source.kind).toBe("book");
    expect(plan.initArgs).toMatchObject({
      sourceFile: "/Users/dm/Documents/BOOKS/Agentic_Design_Patterns.pdf",
      sourceKind: "book",
      unitPages: "10",
      strategy: "overview_plus_topic",
      planningMode: "topic_guided",
      language: "zh-CN",
      adapter: "codex",
      run: "agentic-design-plan"
    });
    expect(plan.reviewItems).toContain("确认 sourceKind=book 是否符合输入资料。");
  });

  test("writes a run plan to the run directory", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-plan-"));
    const service = new RunPlanService(workspaceRoot);
    const plan = service.createPlan("用哈希表生成 8 页中文课，面向中文学习者。", { runId: "hash-plan" });

    const planPath = await service.writePlan(plan);
    const rawPlan = await readFile(planPath, "utf8");

    expect(planPath).toBe(path.join(workspaceRoot, "runs", "hash-plan", "run.plan.json"));
    expect(JSON.parse(rawPlan)).toMatchObject({
      runId: "hash-plan",
      status: "draft",
      initArgs: {
        topic: "哈希表",
        unitPages: "8",
        language: "zh-CN",
        run: "hash-plan"
      }
    });
  });

  test("requires approval before initializing a run from a plan", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-plan-"));
    const service = new RunPlanService(workspaceRoot);
    await service.writePlan(service.createPlan("用哈希表生成 8 页中文课。", { runId: "hash-plan" }));

    await expect(service.initializeRunFromPlan("hash-plan")).rejects.toThrow(/plan must be approved/);
  });

  test("approves and initializes a run from a plan", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-plan-"));
    const service = new RunPlanService(workspaceRoot);
    await service.writePlan(service.createPlan("用哈希表生成 8 页中文课，面向中文学习者。", { runId: "hash-plan" }));

    const result = await service.initializeRunFromPlan("hash-plan", { approve: true });
    const config = await new RunStore(workspaceRoot).readConfig("hash-plan");

    expect(result.status).toBe("initialized");
    expect(config.runId).toBe("hash-plan");
    expect(config.topic).toBe("哈希表");
    expect(config.pageCount.target).toBe(8);
    expect(config.runtime.adapter).toBe("codex-manual");
  });
});
