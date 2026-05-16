# Agentic Design Patterns 90+ 课程质量引擎实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-05-16-agentic-design-90-quality-engine-spec.md` 完成 Course Quality Engine v1，并用 `Agentic_Design_Patterns.pdf` 生成一版 90+ 中文学生自学 Web Deck 验收包。

**Architecture:** MCP/runtime 继续负责确定性校验、review brief、imagegen manifest、图片资产记录和 preview 发布；Codex 负责 source-backed 内容设计、三轮挑刺修订和 imagegen 教学插图生成。实现上先补质量门禁和自动 findings，再真实跑 `self-study-agentic-design-patterns-quality-v1`。

**Tech Stack:** TypeScript, Vitest, local `LearningAgentRuntimeTools`, existing preview JSON layout, Vite, Codex built-in `image_gen` tool.

---

## 文件边界

- Modify: `tools/agent-runtime/learner/imagegen-asset-batch-service.ts`
  - 让 manifest prompt 不再直接包含页面标题。
  - 让 asset validation 拦截 prompt 直接复制页面标题。
  - 扩充 prompt guard，要求禁止重复页面标题和底部总结。

- Modify: `tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts`
  - 覆盖 manifest prompt 去标题化。
  - 覆盖 validation 拦截重复页面标题。

- Modify: `tools/agent-runtime/learner/content-review-service.ts`
  - `automaticFindings` 覆盖所有 spec 中要求清零的指标。
  - missing imagegen、template labels、generic titles、low density 等直接进入 reviewer brief。

- Modify: `tools/agent-runtime/learner/content-review-service.test.ts`
  - 覆盖新增 automatic findings。

- Modify: `tools/agent-runtime/quality/self-study-textbook-rubric.ts`
  - 拦截页面标题与 `knowledgeBoard.headline` 大面积重复。
  - 拦截 `bottomLine` 只是重复标题。

- Modify: `tools/agent-runtime/quality/self-study-textbook-rubric.test.ts`
  - 覆盖标题/板书重复和底部总结重复。

- Create: `docs/runtime/agentic-design-patterns-quality-acceptance.md`
  - 记录真实资料验收结果、三轮 review、imagegen 状态、preview URL 和 gap。

---

## Task 1：落地可执行计划和验收样本准备

- [x] 创建本实施计划。
- [x] 调用 `learning_agent.prepare_learning_course`，使用：
  - runId: `self-study-agentic-design-patterns-quality-v1`
  - sourcePath: `/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf`
  - courseIntent: `student_self_study_textbook`
  - strategy: `overview_plus_topic`
  - unitPages: `8`
  - selectedTopics: `Prompt Chaining`, `Tool Use`, `Reflection`
- [x] 确认 authoring context 写入 `runs/self-study-agentic-design-patterns-quality-v1/artifacts/`。

## Task 2：补质量规则和测试

- [x] RED：为 imagegen manifest 写测试，要求默认 prompt 不包含页面标题，且包含“不要重复页面标题、底部总结”的 guard。
- [x] GREEN：重写 `defaultPrompt`，使用 `imageAlt` 和 `knowledgeBoard.coreProposition` 生成视觉说明，不复述标题。
- [x] RED：为 imagegen validation 写测试，要求拦截 prompt 直接复制页面标题。
- [x] GREEN：新增 `imagegen.asset.prompt-duplicates-page-text` validation issue。
- [x] RED：为 content review automatic findings 写测试，要求 template labels、missing images、generic titles、low density 都进入 brief。
- [x] GREEN：扩充 `buildAutomaticFindings`。
- [x] RED：为 self-study rubric 写测试，要求拦截标题/headline 重复和 bottomLine 重复标题。
- [x] GREEN：实现重复规则。
- [x] 运行目标测试：
  - `npm test -- --run tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts`
  - `npm test -- --run tools/agent-runtime/learner/content-review-service.test.ts`
  - `npm test -- --run tools/agent-runtime/quality/self-study-textbook-rubric.test.ts`

## Task 3：真实生成 Agentic Design Patterns 验收课程包

- [x] 根据 PDF 目录和 authoring context，创作 `coursePack`：
  - `unit-overview`: 10 页
  - `unit-prompt-chaining`: 8 页
  - `unit-tool-use`: 8 页
  - `unit-reflection`: 8 页
- [x] 每页必须包含：
  - `knowledgeBoard`
  - `sourceAnchorIds`
  - `knowledgeBoard.sourceTrace`
  - `visualSpec` with imagegen-ready `imagePrompt`
- [x] 调用 `learning_agent.publish_learning_course` 发布初稿。

## Task 4：完成三轮 review、imagegen 批处理和验收记录

- [x] 调用 `learning_agent.prepare_content_review`，执行第 1 轮结构/知识链路审核，修订并重新 publish。
- [x] 调用 `learning_agent.record_content_review_report` 记录第 1 轮。
- [x] 执行第 2 轮来源具体性/知识密度审核，修订并重新 publish，记录 report。
- [x] 执行第 3 轮学生视角/图文配合审核，修订并重新 publish，记录 report。
- [x] 调用 `learning_agent.create_imagegen_manifest`。
- [x] 对 manifest 中每页生成或记录 imagegen PNG/WebP 资产。
- [x] 调用 `learning_agent.validate_imagegen_assets`，修复失败项直到 passed。
- [x] 写入 `docs/runtime/agentic-design-patterns-quality-acceptance.md`。

## 最终验证

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm test -- --run`
- [x] `npm run build`
- [x] `npm run codex:mcp:check`
- [x] `git diff --check`

## 完成标准

- `qualityReport.score >= 90`
- `validate_imagegen_assets.status = passed`
- major `automaticFindings` 无遗留，或验收文档逐项解释。
- preview URL 可打开：
  `http://127.0.0.1:5173/#/preview/self-study-agentic-design-patterns-quality-v1`
