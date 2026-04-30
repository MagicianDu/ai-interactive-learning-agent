# Seed User Prompt Pack

下面提示词可直接贴给 Codex 或 Claude。默认是 learner-first：生成中文学习网页，不要求用户审批内部 artifacts。

## Book -> Learner-First Publish

```text
请使用 learningAgent MCP 服务帮我把这本书生成中文学习网页。
资料是：/absolute/path/to/book.pdf
我希望先有总览课，再按核心 topic 拆课。每个单元 8 页，面向有基础编程经验但还没有建立该领域心智模型的中文学习者。
请先问我最多 3 个你必须知道的问题。明确后，不要让我审批 source-map、concept-map、curriculum-plan 这些内部 artifacts。
你可以直接生成 course bundle，然后调用 learning_agent.publish_learning_course 发布网页。
发布后告诉我运行 npm run dev，并说明我应该打开哪个页面查看。
```

## Paper -> Learner-First Publish

```text
请使用 learningAgent MCP 服务把这篇论文生成中文学习网页。
资料是：/absolute/path/to/paper.pdf
目标是帮助我理解论文问题、方法贡献、关键假设、实验逻辑、局限和可复现路径。
请先做总览课，再按 method、experiment、limitation、transfer 拆成核心 topic。每个单元 6 到 8 页。
不要让我审批内部 artifacts。你可以直接生成中文 course bundle，并调用 learning_agent.publish_learning_course 发布网页。
```

## Patent -> Learner-First Publish

```text
请使用 learningAgent MCP 服务把这份专利生成中文学习网页。
资料是：/absolute/path/to/patent.pdf
重点是权利要求地图、技术方案结构、实施例解释、关键术语和与常见方案的差异。
请先做总览课，再按 claims、embodiments、technical-solution、risk-and-transfer 拆课。每个单元 6 页。
默认不要进入专家审核流程；请直接生成 course bundle，并调用 learning_agent.publish_learning_course 发布网页。
```

## Blog -> Learner-First Publish

```text
请使用 learningAgent MCP 服务把这篇技术博客生成中文互动学习网页：https://example.com/blog-post
目标是把博客里的实践步骤重构成可操作教程，而不是简单总结。
请生成 8 页 lesson，包含问题场景、流程图、至少两个学习者动作、一个误区检查、一个迁移任务和总结卡。
如果博客缺少背景知识，请明确 prerequisite assumptions，不要编造来源中没有的结论。
请发布后告诉我运行 npm run dev，并说明打开哪个页面。
```

## Quick Local Preview -> generate_quick_preview

```text
我想先快速看一下产品形态，不要求最终内容质量。
请调用 learning_agent.create_learning_project 记录需求，然后调用 learning_agent.generate_quick_preview 生成 deterministic 本地预览。
如果 quick preview 被质量门禁阻断，请告诉我阻塞原因，并建议切换到 Codex-authored publish_learning_course 路径。
```

## Learner Feedback -> revise_learning_course

```text
我已经看了网页，整体太难了。请保留中文解释和来源依据，把第一个单元拆得更慢一点，多加一个代码例子和一个生活化类比。
请调用 learning_agent.revise_learning_course 记录我的反馈，然后根据 revision brief 修订 course bundle，再调用 learning_agent.publish_learning_course 发布新版网页。
```

## Expert Review Mode -> Advanced Tools

```text
我明确要进入专家审查模式。请使用 learningAgent MCP 的 advanced/operator tools。
请先调用 learning_agent.plan_run 生成可审核计划，向我总结 reviewItems，等我确认后再调用 init_from_plan。
后续使用 beta_status 查看 reviewQueue 和 operatorHints.nextToolCalls。
遇到 source-map、concept-map、curriculum-plan、lesson、critic-report 等 gate 时，请读取对应 artifact，总结来源证据和风险，再等我明确 approve 或 revise。
```
