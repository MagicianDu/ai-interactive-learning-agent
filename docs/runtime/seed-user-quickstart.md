# Seed User Quickstart

Use this when helping a seed user try the product from Codex.

## Start

1. Confirm the MCP server is installed:

```bash
npm run codex:mcp:check
```

2. Ask the user for:

- source path or URL
- target learner
- pages per unit
- preferred structure: overview + topic, chapter-guided, topic-guided, task-guided, or hybrid
- optional chapter/topic focus, such as "only chapter 1 and 3" or "planning and tool use"

3. Use this default prompt in Codex:

```text
请使用 learningAgent MCP 服务帮我生成中文学习网页。
资料是：/absolute/path/to/source.pdf
我希望先有总览课，再按核心 topic 拆课。每个单元 8 页。
请先问我最多 3 个你必须知道的问题。明确后，不要让我审批内部 artifacts。
你可以直接调用 learning_agent.create_learning_project，然后调用 learning_agent.get_authoring_context 获取来源和课程约束。请由 Codex 创作 coursePack 与 lessons，再调用 learning_agent.publish_learning_course 发布课程网页。
```

Alternative organization prompts:

```text
strategy=chapter_guided。按章节推进：每章或每个关键小节生成一个学习单元，每个单元 8 页，保留 chapterRefs 和来源锚点。
```

```text
strategy=hybrid。先给总览课，再按教学 topic 组织路径，同时保留原书章节映射。
```

## Expected Tool Flow

```text
create_learning_project
get_authoring_context
publish_learning_course
get_learning_preview
```

If the user only wants a smoke preview:

```text
create_learning_project
generate_grounded_course
generate_quick_preview
```

If the user gives feedback after viewing:

```text
revise_learning_course
apply_learning_revision
get_learning_preview
```

If the user wants to share or archive the generated lesson:

```text
export_learning_course
```

## Failure Handling

- `clarification_required`: ask only the returned questions.
- `revision_required` with `source-grounding`: add lesson-level or page-level source anchors.
- `revision_required` with `chinese-first`: rewrite learner-facing text in Chinese.
- preview shows old content: refresh browser or restart `npm run dev`.

## Acceptance

The trial is acceptable when:

- the user gets `npm run dev` and `http://127.0.0.1:5173/`
- a course pack appears in the frontend
- long sources produce one overview unit plus multiple focused units
- lessons are Chinese-first
- source-backed lessons show source anchors
- feedback can be recorded through `revise_learning_course` and applied through `apply_learning_revision`
- static export can be created through `export_learning_course`
