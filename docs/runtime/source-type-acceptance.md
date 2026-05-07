# Source Type Acceptance Matrix

This matrix defines what seed-user trials should verify for each source type.

## Book

Prompt pattern:

```text
请使用 learningAgent MCP 服务把这本书生成中文学习网页：/absolute/path/to/book.pdf
先做总览课，再按核心 topic 拆课。每个单元 8 页。
不要让我审批内部 artifacts；请调用 get_authoring_context 获取来源锚点和课程约束，然后由 Codex 创作 coursePack 与 lessons，并调用 publish_learning_course。
```

For deterministic quick-draft regression only, replace the last sentence with:

```text
不要让我审批内部 artifacts；请调用 generate_grounded_course 生成低保真 deterministic 预览，用于 smoke 测试而不是最终内容质量验收。
```

Acceptance:

- Course pack has one overview unit and at least one topic unit.
- Source Graph V2 includes chapter or section source units when headings are present.
- Generated unit count is at least 3 for seed regression.
- Source semantic expectations report at least `全局地图` and `核心机制` as matched concept labels.
- Semantic status is `passed`; missing concept labels fail seed readiness.
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
- Source Graph V2 classifies available sections into problem, method, experiment, limitation, and conclusion roles when present.
- Generated unit count is at least 3 for seed regression.
- Source semantic expectations report `研究问题`, `方法结构`, and `证据边界` as matched concept labels.
- Semantic status is `passed`; missing concept labels fail seed readiness.
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
- Source Graph V2 classifies available source units into claim, background, embodiment, and figure roles when present.
- Generated unit count is at least 3 for seed regression.
- Source semantic expectations report `权利要求边界`, `技术方案`, and `实施例` as matched concept labels.
- Semantic status is `passed`; missing concept labels fail seed readiness.
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
- Source Graph V2 preserves heading hierarchy and argument-flow units when URL or text extraction succeeds.
- Generated unit count is at least 3 for seed regression.
- Source semantic expectations report `实践问题` and `操作流程` as matched concept labels.
- Semantic status is `passed` when URL content is extracted, or `warning` when URL extraction falls back but the course still generates.
- At least two interactions require learner decisions.
- Source-backed claims cite blog anchors; missing background is marked as prerequisite or inference.

## Shared Gates

For all source types:

- `get_authoring_context` must return `authoring_context_ready` for the default high-quality learner-first path.
- `publish_learning_course` must return `preview_ready` for Codex-authored bundles.
- `generate_grounded_course` must return `preview_ready` for deterministic draft regression.
- If source anchors are missing, the expected result is `revision_required`.
- `source:regression` reports `generatedUnitCount`, `semanticStatus`, `sourceEvidenceStatus`, `sourceEvidence`, `missingConceptLabels`, and `semanticExpectations` for each source kind.
- `source:regression` reports `sourceGraphStatus` and source graph artifact paths for each grounded source kind.
- `seed:check` fails if any source regression item has `semanticStatus=failed`, `sourceEvidenceStatus=failed`, or missing source evidence status.
- Source Graph V2 should include at least 5 concepts, 2 examples, 2 misconceptions, and 2 candidate interactions for non-trivial source-backed fixtures.
- User feedback should go through `revise_learning_course`, then `apply_learning_revision`, then `get_learning_preview`.
- Shareable output should go through `export_learning_course`.
- `create_learning_project` accepts `difficultyLevel`, `strategy`, `selectedChapters`, and `selectedTopics` so Codex can preserve user-specified depth and organization in the learner brief.
