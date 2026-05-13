# Self-Study Overview Plus Topics Productization

## Goal

把已经被学习者接受的“总览课 + 多个核心 topic 深讲课”流程固化为默认产品流程，而不是继续依赖一次性脚本逐个样本验证。

目标产品行为：

- 学习者在 Codex/Claude 中自然语言说明资料、难度、受众、每单元页数和核心 topics。
- `learning_agent.prepare_learning_course` 返回一个完整可创作课程结构：1 个 overview unit + N 个 selected topic units。
- `unitPages` 表示每个单元页数；当用户显式选择 topics 时，不用默认 `targetTotalPages=100` 重新平均拆分这些单元。
- Codex/Claude 根据返回的 `contentBlueprint` 和 golden samples 一次性创作 `coursePack.units` 与对应 `lessons`，再调用 `publish_learning_course`。
- 学习者只看到预览链接、课程结构和质量结果，不审批内部 artifacts。

## Acceptance Targets

1. Planning contract
   - `student_self_study_textbook` + `selectedTopics=["A","B","C"]` + `unitPages=10` produces 4 units.
   - Unit 1 is `unit-overview`, 10 pages.
   - Units 2-4 are topic units for A/B/C, each 10 pages.
   - `coursePlan.estimatedTotalPages` is 40.
   - If the user did not explicitly set `targetTotalPages`, default 100-page guidance remains a reminder, not a forced redistribution for selected topics.

2. Authoring contract
   - `codexInstruction` tells Codex to author all planned units in one `coursePack.units` bundle.
   - `codexInstruction` points to `docs/runtime/self-study-golden-samples.md`.
   - `contentBlueprint.units` has the same unit count and page counts as `coursePlan.recommendedUnits`.

3. Skill/docs contract
   - `source-to-course` and `learning-agent-operator` explain that selected self-study topics mean overview plus one unit per topic.
   - The docs warn not to create one temporary run per topic when the learner asks for a multi-topic course.

4. Verification
   - Add failing tests first.
   - Focused tests pass.
   - `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run build` pass before reporting completion.

## Implementation Todos

- [x] Add a course planner test for selected-topic self-study page budgets.
- [x] Add an authoring-context test for full overview-plus-topics Codex instruction and blueprint alignment.
- [x] Modify `planCourseUnits` so selected self-study topics use per-unit page counts unless `targetTotalPages` was explicitly user specified.
- [x] Propagate `totalPagesSpecified` into planning input so the planner can distinguish default guidance from user intent.
- [x] Update Codex authoring instruction to reference accepted self-study samples and one-bundle publishing.
- [x] Update operator/source skills and self-study golden sample docs.
- [x] Run focused and full checks.

## Non-Goals

- 不重新设计页面 UI。
- 不再手工生成新的 sample lesson 作为主要验收。
- 不把 MCP deterministic generator 当成正式内容作者；正式内容仍由 Codex/Claude 创作，MCP 负责准备、校验、发布和预览。
