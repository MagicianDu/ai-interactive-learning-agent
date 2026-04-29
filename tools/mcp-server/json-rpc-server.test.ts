import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

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

  test("lists learning agent tools using MCP tools/list", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const response = await handleMcpRequest({ jsonrpc: "2.0", id: "tools", method: "tools/list" }, tools);

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "tools",
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "learning_agent.plan_run" }),
          expect.objectContaining({ name: "learning_agent.init_from_plan" }),
          expect.objectContaining({ name: "learning_agent.run_next" })
        ])
      }
    });
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

  test("serializes one stdio JSON-RPC line response", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-rpc-")));

    const line = await handleMcpLine(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }), tools);

    expect(JSON.parse(line ?? "{}")).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: expect.arrayContaining([expect.objectContaining({ name: "learning_agent.plan_run" })])
      }
    });
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
