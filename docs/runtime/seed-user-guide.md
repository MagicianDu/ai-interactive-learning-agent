# Seed User Guide

这份指南面向第一批试用者和操作员，用来验证 AI Interactive Learning Agent 是否能把技术资料生成中文互动学习材料。

## 1. 产品做什么

AI Interactive Learning Agent 把书籍、论文、专利、博客、笔记和文档目录转成结构化学习项目。默认目标不是复述资料，而是生成总览课、核心 topic 课、可视化解释、互动练习、误区检查、迁移任务、教师材料和实验视图。

## 2. 使用 Web 工作区

1. 运行 `npm run dev`。
2. 打开 `http://127.0.0.1:5173/`。
3. 首页先确认产品定位和支持的资料类型。
4. 点击 `创建学习项目` 生成 Codex 可执行的中文请求。
5. 点击 `查看示例课程` 进入课程工作区。
6. 在工作区切换 `学习 / 知识地图 / 练习 / 教师 / 实验 / 导师`。
7. 用 `分享输出` 面板复制介绍文案或导出 lesson JSON。

## 3. 创建项目提示词

首页的创建面板会生成两种入口：

- Codex 自然语言请求：适合直接贴给 Codex 或 Claude。
- CLI 命令：适合本地通过 `npm run agent:plan` 创建计划。

建议默认使用 `总览课 + 核心 topic` 策略。长书不应该只生成 12 页课程，而应该先生成总览课，再按核心 topic 拆成多个单元，每个单元页数由用户指定。

## 4. 连接 Codex 或 Claude

本项目当前提供 MCP stdio 服务：

```bash
npm run mcp
```

Codex 本地安装：

```bash
npm run codex:bundle:install
npm run bundle:check
npm run codex:mcp:check
```

安装后需要重启 Codex 或打开新会话，才能加载 `learningAgent` MCP 服务和配套 skills。完整试用流程见 `docs/runtime/codex-mcp-trial.md`，MCP+skills bundle 说明见 `docs/runtime/mcp-skills-bundle.md`。

查看工具清单：

```bash
npm run mcp -- --list-tools
```

外部客户端应优先调用 learner-facing tools：`learning_agent.create_learning_project`、`learning_agent.get_authoring_context`、`learning_agent.publish_learning_course`、`learning_agent.get_learning_preview`。Codex/Claude 应基于 authoring context 自己创作 coursePack 和 lessons，MCP 负责校验与发布。如果用户看完课程后提出“太难 / 加代码 / 多例子 / 拆细”，调用 `learning_agent.revise_learning_course` 记录反馈，再调用 `learning_agent.apply_learning_revision` 应用修订并重新预览。用户接受后再调用 `learning_agent.export_learning_course`。如果只想快速看低保真 deterministic 样例，可以调用 `learning_agent.generate_grounded_course` 或 `learning_agent.generate_quick_preview`。

真实资料项目发布时必须保留来源依据。`get_authoring_context` 会返回来源锚点和推荐单元；通过 `publish_learning_course` 发布时，lesson 需要包含 `sourceContext.sourceAnchorIds`、页级 source anchors，或显式 inferred/analogy grounding。

## 5. 专家审查模式

默认学习者路径不要让用户审批内部 artifacts。只有当用户明确说“专家审查模式 / 查看内部 artifacts / 调试生成流程”时，才使用 `plan_run`、`read_artifact`、`approve_gate`、`run_course` 这些 advanced/operator tools。

专家审查模式的推荐审核顺序：

1. `source-map`：资料解析和来源锚点是否可信。
2. `concept-map`：核心概念、依赖和误区是否合理。
3. `curriculum-plan`：是否先总览再拆 topic，页数是否符合用户要求。
4. 子课程 `learning-architecture`：学习路径是否从问题开始。
5. 子课程 `lesson`：页面、互动、测验和反馈是否完整。
6. 子课程 `critic-report`：是否满足质量 rubric。

## 6. 查看和分享结果

生成并 promote 后，把 lesson 或 course pack 注册到前端 registry，即可在工作区查看。试用时优先分享：

- Web Deck 的学习路径。
- 知识地图的概念和来源映射。
- 练习模式的反馈解释。
- 教师模式的教学提纲。
- 导出的 lesson JSON。

## 7. 已知 beta 限制

- Web 前端目前不直接发起 MCP 调用，真实执行仍由 Codex、Claude 或 CLI 完成。
- 导师模式是本地规则模拟，不是实时大模型聊天。
- 长文档解析质量依赖来源文本质量和后续 review。
- 当前没有用户账号、云端持久化、权限控制或团队协作。
- 专利和论文的章节结构可能需要人工指定重点。

## Readiness Check

给试用者前运行：

```bash
npm run seed:check
```
