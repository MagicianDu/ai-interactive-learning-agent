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
      "用 \"examples/sources/agent-workflow-notes.md\" 这本书生成中文课程，先做总览课，再按核心 topic 拆课。每个单元 10 页，面向中文开发者，教学难度为大学高年级/研究生课程。",
      { runId: "agentic-design-plan" }
    );

    expect(plan.runId).toBe("agentic-design-plan");
    expect(plan.status).toBe("draft");
    expect(plan.intent.source.kind).toBe("book");
    expect(plan.initArgs).toMatchObject({
      sourceFile: "examples/sources/agent-workflow-notes.md",
      sourceKind: "book",
      unitPages: "10",
      strategy: "overview_plus_topic",
      planningMode: "topic_guided",
      difficultyLevel: "upper_undergraduate_or_graduate",
      language: "zh-CN",
      adapter: "codex",
      run: "agentic-design-plan"
    });
    expect(plan.summary).toContain("difficultyLevel=upper_undergraduate_or_graduate");
    expect(plan.reviewItems).toContain("确认 sourceKind=book 是否符合输入资料。");
    expect(plan.reviewItems).toContain("确认 teaching difficulty=大学高年级/研究生课程 是否符合学习目标。");
  });

  test("preserves total page budgets from plan to initialized run config", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-plan-"));
    const service = new RunPlanService(workspaceRoot);
    const plan = service.createPlan(
      "用 /tmp/book.pdf 做成学生自学 Web 教材，总共 80 页，每个单元 8 页，面向中文学习者，教学难度为大学高年级/研究生课程。",
      { runId: "self-study-plan" }
    );

    expect(plan.intent.targetTotalPages).toBe(80);
    expect(plan.initArgs.targetTotalPages).toBe("80");
    expect(plan.summary).toContain("targetTotalPages=80");
    expect(plan.reviewItems).toContain("确认整套课程总页数约 80 页是否符合学习目标。");

    await service.writePlan(plan);
    await service.initializeRunFromPlan("self-study-plan", { approve: true });
    const config = await new RunStore(workspaceRoot).readConfig("self-study-plan");

    expect(config.coursePack?.targetTotalPages).toBe(80);
  });

  test("writes a run plan to the run directory", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-plan-"));
    const service = new RunPlanService(workspaceRoot);
    const plan = service.createPlan("用哈希表生成 8 页中文课，面向中文学习者，教学难度为本科核心课程。", { runId: "hash-plan" });

    const planPath = await service.writePlan(plan);
    const rawPlan = await readFile(planPath, "utf8");

    expect(planPath).toBe(path.join(workspaceRoot, "runs", "hash-plan", "run.plan.json"));
    expect(JSON.parse(rawPlan)).toMatchObject({
      runId: "hash-plan",
      status: "draft",
      initArgs: {
        topic: "哈希表",
        unitPages: "8",
        difficultyLevel: "undergraduate_core",
        language: "zh-CN",
        run: "hash-plan"
      }
    });
  });

  test("allows adapter override for automated natural-language smoke runs", () => {
    const service = new RunPlanService("/workspace");
    const plan = service.createPlan("用哈希表生成 8 页中文课，面向中文学习者，教学难度为本科核心课程。", {
      runId: "hash-plan",
      adapter: "mock"
    });

    expect(plan.initArgs.adapter).toBe("mock");
    expect(plan.summary).toContain("adapter=mock");
  });

  test("requires approval before initializing a run from a plan", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-plan-"));
    const service = new RunPlanService(workspaceRoot);
    await service.writePlan(service.createPlan("用哈希表生成 8 页中文课，教学难度为本科核心课程。", { runId: "hash-plan" }));

    await expect(service.initializeRunFromPlan("hash-plan")).rejects.toThrow(/plan must be approved/);
  });

  test("approves and initializes a run from a plan", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-plan-"));
    const service = new RunPlanService(workspaceRoot);
    await service.writePlan(service.createPlan("用哈希表生成 8 页中文课，面向中文学习者，教学难度为研究论文精读。", { runId: "hash-plan" }));

    const result = await service.initializeRunFromPlan("hash-plan", { approve: true });
    const config = await new RunStore(workspaceRoot).readConfig("hash-plan");

    expect(result.status).toBe("initialized");
    expect(config.runId).toBe("hash-plan");
    expect(config.topic).toBe("哈希表");
    expect(config.pageCount.target).toBe(8);
    expect(config.userLearningProfile.level).toBe("expert");
    expect(config.runtime.adapter).toBe("codex-manual");
  });
});
