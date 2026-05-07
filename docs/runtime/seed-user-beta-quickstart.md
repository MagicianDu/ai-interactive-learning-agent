# Seed User Beta Quickstart

This is the shortest supported path for trying AI Interactive Learning Agent from Codex or Claude.

## Goal

Turn a source or topic into a Chinese, source-grounded, multi-unit web lesson preview without asking the learner to approve internal artifacts.

## Start The MCP Server

```bash
npm install
npm run codex:bundle:install
npm run codex:mcp:check
npm run dev
```

Use the preview URL returned by MCP, usually:

```text
http://127.0.0.1:5173/#/preview/<run-id>
```

## Default Learner Flow

Prefer the one-call preparation tool:

```json
{"method":"tools/call","params":{"name":"learning_agent.prepare_learning_course","arguments":{"request":"请用 /path/to/source.pdf 生成中文学习课程，面向有编程基础的中文学习者，教学难度为大学高年级/研究生课程，每个单元 8 页，先总览再按核心 topic 拆课。","runId":"my-course","sourcePath":"/path/to/source.pdf","sourceKind":"book","audience":"有编程基础的中文学习者","difficultyLevel":"upper_undergraduate_or_graduate","unitPages":8,"strategy":"overview_plus_topic"}}}
```

If it returns `clarification_required`, ask the learner only those questions, then call `learning_agent.prepare_learning_course` again with the clarified request.

If it returns `authoring_context_ready`, Codex or Claude authors:

- `coursePack`
- `lessons`

Then publish:

```json
{"method":"tools/call","params":{"name":"learning_agent.publish_learning_course","arguments":{"runId":"my-course","coursePack":{},"lessons":[]}}}
```

Then preview:

```json
{"method":"tools/call","params":{"name":"learning_agent.get_learning_preview","arguments":{"runId":"my-course"}}}
```

## Source Examples

- Book: `sourceKind=book`, strategy usually `overview_plus_topic` or `chapter_guided`.
- Paper: `sourceKind=paper`, focus on research question, method, evidence, limitations, and transfer.
- Patent: `sourceKind=patent`, focus on claims, technical solution, embodiments, and boundaries.
- Blog: `sourceKind=blog`, focus on practical problem, workflow, caveats, and reusable steps.
- Documentation: `sourceKind=documentation`, focus on task path, API boundaries, errors, and examples.
- Notes or folder: `sourceKind=notes`, preserve the user's structure when useful.
- Topic only: omit `sourcePath`; keep claims general or mark inferred pages clearly.

## Quality Loop

For a deterministic baseline, create a separate draft run with `learning_agent.generate_grounded_course`, then compare after Codex-authored publish:

```json
{"method":"tools/call","params":{"name":"learning_agent.compare_authoring_quality","arguments":{"authoredRunId":"my-course","draftRunId":"my-course-draft"}}}
```

Acceptance for seed users:

- `qualityReport.status` is `passed`.
- `compare_authoring_quality.remainingGaps` is empty when a draft comparison exists.
- The preview shows the requested unit structure, page count, difficulty, source grounding, interactions, feedback, and transfer tasks.

## Feedback And Export

Record learner feedback:

```json
{"method":"tools/call","params":{"name":"learning_agent.revise_learning_course","arguments":{"runId":"my-course","feedback":"第 3 页太抽象，请增加一个工程例子。"}}}
```

For deterministic targeted revisions:

```json
{"method":"tools/call","params":{"name":"learning_agent.apply_learning_revision","arguments":{"runId":"my-course"}}}
```

For deeper rewrites, Codex or Claude should revise `coursePack` and `lessons`, then call `learning_agent.publish_learning_course` again.

Export only after the preview is accepted:

```json
{"method":"tools/call","params":{"name":"learning_agent.export_learning_course","arguments":{"runId":"my-course"}}}
```

## Do Not Ask Learners To Approve

Do not ask seed users to approve source maps, concept maps, curriculum plans, content blueprints, critic reports, or publish-validation artifacts. Those are operator/debug artifacts. The learner acceptance surface is the preview plus compact quality summary.
