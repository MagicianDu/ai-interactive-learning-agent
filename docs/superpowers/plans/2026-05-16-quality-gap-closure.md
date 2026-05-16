# 质量剩余 Gap 收敛计划

> 日期：2026-05-16  
> 目标：把上一轮留下的三个 gap 固化为可执行门禁，而不是依赖人工提醒。

## 范围

本轮只处理三个问题：

1. 每页独立 imagegen 插图，禁止把同一张图复制到多页。
2. 内容品味 reviewer，识别模板腔和重复板书栏目。
3. 全页 layout smoke，验证预览页不滚动、不缺图、不报错、不溢出。

## 验收目标

- `validate_imagegen_assets` 对重复图片内容返回 `failed`，即使图片路径不同。
- `prepare_content_review` 的 `currentMetrics` 和 `automaticFindings` 包含内容品味指标：
  - `boilerplateLearnerPhraseCount`
  - `repeatedBoardSectionLabelCount`
- 新增 `npm run smoke:layout -- --runId <run-id> --desktop-only`，输出：
  - `runs/<run-id>/quality/layout-smoke/layout-smoke-report.json`
- layout smoke 能拦截：
  - 页面垂直/水平滚动。
  - 图片未加载。
  - 控制台错误。
  - `knowledge-board` 或正文容器内容溢出。

## 测试方案

- `tools/agent-runtime/learner/imagegen-asset-batch-service.test.ts`
  - 红测：两页图片文件内容相同但路径不同，应失败。
- `tools/agent-runtime/learner/content-review-service.test.ts`
  - 红测：模板腔和重复栏目应进入 automatic findings。
- `tools/agent-runtime/learner/preview-layout-smoke-service.test.ts`
  - 红测：scroll、缺图、console error、元素溢出应生成 layout issue。
  - 通过场景：每页都有 measurement 时写入 report。

## 完成状态

- [x] 每页独立 imagegen 图片内容哈希门禁。
- [x] 内容品味自动指标和 review brief 规则。
- [x] Preview layout smoke service。
- [x] `npm run smoke:layout` 入口。
- [x] 更新 runtime docs 和 skills。
- [x] 完整验证。

## 本轮验证记录

- `npm run test:ci` 通过：typecheck、lint、85 个测试文件 / 492 个单测、build、bundle check。
- `npm run codex:mcp:check` 通过：本机 Codex MCP 配置仍然有效。
- `npm run smoke:layout -- --runId self-study-agentic-design-patterns-quality-v1 --desktop-only` 通过：34 个预览页面无滚动、无缺图、无 console error、无正文容器溢出。
- `git diff --check` 通过。

## 后续真实课程验证

本轮先完成工程门禁。下一轮用 `self-study-agentic-design-patterns-quality-v1`
重新跑 imagegen 时，必须为每页生成独立图片；上一版“按单元复用图片”会被新门禁拦截。
