# Codex / Claude User Trial Script

Use this script to trial the learner-facing MCP path from a fresh AI client session.

The default learner profile should feel like a conversation about learning needs, not artifact approval. The agent should ask at most three learner-answerable clarification questions, including teaching difficulty and pages per unit when missing, then prepare the course, publish a clean preview, and return a preview URL plus compact quality summary.

## Book

```text
我有一本技术书，想生成中文互动学习网页。先给总览课，再按核心 topic 拆课，每个单元 8 页。面向有基础编程经验但还没有系统心智模型的中文学习者。教学难度定位为大学高年级/研究生课程。

资料路径：<book path>
```

Expected MCP path:

```text
learning_agent.prepare_learning_course
learning_agent.publish_learning_course
learning_agent.get_learning_preview
```

Expected authoring behavior:

```text
Codex should inspect prepare_learning_course.coursePlan and contentBlueprint.units[*].pageBlueprints before writing lessons.
Each lesson page should follow the blueprint's pageType, learnerAction, visualRequirement, feedbackRequirement, and sourceRequirement.
If publish_learning_course returns publish.blueprint.* issues, Codex should revise the lesson directly instead of asking the learner to approve internal artifacts.
For long books, get_authoring_context should surface content anchors instead of table-of-contents or dedication anchors; if the first anchors are front matter, revise the source sampling before authoring.
Course posture must follow the learner's stated difficulty level. For upper-undergraduate / graduate requests, include prerequisites, formal terms, source reading anchors, classroom discussion prompts, and homework-style transfer tasks.
If the user explicitly asks for advanced authoring comparison, use the advanced authoring profile and call compare_authoring_quality after publish so the response can state what Codex-authored content improved, what still needs revision, and which `revisionInstructions` Codex will follow next.
```

Expected response:

```text
预览地址：http://127.0.0.1:5173/#/preview/<run-id>
课程结构：总览 + topic 单元，8 页/单元
质量摘要：status/score/checks/requiredFixCount
内容对照：仅在高级对照模式下说明 authored 相对 draft 的 improvements、remainingGaps 和 revisionInstructions
下一步：打开预览后告诉我哪一页太抽象、例子不够、来源依据不清楚，或希望更难/更简单。
```

## Professor Lecture Web Deck

```text
请把这本书生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织。
我想快速掌握课程核心内容、关键概念、方法谱系、经典例题、课堂讨论题和课后阅读路径。
资料路径：/tmp/book.pdf
```

Expected MCP path:

```text
learning_agent.prepare_learning_course with courseIntent=professor_lecture_deck
learning_agent.publish_learning_course
learning_agent.get_learning_preview
```

## Paper

```text
这是一篇论文 PDF，请生成中文学习材料。先讲研究问题和方法心智模型，再拆核心机制、证据和局限，每个单元 8 页，适合有工程背景但没有读过这篇论文的人。教学难度为研究论文精读/前沿讨论。

资料路径：<paper path>
```

## Patent

```text
这是一份专利资料，请生成中文学习网页。先给总览，再按问题、权利要求、机制、实施例和应用边界拆课。每个单元 6 页，面向技术产品经理。教学难度为大学高年级/研究生课程。

资料路径或 URL：<patent path or URL>
```

## Blog

```text
这是一篇技术博客，请生成中文互动学习网页。先给总览，再按核心 pattern、实现步骤、常见误区和迁移任务拆课。每个单元 6 页，面向有基础开发经验的学习者。教学难度为本科核心课程。

URL：<blog URL>
```

## Pasted Source

```text
下面是我整理的技术笔记，请生成中文互动学习网页。先给总览，再按核心 topic 拆课，每个单元 6 页，要求有练习和误区检查。教学难度为入门衔接。

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

Expected revision response:

```text
新版预览：http://127.0.0.1:5173/#/preview/<run-id>
本次修订：revisionHistory[0].summary
修改范围：changedPages 中的页码和 lesson
质量状态：qualityAfter.status / qualityAfter.score
下一步：刷新或打开新版预览，确认侧边栏出现“修订历史”。
```

## Guardrails

- Do not ask learners to approve `source-map`, `concept-map`, `curriculum-plan`, or `critic-report`.
- Do not paste raw nested artifacts into the normal answer.
- Do not write generated preview output under `src/` unless maintaining sample fixtures.
- Return the preview URL and compact `qualityReport` summary.
- After feedback revision, return the preview URL plus `revisionHistory` summary and `qualityAfter` status.
- Keep generated content Chinese-first unless the learner explicitly requests another language.
