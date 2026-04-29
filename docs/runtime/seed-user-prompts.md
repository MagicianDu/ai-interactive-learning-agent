# Seed User Prompt Pack

下面提示词可直接贴给 Codex 或 Claude。默认要求中文输出、保留来源映射、关键节点人工审核。

## Book -> Overview Plus Topic Course Pack

```text
请用这本书生成一套中文学习材料：/absolute/path/to/book.pdf
先给一个总览课，再按核心 topic 拆成多个课程单元。每个单元 8 页，面向有基础编程经验但还没有建立该领域心智模型的中文学习者。
请保留章节和来源映射，生成 source-map、concept-map 和 curriculum-plan 后先让我审核。
遇到 reviewQueue 时不要自动 approve。审核通过后再继续生成各 topic 的互动 Web lesson、练习、误区检查、迁移任务和教师材料。
```

## Paper -> Method And Experiment Learning Path

```text
请用这篇论文生成中文学习材料：/absolute/path/to/paper.pdf
目标是帮助学习者理解论文问题、方法贡献、关键假设、实验逻辑、局限和可复现路径。
先做一节总览课，再按 method、experiment、limitation、transfer 拆成 topic 单元。每个单元 6 到 8 页。
保留论文段落、图表和实验结果的来源映射。source-map、concept-map、curriculum-plan 需要我审核后再继续。
```

## Patent -> Claim And Embodiment Map

```text
请用这份专利生成中文学习材料：/absolute/path/to/patent.pdf
重点生成权利要求地图、技术方案结构、实施例解释、关键术语和与常见方案的差异。
先生成总览课，再按 claims、embodiments、technical-solution、risk-and-transfer 拆课。每个单元 6 页。
请保留 claims、实施例和说明书段落的来源映射。关键节点先进入 reviewQueue，不要自动 approve。
```

## Blog -> Practical Tutorial Lesson

```text
请用这篇技术博客生成中文互动学习材料：https://example.com/blog-post
目标是把博客里的实践步骤重构成可操作教程，而不是简单总结。
请生成 8 页 lesson，包含问题场景、流程图、至少两个学习者动作、一个误区检查、一个迁移任务和总结卡。
如果博客缺少背景知识，请明确 prerequisite assumptions，不要编造来源中没有的结论。
```

## Continue Existing Run -> Beta Status And Operator Hints

```text
请继续这个学习项目 run：RUN_ID_HERE。
先调用 beta_status 查看 parent approvedGates、reviewQueue、childRuns 和 operatorHints.nextToolCalls。
如果 reviewQueue 非空，请先总结每个待审核产物、来源证据和建议处理方式，不要自动 approve。
如果 operatorHints.nextToolCalls 给出下一步，请说明将调用哪个 MCP tool、输入是什么、预期会推进到哪个 gate，然后等我确认。
```
