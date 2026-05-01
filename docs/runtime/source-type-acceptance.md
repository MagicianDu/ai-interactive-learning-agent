# Source Type Acceptance Matrix

This matrix defines what seed-user trials should verify for each source type.

## Book

Prompt pattern:

```text
请使用 learningAgent MCP 服务把这本书生成中文学习网页：/absolute/path/to/book.pdf
先做总览课，再按核心 topic 拆课。每个单元 8 页。
不要让我审批内部 artifacts；请调用 generate_grounded_course 直接生成带来源锚点的中文网页。
```

Acceptance:

- Course pack has one overview unit and at least one topic unit.
- Lessons include sourceContext.sourceAnchorIds or page-level source anchors.
- Overview explains the whole book map, not only one chapter.
- Topic lessons preserve chapter/source mapping.
- If the user asks for `chapter_guided`, units should follow chapter or section order instead of forced topic grouping.

## Paper

Prompt pattern:

```text
请使用 learningAgent MCP 服务把这篇论文生成中文学习网页：/absolute/path/to/paper.pdf
请先做总览课，再按 problem、method、experiment、limitation、transfer 拆课。
```

Acceptance:

- Overview separates research problem, contribution, assumptions, evidence and limitations.
- Method and experiment units cite source anchors.
- Transfer task asks the learner to apply the method boundary to a new paper or project.

## Patent

Prompt pattern:

```text
请使用 learningAgent MCP 服务把这份专利生成中文学习网页：/absolute/path/to/patent.pdf
重点解释权利要求、技术方案、实施例、术语和风险边界。
```

Current regression sample:

```text
https://patents.google.com/patent/WO2025085566A1/en
```

Acceptance:

- Units cover claims, embodiments, technical solution and transfer/risk.
- Lessons distinguish claim text from explanatory analogy.
- Source anchors point to claims or specification sections.

## Blog

Prompt pattern:

```text
请使用 learningAgent MCP 服务把这篇技术博客生成中文互动学习网页：https://example.com/post
请把实践步骤重构成可操作教程，不要只做摘要。
```

Current regression sample:

```text
https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/bonus-rag-time-journey-agentic-rag/4404652
```

Acceptance:

- Lesson starts from a practical problem.
- At least two interactions require learner decisions.
- Source-backed claims cite blog anchors; missing background is marked as prerequisite or inference.

## Shared Gates

For all source types:

- `publish_learning_course` must return `preview_ready`.
- `generate_grounded_course` must return `preview_ready` for the default learner-first path.
- If source anchors are missing, the expected result is `revision_required`.
- User feedback should go through `revise_learning_course`, then another `generate_grounded_course` or a revised `publish_learning_course`.
- `create_learning_project` accepts `strategy`, `selectedChapters`, and `selectedTopics` so Codex can preserve user-specified organization in the learner brief.
