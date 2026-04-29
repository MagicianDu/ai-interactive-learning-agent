import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ArtifactStore } from "../agent-runtime/artifact-store.js";
import { RunStore } from "../agent-runtime/run-store.js";
import { LearningAgentRuntimeTools } from "./runtime-tools.js";
import { learningAgentToolContracts } from "./tool-contracts.js";

describe("LearningAgentRuntimeTools", () => {
  test("declares stable learning agent tool contracts", () => {
    expect(learningAgentToolContracts.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "learning_agent.init_run",
        "learning_agent.plan_run",
        "learning_agent.init_from_plan",
        "learning_agent.status",
        "learning_agent.beta_status",
        "learning_agent.run_until_gate",
        "learning_agent.list_artifacts",
        "learning_agent.read_artifact",
        "learning_agent.submit_artifact",
        "learning_agent.approve_gate",
        "learning_agent.revise_gate",
        "learning_agent.list_units",
        "learning_agent.run_next",
        "learning_agent.run_course",
        "learning_agent.promote_units",
        "learning_agent.promote_lesson"
      ])
    );
  });

  test("plans and initializes a run from natural language through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);

    const planResult = await tools.callTool("learning_agent.plan_run", {
      request: "用哈希表生成 8 页中文课，面向有基础编程经验但缺少数据结构心智模型的学习者。",
      runId: "mcp-nl-plan",
      adapter: "mock"
    });
    const initResult = await tools.callTool("learning_agent.init_from_plan", {
      runId: "mcp-nl-plan",
      approve: true
    });
    const statusResult = await tools.callTool("learning_agent.status", { runId: "mcp-nl-plan" });

    expect(planResult).toMatchObject({
      status: "plan_written",
      runId: "mcp-nl-plan",
      summary: expect.arrayContaining(["unitPages=8", "language=zh-CN"])
    });
    expect(initResult).toMatchObject({ status: "initialized", runId: "mcp-nl-plan" });
    expect(statusResult).toMatchObject({
      runId: "mcp-nl-plan",
      topic: "哈希表",
      pageCount: { target: 8 }
    });
    await expect(readFile(path.join(root, "runs", "mcp-nl-plan", "run.plan.json"), "utf8")).resolves.toContain(
      "\"status\": \"approved\""
    );
    await expect(readFile(path.join(root, "runs", "mcp-nl-plan", "run.config.json"), "utf8")).resolves.toContain(
      "\"adapter\": \"mock\""
    );
  });

  test("initializes and reads run status through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);

    const initResult = await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-smoke"
    });
    const statusResult = await tools.callTool("learning_agent.status", { runId: "mcp-smoke" });

    expect(initResult).toMatchObject({ status: "initialized", runId: "mcp-smoke" });
    expect(statusResult).toMatchObject({
      runId: "mcp-smoke",
      topic: "哈希表",
      pageCount: { target: 8 }
    });
    await expect(readFile(path.join(root, "runs", "mcp-smoke", "run.config.json"), "utf8")).resolves.toContain("哈希表");
  });

  test("submits and approves artifacts through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-smoke"
    });
    const artifactPath = path.join(root, "source-map.json");
    await writeFile(artifactPath, JSON.stringify({ artifactId: "source-map", anchors: [] }), "utf8");

    const submitResult = await tools.callTool("learning_agent.submit_artifact", {
      runId: "mcp-smoke",
      artifactId: "source-map",
      filePath: artifactPath
    });
    const approveResult = await tools.callTool("learning_agent.approve_gate", {
      runId: "mcp-smoke",
      gate: "source-map",
      version: "v1",
      notes: "ok"
    });

    expect(submitResult).toMatchObject({ status: "artifact_submitted", artifactId: "source-map", version: "v1" });
    expect(approveResult).toMatchObject({ gate: "source-map", decision: "approved" });
  });

  test("runs the next workflow step through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-smoke"
    });

    const result = await tools.callTool("learning_agent.run_next", { runId: "mcp-smoke" });
    const betaStatus = await tools.callTool("learning_agent.beta_status", { runId: "mcp-smoke" });

    expect(result).toMatchObject({ status: "artifact_written", artifactId: "source-map" });
    expect(betaStatus).toMatchObject({
      status: "beta_status",
      runId: "mcp-smoke",
      parent: {
        currentGate: "source-map",
        nextActions: [expect.stringContaining("Review source-map")]
      },
      operatorHints: {
        reviewQueue: [
          expect.objectContaining({
            gate: "source-map",
            version: "v1",
            artifactPath: "runs/mcp-smoke/artifacts/source-map.v1.json"
          })
        ],
        nextToolCalls: [
          expect.objectContaining({
            toolName: "learning_agent.read_artifact",
            input: { runId: "mcp-smoke", artifactId: "source-map", version: "v1" }
          })
        ],
        readyToPromote: false
      }
    });
    expect(JSON.stringify(betaStatus).length).toBeLessThan(15000);
  });

  test("advances a run until the next approval gate and exposes generated artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-loop"
    });

    const runResult = await tools.callTool("learning_agent.run_until_gate", {
      runId: "mcp-loop",
      maxSteps: 5
    });
    const artifacts = await tools.callTool("learning_agent.list_artifacts", { runId: "mcp-loop" });
    const sourceMap = await tools.callTool("learning_agent.read_artifact", {
      runId: "mcp-loop",
      artifactId: "source-map",
      version: "v1"
    });

    expect(runResult).toMatchObject({
      status: "run_advanced",
      runId: "mcp-loop",
      finalStatus: "approval_required",
      requiredGate: "source-map",
      steps: [
        expect.objectContaining({ status: "artifact_written", artifactId: "source-map" }),
        expect.objectContaining({ status: "approval_required", requiredGate: "source-map" })
      ]
    });
    expect(artifacts).toMatchObject({
      runId: "mcp-loop",
      artifacts: expect.arrayContaining([
        expect.objectContaining({
          artifactId: "source-map",
          versions: expect.arrayContaining(["v1"]),
          aliases: expect.arrayContaining(["draft"])
        })
      ])
    });
    expect(sourceMap).toMatchObject({
      artifactId: "source-map",
      version: "v1",
      payload: expect.objectContaining({
        artifactId: "source-map",
        anchors: expect.any(Array)
      })
    });
  });

  test("promotes an approved lesson through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-smoke"
    });
    const runPath = new RunStore(root).getRunPath("mcp-smoke");
    const artifacts = new ArtifactStore(runPath);
    await artifacts.writeDraft("lesson", buildQualityLesson());
    await tools.callTool("learning_agent.approve_gate", {
      runId: "mcp-smoke",
      gate: "lesson",
      version: "v1"
    });

    const result = await tools.callTool("learning_agent.promote_lesson", { runId: "mcp-smoke" });

    expect(result).toMatchObject({ status: "promoted", lessonId: "hash-table" });
  });

  test("returns clear errors for unknown tools", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-")));

    await expect(tools.callTool("learning_agent.missing", {})).rejects.toThrow(/unsupported tool/);
  });
});

function buildQualityLesson(): Record<string, unknown> {
  return {
    id: "hash-table",
    title: "哈希表为什么快",
    audience: "中文学习者",
    config: { targetPageCount: 8, minPageCount: 6, maxPageCount: 10 },
    prerequisites: [],
    learningObjectives: ["解释哈希表访问路径"],
    pages: [
      page("p1", "problem_scene", "visual"),
      page("p2", "intuition_visual", "visual"),
      page("p3", "structure_diagram", "visual"),
      page("p4", "interactive_model", "interaction"),
      page("p5", "interactive_model", "interaction"),
      page("p6", "quiz", "assessment"),
      page("p7", "misconception_check", "assessment"),
      page("p8", "summary_card", "visual")
    ],
    misconceptions: [{ id: "m1", statement: "哈希表永远 O(1)", correction: "冲突严重时会变慢。" }],
    transferTasks: [{ id: "t1", prompt: "迁移到缓存 key 设计", targetMentalModel: "用搜索空间缩小解释加速。" }],
    summary: ["哈希表用 key 缩小搜索空间。"]
  };
}

function page(id: string, type: string, kind: "visual" | "interaction" | "assessment"): Record<string, unknown> {
  const base = {
    id,
    type,
    title: `${id} 中文页`,
    learningGoal: id === "p1" ? "解释哈希表访问路径" : "建立理解",
    narrative: "中文内容"
  };
  if (kind === "visual") {
    return { ...base, visualSpec: { kind: "diagram", description: "中文图示", keyElements: ["元素一"] } };
  }
  if (kind === "interaction") {
    return {
      ...base,
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择路径",
        expectedObservation: "看到变化",
        cognitivePurpose: "理解因果",
        options: [
          {
            id: "a",
            label: "选择 A",
            resultTitle: "结果",
            outcomeId: "a",
            resultTone: "success",
            explanation: "因为候选范围变小。"
          }
        ]
      }
    };
  }
  return {
    ...base,
    assessmentSpec: {
      kind: "multiple_choice",
      prompt: "哪个更好？",
      options: ["中文选项 A", "中文选项 B"],
      correctAnswer: "中文选项 A"
    },
    feedbackSpec: {
      correctFeedback: "正确，因为解释了机制。",
      incorrectFeedback: "不对，需要看机制。"
    }
  };
}
