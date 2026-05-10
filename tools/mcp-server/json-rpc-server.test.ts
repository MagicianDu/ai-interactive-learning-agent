import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { publishableLessonFixture } from "../agent-runtime/quality/test-fixtures.js";
import { LearningAgentRuntimeTools } from "./runtime-tools.js";
import { handleMcpLine, handleMcpRequest } from "./json-rpc-server.js";

describe("MCP JSON-RPC server", () => {
  test("responds to initialize with server capabilities", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "vitest", version: "0.0.0" }
        }
      },
      tools
    );

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "ai-interactive-learning-agent"
        }
      }
    });
  });

  test("tools/list defaults to the learner profile", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const response = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, tools);

    expect(response).toMatchObject({ jsonrpc: "2.0", id: 1 });
    const toolNames = toolNamesFromResponse(response);
    expect(toolNames).toEqual([
      "learning_agent.prepare_learning_course",
      "learning_agent.list_learning_projects",
      "learning_agent.archive_learning_project",
      "learning_agent.publish_learning_course",
      "learning_agent.get_learning_preview",
      "learning_agent.revise_learning_course",
      "learning_agent.apply_learning_revision",
      "learning_agent.export_learning_course"
    ]);
    expect(toolNames).not.toContain("learning_agent.plan_run");
    expect(toolNames).not.toContain("learning_agent.generate_quick_preview");
  });

  test("tools/list can expose operator tools through an explicit profile", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const response = await handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, tools, "operator");
    const toolNames = toolNamesFromResponse(response);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        "learning_agent.prepare_learning_course",
        "learning_agent.plan_run",
        "learning_agent.read_artifact",
        "learning_agent.promote_units"
      ])
    );
  });

  test("tools/list can expose authoring tools without operator tools", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const response = await handleMcpRequest({ jsonrpc: "2.0", id: 3, method: "tools/list" }, tools, "authoring");
    const toolNames = toolNamesFromResponse(response);

    expect(toolNames).toEqual([
      "learning_agent.prepare_learning_course",
      "learning_agent.list_learning_projects",
      "learning_agent.archive_learning_project",
      "learning_agent.publish_learning_course",
      "learning_agent.get_learning_preview",
      "learning_agent.revise_learning_course",
      "learning_agent.apply_learning_revision",
      "learning_agent.export_learning_course",
      "learning_agent.create_learning_project",
      "learning_agent.get_authoring_context",
      "learning_agent.compare_authoring_quality",
      "learning_agent.create_quality_revision",
      "learning_agent.generate_grounded_course"
    ]);
    expect(toolNames).not.toContain("learning_agent.plan_run");
    expect(toolNames).not.toContain("learning_agent.read_artifact");
  });

  test("create_learning_project schema exposes difficulty, chapter, and topic selection", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const response = await handleMcpRequest({ jsonrpc: "2.0", id: "tools", method: "tools/list" }, tools, "authoring");
    const listedTools = (response as { result: { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> } }).result.tools;
    const createTool = listedTools.find((tool) => tool.name === "learning_agent.create_learning_project");

    expect(createTool?.inputSchema).toMatchObject({
      properties: {
        difficultyLevel: { type: "string" },
        selectedChapters: { type: "array", items: { type: "string" } },
        selectedTopics: { type: "array", items: { type: "string" } }
      }
    });
  });

  test("prepare_learning_course schema exposes one-call learner inputs", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const response = await handleMcpRequest({ jsonrpc: "2.0", id: "tools", method: "tools/list" }, tools);
    const listedTools = (response as { result: { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> } }).result.tools;
    const prepareTool = listedTools.find((tool) => tool.name === "learning_agent.prepare_learning_course");

    expect(prepareTool?.inputSchema).toMatchObject({
      properties: {
        request: { type: "string" },
        difficultyLevel: { type: "string" },
        courseIntent: { type: "string" },
        unitPages: { type: "number" },
        maxAnchors: { type: "number" }
      },
      required: ["request"]
    });
  });

  test("prepare_learning_course accepts professor lecture course intent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-professor-intent-"));
    const tools = new LearningAgentRuntimeTools(root);

    const prepared = await callMcpTool(tools, "learning_agent.prepare_learning_course", {
      request:
        "请用 /tmp/book.pdf 生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。",
      runId: "professor-intent-mcp",
      sourcePath: "/tmp/book.pdf",
      sourceKind: "book",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 10,
      courseIntent: "professor_lecture_deck"
    });

    expect(prepared).toMatchObject({
      status: "authoring_context_ready",
      runId: "professor-intent-mcp",
      brief: {
        courseIntent: "professor_lecture_deck",
        unitPages: 10
      }
    });
  });

  test("publishes a learner-facing course through MCP without artifact approvals", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-learner-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    const project = await callMcpTool(tools, "learning_agent.create_learning_project", {
      request: "请生成哈希表中文学习材料，面向有编程基础的学习者，教学难度为本科核心课程，每个单元 8 页。",
      runId: "learner-hash"
    });

    expect(project).toMatchObject({ status: "project_ready", runId: "learner-hash" });

    const lesson = publishableLessonFixture({ id: "learner-hash-overview", title: "哈希表：总览课", targetPageCount: 8 });
    const published = await callMcpTool(tools, "learning_agent.publish_learning_course", {
      runId: "learner-hash",
      lessons: [lesson],
      coursePack: {
        id: "learner-hash",
        title: "哈希表：课程包",
        parentRunId: "learner-hash",
        sourceKind: "topic",
        strategy: "overview_plus_topic",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "learner-hash-overview",
            targetPageCount: 8,
            conceptIds: ["hash-table"]
          }
        ]
      }
    });
    const preview = await callMcpTool(tools, "learning_agent.get_learning_preview", { runId: "learner-hash" });

    expect(published).toMatchObject({
      status: "preview_ready",
      preview: { devCommand: "npm run dev", localUrl: "http://127.0.0.1:5173/#/preview/learner-hash" },
      qualityReport: { status: "passed" }
    });
    expect(preview).toMatchObject({
      status: "preview_ready",
      runId: "learner-hash",
      preview: {
        coursePackId: "learner-hash",
        courseTitle: "哈希表：课程包",
        lessonCount: 1
      }
    });
  });

  test("generates a source-grounded learner course through MCP without artifact approvals", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-grounded-mcp-"));
    const sourcePath = path.join(root, "agentic-blog.md");
    await writeFile(sourcePath, "# Agentic RAG\nAgentic RAG 先判断任务，再选择检索、工具调用或生成路径。", "utf8");
    const tools = new LearningAgentRuntimeTools(root);
    await callMcpTool(tools, "learning_agent.create_learning_project", {
      request: `请用 "${sourcePath}" 这篇博客生成中文学习网页，面向中文学习者，教学难度为本科核心课程，每个单元 8 页。`,
      runId: "mcp-grounded-blog",
      sourcePath,
      sourceKind: "blog",
      audience: "中文学习者",
      difficultyLevel: "undergraduate_core",
      unitPages: 8,
      strategy: "task_guided",
      selectedTopics: ["任务判断", "工具选择"]
    });

    const generated = await callMcpTool(tools, "learning_agent.generate_grounded_course", {
      runId: "mcp-grounded-blog"
    });

    expect(generated).toMatchObject({
      status: "preview_ready",
      runId: "mcp-grounded-blog",
      sourceIngest: {
        anchorCount: expect.any(Number)
      },
      preview: { devCommand: "npm run dev", localUrl: "http://127.0.0.1:5173/#/preview/mcp-grounded-blog" },
      qualityReport: {
        status: "warning",
        topIssues: expect.arrayContaining([
          expect.objectContaining({
            issueId: "quality.lesson.blog-practice-depth-shallow"
          })
        ])
      }
    });
    await expect(readFile(path.join(root, "runs", "mcp-grounded-blog", "learning-preview.json"), "utf8")).resolves.toContain(
      "preview_ready"
    );
  });

  test("returns authoring context through MCP tools/call", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-authoring-rpc-"));
    const sourcePath = path.join(root, "source.md");
    await writeFile(sourcePath, "# Agentic RAG\n先判断任务，再决定是否检索、调用工具或生成。", "utf8");
    const tools = new LearningAgentRuntimeTools(root);
    await callMcpTool(tools, "learning_agent.create_learning_project", {
      request: `请用 "${sourcePath}" 生成中文学习网页，面向中文学习者，教学难度为大学高年级/研究生课程，每个单元 8 页。`,
      runId: "rpc-authoring",
      sourcePath,
      sourceKind: "blog",
      audience: "中文学习者",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8
    });

    const context = await callMcpTool(tools, "learning_agent.get_authoring_context", {
      runId: "rpc-authoring",
      maxAnchors: 3
    });

    expect(context).toMatchObject({
      status: "authoring_context_ready",
      runId: "rpc-authoring",
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course"
      },
      coursePlan: {
        recommendedUnits: expect.arrayContaining([expect.objectContaining({ unitId: "unit-overview" })])
      }
    });
  });

  test("prepares a course through MCP tools/call", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-prepare-rpc-"));
    const sourcePath = path.join(root, "prepare-source.md");
    await writeFile(
      sourcePath,
      "# Evaluation\nTool feedback supports reflection. Experiments show reliability improves. Limitations appear without feedback.",
      "utf8"
    );
    const tools = new LearningAgentRuntimeTools(root);

    const prepared = await callMcpTool(tools, "learning_agent.prepare_learning_course", {
      request: `请用 "${sourcePath}" 生成中文学习课程，面向中文工程师，教学难度为大学高年级/研究生课程，每个单元 8 页。`,
      runId: "rpc-prepare",
      sourcePath,
      sourceKind: "notes",
      audience: "中文工程师",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      maxAnchors: 4
    });

    expect(prepared).toMatchObject({
      status: "authoring_context_ready",
      runId: "rpc-prepare",
      next: {
        recommendedTool: "learning_agent.publish_learning_course"
      },
      sourceSemantics: {
        limitationHints: expect.arrayContaining([expect.objectContaining({ statement: expect.stringContaining("Limitations appear") })])
      }
    });
  });

  test("records learner feedback through MCP for course revision", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-learner-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);

    const result = await callMcpTool(tools, "learning_agent.revise_learning_course", {
      runId: "learner-hash",
      feedback: "太抽象了，请加代码例子，并把第一个练习拆简单。",
      focus: "examples"
    });

    expect(result).toMatchObject({
      status: "revision_brief_ready",
      runId: "learner-hash",
      next: { recommendedTool: "learning_agent.publish_learning_course" }
    });
    await expect(readFile(path.join(root, "runs", "learner-hash", "learning-revisions", "revision-001.json"), "utf8")).resolves.toContain(
      "太抽象了"
    );
  });

  test("calls natural-language plan and initialization tools through MCP tools/call", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-"));
    const tools = new LearningAgentRuntimeTools(root);

    const planResponse = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "learning_agent.plan_run",
          arguments: {
            request: "用哈希表生成 8 页中文课，面向有基础编程经验但缺少数据结构心智模型的学习者。",
            runId: "rpc-nl-smoke"
          }
        }
      },
      tools
    );
    const initResponse = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "learning_agent.init_from_plan",
          arguments: {
            runId: "rpc-nl-smoke",
            approve: true
          }
        }
      },
      tools
    );

    expect(parseToolContent(planResponse)).toMatchObject({
      status: "plan_written",
      runId: "rpc-nl-smoke"
    });
    expect(parseToolContent(initResponse)).toMatchObject({
      status: "initialized",
      runId: "rpc-nl-smoke",
      topic: "哈希表"
    });
    await expect(readFile(path.join(root, "runs", "rpc-nl-smoke", "run.config.json"), "utf8")).resolves.toContain(
      "哈希表"
    );
  });

  test("runs a source-backed course pack from natural language to promoted units through MCP JSON-RPC", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-e2e-"));
    const sourcePath = path.join(root, "agentic-notes.md");
    await writeFile(
      sourcePath,
      "# 第一章 总览\n智能体系统需要任务分解、工具调用和审核点。\n\n## 工具使用\n工具扩大动作空间，但结果必须验证。\n\n## 多智能体审核\n多智能体适合边界清晰且中间产物可审查的任务。",
      "utf8"
    );
    const tools = new LearningAgentRuntimeTools(root);
    const runId = "rpc-course-e2e";

    await callMcpTool(tools, "learning_agent.plan_run", {
      request: `用 "${sourcePath}" 这本书生成中文课程：先做总览课，再按核心 topic 拆课。每个单元 8 页，面向有基础编程经验但缺少智能体系统心智模型的中文学习者。`,
      runId,
      adapter: "mock"
    });
    await callMcpTool(tools, "learning_agent.init_from_plan", { runId, approve: true });
    const initialBetaStatus = await callMcpTool(tools, "learning_agent.beta_status", { runId });
    expect(initialBetaStatus).toMatchObject({
      status: "beta_status",
      runId,
      parent: {
        approvedGates: []
      },
      childRuns: []
    });
    expect(JSON.stringify(initialBetaStatus).length).toBeLessThan(15000);

    for (const gate of ["source-map", "concept-map", "curriculum-plan"]) {
      const result = await callMcpTool(tools, "learning_agent.run_until_gate", { runId, maxSteps: 10 });
      expect(result).toMatchObject({ finalStatus: "approval_required", requiredGate: gate });
      await callMcpTool(tools, "learning_agent.approve_gate", { runId, gate, version: "v1" });
    }

    const units = await callMcpTool(tools, "learning_agent.list_units", { runId });
    expect(units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "unit-overview", targetPageCount: 8, sourceAnchorCount: expect.any(Number) }),
        expect.objectContaining({ id: "unit-topic-01", targetPageCount: 8, sourceAnchorCount: expect.any(Number) })
      ])
    );
    for (const unit of expectRecordArray(units)) {
      expect(unit).not.toHaveProperty("sourceAnchorIds");
    }

    const firstCourseRun = expectRecordResponse(
      await callMcpTool(tools, "learning_agent.run_course", { runId, unitSelector: "all", maxSteps: 20 })
    );
    const courseBetaStatus = await callMcpTool(tools, "learning_agent.beta_status", { runId });
    expect(firstCourseRun).toMatchObject({ status: "course_orchestrated", parentRunId: runId });
    expect(courseBetaStatus).toMatchObject({
      status: "beta_status",
      runId,
      parent: {
        approvedGates: expect.arrayContaining(["source-map", "concept-map", "curriculum-plan"])
      },
      childRuns: expect.arrayContaining([
        expect.objectContaining({ unitId: "unit-overview", currentGate: "learning-architecture" })
      ])
    });
    expect(JSON.stringify(courseBetaStatus).length).toBeLessThan(15000);
    for (const unit of expectRecordArray(firstCourseRun.units)) {
      expect(unit).not.toHaveProperty("sourceAnchorIds");
      expect(unit).toHaveProperty("sourceAnchorSample");
    }
    for (const childRun of expectRecordArray(firstCourseRun.childRuns)) {
      expect(childRun).toMatchObject({ finalStatus: "approval_required" });
      await callMcpTool(tools, "learning_agent.approve_gate", {
        runId: expectString(childRun.runId),
        gate: "learning-architecture",
        version: "v1"
      });
    }

    const secondCourseRun = expectRecordResponse(
      await callMcpTool(tools, "learning_agent.run_course", { runId, unitSelector: "all", maxSteps: 20 })
    );
    for (const childRun of expectRecordArray(secondCourseRun.childRuns)) {
      expect(childRun).toMatchObject({ finalStatus: "approval_required" });
      await callMcpTool(tools, "learning_agent.approve_gate", {
        runId: expectString(childRun.runId),
        gate: "lesson",
        version: "v1"
      });
    }

    const thirdCourseRun = expectRecordResponse(
      await callMcpTool(tools, "learning_agent.run_course", { runId, unitSelector: "all", maxSteps: 20 })
    );
    for (const childRun of expectRecordArray(thirdCourseRun.childRuns)) {
      expect(childRun).toMatchObject({ finalStatus: "approval_required" });
      await callMcpTool(tools, "learning_agent.approve_gate", {
        runId: expectString(childRun.runId),
        gate: "critic-report",
        version: "v1"
      });
    }

    const promoted = await callMcpTool(tools, "learning_agent.promote_units", { runId, unitSelector: "all" });

    expect(promoted).toMatchObject({
      status: "unit_runs_promoted",
      parentRunId: runId,
      childRuns: expect.arrayContaining([
        expect.objectContaining({ unitId: "unit-overview", lessonId: `${runId}-unit-overview` }),
        expect.objectContaining({ unitId: "unit-topic-01", lessonId: `${runId}-unit-topic-01` })
      ])
    });
    await expect(readFile(path.join(root, "src", "course-packs", runId, "coursePack.ts"), "utf8")).resolves.toContain(
      "unit-overview"
    );
  });

  test("serializes one stdio JSON-RPC line response", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const line = await handleMcpLine(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }), tools);

    expect(JSON.parse(line ?? "{}")).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: expect.arrayContaining([expect.objectContaining({ name: "learning_agent.prepare_learning_course" })])
      }
    });
    expect(JSON.parse(line ?? "{}").result.tools).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "learning_agent.plan_run" })])
    );
  });
});

function parseToolContent(response: unknown): unknown {
  const content = (response as { result?: { content?: Array<{ text?: string }> } }).result?.content;
  const text = content?.[0]?.text;
  if (!text) {
    throw new Error("expected text tool content");
  }
  return JSON.parse(text) as unknown;
}

async function callMcpTool(
  tools: LearningAgentRuntimeTools,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const response = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: name,
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    },
    tools
  );

  return parseToolContent(response);
}

function expectRecordResponse(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected object response");
  }
  return value as Record<string, unknown>;
}

function expectRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) {
    throw new Error("expected record array");
  }
  return value as Array<Record<string, unknown>>;
}

function expectString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("expected string");
  }
  return value;
}

function toolNamesFromResponse(response: Awaited<ReturnType<typeof handleMcpRequest>>): string[] {
  if (!response || !("result" in response)) {
    throw new Error("expected tools/list result");
  }
  const result = response.result as { tools: Array<{ name: string }> };
  return result.tools.map((tool) => tool.name);
}
