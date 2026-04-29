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
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"learning_agent.plan_run","arguments":{"request":"用哈希表生成 8 页中文课，面向有基础编程经验但缺少数据结构心智模型的学习者。","runId":"mcp-jsonrpc-smoke"}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"learning_agent.init_from_plan","arguments":{"runId":"mcp-jsonrpc-smoke","approve":true}}}' \
  | npm run mcp
```

Expected result:

- `tools/list` includes `learning_agent.plan_run` and `learning_agent.init_from_plan`.
- `plan_run` writes `runs/mcp-jsonrpc-smoke/run.plan.json`.
- `init_from_plan` writes `runs/mcp-jsonrpc-smoke/run.config.json`.

Remove the smoke run after verification:

```bash
rm -rf runs/mcp-jsonrpc-smoke
```
