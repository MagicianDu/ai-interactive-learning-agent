# MCP Client Setup

This project exposes the learning-agent runtime as a local stdio MCP server.

## Server Command

Use the project root as the working directory:

```bash
npm run mcp
```

The server supports:

- `initialize`
- `ping`
- `tools/list`
- `tools/call`
- `notifications/*` without a response

## Generic MCP Configuration

```json
{
  "mcpServers": {
    "learning-agent": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/Users/dm/Documents/the learning agent"
    }
  }
}
```

## Codex Configuration Shape

If the Codex environment uses TOML-style MCP server config, use:

```toml
[mcp_servers.learning-agent]
command = "npm"
args = ["run", "mcp"]
cwd = "/Users/dm/Documents/the learning agent"
```

If the Codex environment manages MCP servers through the app UI, add a stdio server with:

```text
Name: learning-agent
Command: npm
Arguments: run mcp
Working directory: /Users/dm/Documents/the learning agent
```

## Claude Desktop Configuration Shape

Claude Desktop commonly uses a JSON config shape:

```json
{
  "mcpServers": {
    "learning-agent": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/Users/dm/Documents/the learning agent"
    }
  }
}
```

## Manual JSON-RPC Smoke

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"learning_agent.plan_run","arguments":{"request":"用哈希表生成 8 页中文课，面向有基础编程经验但缺少数据结构心智模型的学习者。","runId":"mcp-jsonrpc-smoke","adapter":"mock"}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"learning_agent.init_from_plan","arguments":{"runId":"mcp-jsonrpc-smoke","approve":true}}}' \
  '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"learning_agent.run_until_gate","arguments":{"runId":"mcp-jsonrpc-smoke","maxSteps":5}}}' \
  '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"learning_agent.read_artifact","arguments":{"runId":"mcp-jsonrpc-smoke","artifactId":"source-map","version":"v1"}}}' \
  | npm run mcp
```

Expected result:

- `tools/list` includes `learning_agent.plan_run` and `learning_agent.init_from_plan`.
- `plan_run` writes `runs/mcp-jsonrpc-smoke/run.plan.json`.
- `init_from_plan` writes `runs/mcp-jsonrpc-smoke/run.config.json`.
- `run_until_gate` advances to the first approval gate. The smoke uses `adapter: "mock"` so it can produce local artifacts without a manual Codex role prompt.
- `read_artifact` returns the generated `source-map.v1.json` payload.

For a source-backed course-pack flow, the MCP client should call the same high-level tools in this order:

```text
learning_agent.plan_run
learning_agent.init_from_plan
learning_agent.run_until_gate
learning_agent.approve_gate for source-map
learning_agent.run_until_gate
learning_agent.approve_gate for concept-map
learning_agent.run_until_gate
learning_agent.approve_gate for curriculum-plan
learning_agent.run_course
learning_agent.approve_gate for each child learning-architecture
learning_agent.run_course
learning_agent.approve_gate for each child lesson
learning_agent.run_course
learning_agent.approve_gate for each child critic-report
learning_agent.promote_units
```

This is the intended Codex/Claude control loop: the chat agent interprets the user's natural language request, shows gated artifacts for review, then advances or revises the runtime through MCP calls.

`learning_agent.list_units` and `learning_agent.run_course` return summarized source mapping fields instead of the full `sourceAnchorIds` list:

```json
{
  "id": "unit-overview",
  "title": "总览课",
  "targetPageCount": 8,
  "sourceAnchorCount": 1582,
  "sourceAnchorSample": ["source-001:page-1", "source-001:paragraph-page-1-1"],
  "sourceNodeCount": 481,
  "sourceNodeSample": ["source-001:root"]
}
```

Use `learning_agent.read_artifact` on `curriculum-plan` when the operator needs the complete source anchor list for audit or debugging.

Remove the smoke run after verification:

```bash
rm -rf runs/mcp-jsonrpc-smoke
```
