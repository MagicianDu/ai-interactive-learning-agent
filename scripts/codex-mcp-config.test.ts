import { describe, expect, test } from "vitest";

import {
  buildLearningAgentMcpToml,
  hasLearningAgentMcpServer,
  upsertLearningAgentMcpServer
} from "./codex-mcp-config";

describe("Codex MCP config helpers", () => {
  test("builds the learningAgent MCP server TOML snippet", () => {
    expect(buildLearningAgentMcpToml("/path/to/ai-interactive-learning-agent")).toContain("[mcp_servers.learningAgent]");
    expect(buildLearningAgentMcpToml("/path/to/ai-interactive-learning-agent")).toContain(
      'cwd = "/path/to/ai-interactive-learning-agent"'
    );
  });

  test("inserts the learningAgent server without changing existing servers", () => {
    const existing = [
      'model = "gpt-5.5"',
      "",
      "[mcp_servers.mlResearchLoop]",
      'command = "/usr/bin/python3"',
      'args = ["/tmp/server.py"]',
      ""
    ].join("\n");

    const updated = upsertLearningAgentMcpServer(existing, "/repo");

    expect(updated).toContain("[mcp_servers.mlResearchLoop]");
    expect(updated).toContain("[mcp_servers.learningAgent]");
    expect(updated).toContain('cwd = "/repo"');
  });

  test("replaces an existing learningAgent server idempotently", () => {
    const once = upsertLearningAgentMcpServer("", "/repo");
    const twice = upsertLearningAgentMcpServer(once, "/repo");

    expect(twice.match(/\[mcp_servers\.learningAgent\]/g)).toHaveLength(1);
    expect(hasLearningAgentMcpServer(twice, "/repo")).toBe(true);
  });
});
