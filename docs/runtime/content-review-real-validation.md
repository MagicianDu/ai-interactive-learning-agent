# Content Review 真实验证记录

运行 ID：`self-study-weyl-review-validation-20260515`

预览地址：

```text
http://127.0.0.1:5173/#/preview/self-study-weyl-review-validation-20260515
```

## 验证对象

- 基线课程：`self-study-weyl-space-time-matter-v2`
- 来源材料：Hermann Weyl, `Space, Time, Matter`
- 课程形态：总览课 + 4 个核心 topic 单元
- 页数：每单元 8 页，共 40 页
- 课程意图：`student_self_study_textbook`

## 三轮审核结果

第一轮：结构和知识链路

- 发现：课程质量分已经是 `100`，但有 74 个 `sourceTrace.supports`
  仍使用 `支撑本页核心命题` 或 `给出来源证据或边界` 这类泛化句。
- 修订：把这些来源支撑改成页面命题、例子和边界的具体说明。
- 报告：
  `runs/self-study-weyl-review-validation-20260515/quality/content-review/round-001-content-review-report.json`

第二轮：来源具体性和知识密度

- 发现：部分高价值页面虽然结构指标通过，但机制链仍偏概括。
- 修订页面：
  - `unit-topic-03/page-02`：Maxwell 方程 -> Galilei 失败 -> Lorentz 不变量
  - `unit-topic-04/page-04`：metric -> connection -> curvature -> energy-momentum tensor
  - `unit-topic-04/page-06`：matter energy-momentum 与 gravitational pseudo-energy 的区别
- 报告：
  `runs/self-study-weyl-review-validation-20260515/quality/content-review/round-002-content-review-report.json`

第三轮：学生可读性和图文匹配

- 发现：第二轮文字修订后，部分 `visualSpec` 仍停留在旧 prompt；
  同时全书 image prompt 普遍重复页面标题，而不是描述教学图像该画什么。
- 修订：重写 40 页 `visualSpec.imagePrompt`，改为机制画面说明，并保留
  禁止长段落、表格、UI 面板的 prompt 约束。
- 报告：
  `runs/self-study-weyl-review-validation-20260515/quality/content-review/round-003-content-review-report.json`

## 最终状态

`learning_agent.prepare_content_review` 返回：

```json
{
  "status": "review_complete",
  "round": 3,
  "maxRounds": 3
}
```

`content-review-state.json` 关键状态：

```json
{
  "latestRound": 3,
  "latestVerdict": "pass",
  "finalVerdict": "pass",
  "latestMetrics": {
    "lessonCount": 5,
    "pageCount": 40,
    "templateLabelCount": 0,
    "missingImagegenAssetCount": 0,
    "genericTitleCount": 0,
    "lowDensityPageCount": 0,
    "sourceAnchoredPageCount": 40,
    "sourceTracePageCount": 40
  },
  "latestDelta": {
    "issueCount": -3
  }
}
```

`learning_agent.validate_imagegen_assets` 返回：

```json
{
  "status": "passed",
  "checkedPageCount": 40,
  "issues": []
}
```

浏览器抽样验证：

- 抽查 `unit-overview/page/1`
- 抽查 `unit-topic-03/page/2`
- 抽查 `unit-topic-04/page/4`
- 抽查 `unit-topic-04/page/6`
- 抽查页均加载 1 张非破损图片
- 抽查页在 1440x900 视口下无页面级上下滚动

## 暴露出的产品 Gap

新的 report/state 流程已经能工作，但当前指标仍偏结构合规。
第一轮暴露了一个重要语义缺口：泛化的 `sourceTrace.supports`
可以通过所有现有指标。

下一步建议把这些指标自动化：

- `genericSourceTraceSupportCount`
- `staleVisualPromptCount`
- `titleDuplicatedInImagePromptCount`
- `mechanismDepthWeakPageCount`

这样后续 review 不只依赖 Codex 人工判断，也能自动拦截来源支撑泛化、
图文不同步、图片 prompt 重复标题、关键机制讲不清等问题。
