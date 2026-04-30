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

Preferred local install:

```bash
npm run codex:mcp:install
npm run codex:mcp:check
```

If the Codex environment uses TOML-style MCP server config, use:

```toml
[mcp_servers.learningAgent]
command = "npm"
args = ["run", "mcp"]
cwd = "/Users/dm/Documents/the learning agent"
```

If the Codex environment manages MCP servers through the app UI, add a stdio server with:

```text
Name: learningAgent
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

## Default Learner-First Tools

Default clients should prefer these learner-facing tools:

```text
learning_agent.create_learning_project
learning_agent.publish_learning_course
learning_agent.get_learning_preview
learning_agent.generate_quick_preview
```

The default client flow is:

```text
Clarify learning request
  -> create_learning_project
  -> Codex/Claude generates Chinese coursePack + lessons
  -> publish_learning_course
  -> get_learning_preview
  -> user opens npm run dev
```

Do not ask learners to approve `source-map`, `concept-map`, or `curriculum-plan`.

Only when the user explicitly asks for "专家审查模式 / 查看内部 artifacts / 调试生成流程" should the client use `plan_run`, `read_artifact`, `approve_gate`, `run_course`, and other advanced/operator tools.

## Manual JSON-RPC Smoke

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"learning_agent.create_learning_project","arguments":{"request":"请生成哈希表中文学习材料，面向有编程基础的学习者，每个单元 8 页。","runId":"mcp-jsonrpc-smoke"}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"mcp-jsonrpc-smoke"}}}' \
  | npm run mcp
```

Expected result:

- `tools/list` starts with learner-facing tools.
- `create_learning_project` writes `runs/mcp-jsonrpc-smoke/learner-project.json`.
- `get_learning_preview` returns `not_published` until a course is published.

## Advanced/operator Mode

For a source-backed expert review flow, the MCP client can call advanced/operator tools in this order:

```text
learning_agent.plan_run
learning_agent.init_from_plan
learning_agent.beta_status
learning_agent.run_until_gate
learning_agent.approve_gate for source-map
learning_agent.beta_status
learning_agent.run_until_gate
learning_agent.approve_gate for concept-map
learning_agent.run_until_gate
learning_agent.approve_gate for curriculum-plan
learning_agent.run_course
learning_agent.beta_status
learning_agent.approve_gate for each child learning-architecture
learning_agent.run_course
learning_agent.approve_gate for each child lesson
learning_agent.run_course
learning_agent.approve_gate for each child critic-report
learning_agent.promote_units
```

This is not the default learner flow. It is intended for operators who want to inspect gated artifacts, audit source mapping, or debug generation.

`learning_agent.beta_status` is the preferred status primitive for interactive clients. It is intentionally smaller than `read_artifact`; use it to decide the next action, then use `read_artifact` only for the specific gated artifact being reviewed. Clients should prefer the structured `operatorHints.nextToolCalls` and `operatorHints.reviewQueue` fields over parsing the human-readable `nextActions` text.

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
