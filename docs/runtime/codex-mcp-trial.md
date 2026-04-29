# Codex MCP Trial Guide

This guide is the seed-user path for trying AI Interactive Learning Agent from Codex as an MCP service.

## 1. Install The Local MCP Server Into Codex

From the project root:

```bash
npm run codex:mcp:install
```

This command:

1. Backs up `~/.codex/config.toml`.
2. Adds this MCP server:

```toml
[mcp_servers.learningAgent]
command = "npm"
args = ["run", "mcp"]
cwd = "/Users/dm/Documents/the learning agent"
```

3. Verifies `npm run mcp -- --list-tools` exposes `learning_agent.plan_run` and `learning_agent.beta_status`.

After install, restart Codex or open a new Codex session so the MCP server list is reloaded.

## 2. Check Installation

```bash
npm run codex:mcp:check
```

Expected output includes:

```text
[codex:mcp] learningAgent config is installed
[codex:mcp] MCP tool list includes learning_agent.plan_run and learning_agent.beta_status
```

## 3. First Codex Trial Prompt

Use this in a new Codex session after the MCP server is loaded:

```text
请使用 learningAgent MCP 服务，把这份资料生成中文学习项目：/absolute/path/to/source.pdf
先给一个总览课，再按核心 topic 拆课。每个单元 8 页，面向有基础编程经验但缺少该领域心智模型的中文学习者。
请先调用 learning_agent.plan_run 生成可审核计划，向我总结 reviewItems，等我确认后再调用 init_from_plan。
后续每次调用 beta_status，根据 operatorHints.reviewQueue 和 nextToolCalls 说明下一步。遇到 reviewQueue 不要自动 approve。
```

## 4. Expected Codex Tool Loop

Codex should drive the MCP service in this order:

```text
learning_agent.plan_run
learning_agent.init_from_plan
learning_agent.beta_status
learning_agent.run_until_gate
learning_agent.read_artifact
learning_agent.approve_gate or learning_agent.revise_gate
learning_agent.run_course
learning_agent.promote_units
```

`learning_agent.beta_status` is the main interactive status tool. Use `read_artifact` only for the exact artifact being reviewed.

## 5. Current Beta Limits

- Codex loads MCP servers when a session starts; an already-open session may not see new servers until restart.
- The MCP service is local stdio. It does not host a network endpoint.
- Real content generation can still require Codex manual artifacts when using `codex-manual`; deterministic smoke tests use `mock`.
- Frontend viewing still uses `npm run dev`; MCP drives generation and promotion.
