# Codex MCP Trial Guide

这份文档是种子用户从 Codex 试用 `learningAgent` MCP 服务的默认路径。默认体验面向学习者：先澄清学习需求，包括教学难度层级，然后快速发布中文网页课程；不要让学习者审批 `source-map`、`concept-map`、`curriculum-plan` 这些内部 artifacts。

## 1. 安装本地 MCP 和 Skills

在项目根目录运行：

```bash
npm run codex:bundle:install
npm run bundle:check
npm run codex:mcp:check
```

`codex:bundle:install` 会备份 `~/.codex/config.toml`，安装 MCP 配置，并把本项目的学习代理 skills 复制到 `~/.codex/skills/`。

MCP 配置形如：

```toml
[mcp_servers.learningAgent]
command = "npm"
args = ["run", "mcp"]
cwd = "/path/to/ai-interactive-learning-agent"
```

安装后重启 Codex 或打开一个新的 Codex 会话，让 MCP server 和 skills 列表重新加载。

## 2. 检查安装

```bash
npm run bundle:check
npm run codex:mcp:check
```

期望看到 `learning_agent.create_learning_project`、`learning_agent.get_authoring_context`、`learning_agent.publish_learning_course`、`learning_agent.get_learning_preview`、`learning_agent.revise_learning_course`、`learning_agent.apply_learning_revision` 和 `learning_agent.export_learning_course`。

## 3. 默认 Codex 试用 Prompt

在新的 Codex 会话里使用：

```text
请使用 learningAgent MCP 服务帮我生成中文学习网页。
资料是：/absolute/path/to/source.pdf
我希望先有总览课，再按核心 topic 拆课。每个单元 8 页。
教学难度可以先问我；可选层级包括入门衔接、本科核心课程、大学高年级/研究生课程、研究论文精读/前沿讨论。
请先问我最多 3 个你必须知道的问题。明确后，不要让我审批 source-map、concept-map、curriculum-plan 这些内部 artifacts。
你可以直接调用 learning_agent.create_learning_project，然后调用 learning_agent.get_authoring_context 获取来源锚点、推荐单元和发布约束。请由 Codex 创作 coursePack 与 lessons，再调用 learning_agent.publish_learning_course 发布课程网页。
发布后告诉我运行 npm run dev，并说明我应该打开哪个页面查看。
```

Codex 应该优先调用：

```text
learning_agent.create_learning_project
learning_agent.get_authoring_context
learning_agent.publish_learning_course
learning_agent.get_learning_preview
learning_agent.revise_learning_course
learning_agent.apply_learning_revision
learning_agent.export_learning_course
```

如果只是想先看低保真 deterministic 草稿，Codex 可以调用：

```text
learning_agent.generate_grounded_course
learning_agent.generate_quick_preview
```

## 4. Learner-First 规则

默认情况下，Codex 不应要求用户审批内部 artifacts。用户是来学习的，不是来审查生成流水线的。

只有当用户明确说“专家审查模式 / 查看内部 artifacts / 调试生成流程”时，Codex 才使用 `plan_run`、`read_artifact`、`approve_gate`、`run_course` 这些 advanced/operator tools。

## 5. 预览方式

发布成功后，MCP 会返回：

```text
npm run dev
http://127.0.0.1:5173/
```

打开页面后，在课程包列表中选择新生成的课程包。如果页面仍显示旧内容，刷新浏览器或重启 Vite dev server。

## 6. 反馈迭代

用户看到网页后，可以直接用自然语言反馈，例如：

```text
太难了，请减少术语，多给生活化例子。
```

Codex 应调用 `learning_agent.revise_learning_course` 记录反馈，再调用 `learning_agent.apply_learning_revision` 应用当前支持的目标修订，最后调用 `learning_agent.get_learning_preview` 让用户查看新版网页。如果反馈超出自动修订范围，Codex 可以进入手写修订并通过 `publish_learning_course` 重新发布；来自书籍、论文、专利或博客的课程仍必须保留 `sourceContext.sourceAnchorIds` 或页级来源锚点。

## 7. 当前 Beta 边界

- MCP 服务是本地 stdio 服务，不是网络服务。
- 默认高质量路径由 Codex 创作 source-grounded course bundle；MCP 负责准备 authoring context、校验、发布和导出。
- `generate_grounded_course` 是 deterministic draft，不代表最终内容质量。
- `generate_quick_preview` 是 deterministic smoke，用于快速看产品形态，不代表最终内容质量。
- Advanced/operator 工具仍保留，用于调试、审计来源映射和专家审核。
