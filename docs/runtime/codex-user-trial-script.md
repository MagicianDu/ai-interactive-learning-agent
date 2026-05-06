# Codex / Claude User Trial Script

Use this script to trial the learner-facing MCP path from a fresh AI client session.

The default flow should feel like a conversation about learning needs, not artifact approval. The agent should ask at most three learner-answerable clarification questions, then create a project, gather authoring context, publish a clean preview, and return a preview URL plus compact quality summary.

## Book

```text
我有一本技术书，想生成中文互动学习网页。先给总览课，再按核心 topic 拆课，每个单元 8 页。面向有基础编程经验但还没有系统心智模型的中文学习者。

资料路径：<book path>
```

Expected MCP path:

```text
learning_agent.create_learning_project
learning_agent.get_authoring_context
learning_agent.publish_learning_course
learning_agent.get_learning_preview
```

Expected response:

```text
预览地址：http://127.0.0.1:5173/#/preview/<run-id>
课程结构：总览 + topic 单元，8 页/单元
质量摘要：status/score/checks/requiredFixCount
下一步：打开预览后告诉我哪一页太抽象、例子不够、来源依据不清楚，或希望更难/更简单。
```

## Paper

```text
这是一篇论文 PDF，请生成中文学习材料。先讲研究问题和方法心智模型，再拆核心机制、证据和局限，每个单元 8 页，适合有工程背景但没有读过这篇论文的人。

资料路径：<paper path>
```

## Patent

```text
这是一份专利资料，请生成中文学习网页。先给总览，再按问题、权利要求、机制、实施例和应用边界拆课。每个单元 6 页，面向技术产品经理。

资料路径或 URL：<patent path or URL>
```

## Blog

```text
这是一篇技术博客，请生成中文互动学习网页。先给总览，再按核心 pattern、实现步骤、常见误区和迁移任务拆课。每个单元 6 页，面向有基础开发经验的学习者。

URL：<blog URL>
```

## Pasted Source

```text
下面是我整理的技术笔记，请生成中文互动学习网页。先给总览，再按核心 topic 拆课，每个单元 6 页，要求有练习和误区检查。

<paste source text>
```

## Feedback Round

After the preview is open, use learner-visible feedback:

```text
第 3 页太抽象，例子不够工程化；第 5 页来源依据不清楚。请修订后给我新的预览链接。
```

Expected MCP path:

```text
learning_agent.revise_learning_course
learning_agent.apply_learning_revision
learning_agent.get_learning_preview
```

## Guardrails

- Do not ask learners to approve `source-map`, `concept-map`, `curriculum-plan`, or `critic-report`.
- Do not paste raw nested artifacts into the normal answer.
- Do not write generated preview output under `src/` unless maintaining sample fixtures.
- Return the preview URL and compact `qualityReport` summary.
- Keep generated content Chinese-first unless the learner explicitly requests another language.
