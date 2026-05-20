# Content Review 闭环

默认的 source-backed 自学教材课程在最终 imagegen 发布前，要让 Codex 做内容审核。
MCP 负责生成 review brief、记录 report/state、计算指标；Codex 负责读 brief、
挑刺、修订课程包并重新发布。

内容审核的产品目标以 `docs/current-product-spec.zh-CN.md` 为准。审核必须优先判断页面是否像学生自学的学术教材，而不是只看结构完整、图片完整或流程完整。

## 默认流程

1. 用 `learning_agent.publish_learning_course` 发布初稿课程。
2. 调用 `learning_agent.prepare_content_review`，通常设置 `maxRounds=3`。
3. Codex 作为 `content-review-agent`：先挑刺，再改稿。
4. 重新发布修订后的 `coursePack` 和 `lessons`。
5. 调用 `learning_agent.record_content_review_report` 记录本轮报告。
6. 重复直到第三轮完成，或 `prepare_content_review` 返回 `review_complete`。
7. 使用第三轮修订后的课程包进入 imagegen 批处理和最终预览。

学习者不需要审批 review artifacts。默认只给学习者看预览地址、课程形态、
紧凑质量摘要和高层风险。

## Review Report

每轮修订后，Codex 必须记录一份紧凑审核报告：

```json
{
  "method": "tools/call",
  "params": {
    "name": "learning_agent.record_content_review_report",
    "arguments": {
      "runId": "<run-id>",
      "round": 1,
      "reviewerVerdict": "revise",
      "summary": "本轮修复了模板化标题，但部分来源页知识密度仍偏低。",
      "issues": [
        {
          "lessonId": "<lesson-id>",
          "pageId": "<page-id>",
          "severity": "major",
          "category": "density",
          "finding": "页面只给出抽象判断，缺少来源中的具体约束关系。",
          "recommendation": "补充来源概念之间的条件、例子和失效边界。"
        }
      ]
    }
  }
}
```

MCP 会记录：

- `round-###-content-review-report.json`：reviewer verdict、issues、度量指标和 delta。
- `content-review-state.json`：最新轮次、最新 verdict、最新指标、最新 delta，以及第三轮后的 final verdict。

`prepare_content_review` 生成的 brief 也会携带：

- `currentMetrics`：当前课程包的所有自动指标。
- `automaticFindings`：由 MCP 从非零语义指标生成的自动问题清单。

Codex 开始审核时应先处理 `automaticFindings`，再做人工内容判断。

指标包括：

- `templateLabelCount`：模板化栏目标题数量。
- `missingImagegenAssetCount`：缺失 imagegen 图片资产的页面数量。
- `genericTitleCount`：泛化页面标题数量。
- `lowDensityPageCount`：低知识密度页面数量。
- `sourceAnchoredPageCount`：有 `sourceAnchorIds` 的页面数量。
- `sourceTracePageCount`：有 `knowledgeBoard.sourceTrace` 的页面数量。
- `genericSourceTraceSupportCount`：泛化 `sourceTrace.supports` 数量。
- `staleVisualPromptCount`：缺失或仍使用标题式旧模板的图片 prompt 数量。
- `titleDuplicatedInImagePromptCount`：图片 prompt 直接包含页面标题的数量。
- `mechanismDepthWeakPageCount`：机制板书左右栏内容项不足的页面数量。
- `boilerplateLearnerPhraseCount`：出现“本页帮助你…”“建立心智模型”等模板腔的页面数量。
- `repeatedBoardSectionLabelCount`：同一课程内反复复用的板书栏目名数量。
- `rubricPhraseLeakCount`：rubric、质量标准或 reviewer 语言漏出到学生页面的数量。
- `semanticTemplateLabelCount`：语义化伪装模板栏目数量，例如“X 的判断入口 / X 的推理链路 / X 的证据边界 / X 的自检问题”。
- `scaffoldHeadlinePatternCount`：固定 headline 骨架数量，例如“把 X 放回来源和机制中理解”。

delta 是判断 review 是否真的提升内容质量的主要信号，而不是只增加流程感。

## 语义指标规则

这些语义指标故意保持保守，先拦截明确坏味道：

- `genericSourceTraceSupportCount`：统计 `支撑本页核心命题`、`给出来源证据或边界`、`来源支持这个命题` 等泛化来源支撑句。
- `staleVisualPromptCount`：统计缺失 image prompt，或仍使用 `只表达“<title>”`、`核心知识关系：<title>` 这类标题式旧模板的页面。
- `titleDuplicatedInImagePromptCount`：统计 image prompt 直接包含页面标题的页面。
- `mechanismDepthWeakPageCount`：统计左右栏具体内容项少于 4 条的页面；这类页面通常不足以支撑学生自学所需的条件、机制、例子和边界。
- `boilerplateLearnerPhraseCount`：统计把页面写成“学习活动说明”而不是“知识判断”的模板腔页面。典型坏味道包括“本页帮助你建立心智模型”“快速理解核心内容”等。
- `repeatedBoardSectionLabelCount`：统计同一 lesson 内出现 3 次及以上的板书栏目名。重复栏目名即使不是禁用模板词，也通常意味着页面仍按固定模板填空。
- `rubricPhraseLeakCount`：统计“学习者需要看见问题、机制和边界”“大学高年级/研究生课程层级需要额外追问”“对研究论文学习来说，关键不是记住一句结论”等内部质量话术。
- `semanticTemplateLabelCount`：统计“定位问题的判断入口”“定位问题 #01 的推理链路”等新瓶装旧酒的模板栏目。
- `scaffoldHeadlinePatternCount`：统计“把 X 放回来源和机制中理解”等固定 headline 模板。

## 三轮审核重点

第一轮检查结构和知识链路：

- 保留 planned units 和 page budgets。
- 页面标题是内容命题，而不是模板角色。
- 总览课和 topic 单元各自有明确职责。
- 页面顺序对学生自学是连贯的。

第二轮检查来源具体性和知识密度：

- source-backed 页面使用来源中的具体术语、例子、限制或关系。
- `sourceAnchorIds` 和 `knowledgeBoard.sourceTrace` 支撑实际页面主张。
- 页面没有把来源内容压扁成泛化摘要。

第三轮检查学生可读性和图文匹配：

- 每页教会一个具体知识判断。
- 右侧文字密度足够，但仍可读。
- 栏目标题是内容专属小标题。
- 删除“本页帮助你…”这类课程模板腔，直接写知识命题、条件、例子和边界。
- image prompt 描述中间视觉区应该画出的机制，并禁止长段落、表格和 UI 面板。

## Review 后的 Imagegen 批处理

最终 review 轮次完成后：

1. 调用 `learning_agent.create_imagegen_manifest`。
2. Codex 读取 `runs/<run-id>/quality/imagegen/imagegen-prompt-manifest.json`。
3. Codex 对每个 manifest item 调用 imagegen。
4. 对每个生成的 PNG/WebP 调用 `learning_agent.record_imagegen_asset`。
5. 调用 `learning_agent.validate_imagegen_assets`。
6. 如果校验失败，重新生成或重新记录受影响页面图片，再次校验。

最终预览只能包含 imagegen PNG/WebP 资产。SVG 占位、缺失文件、不安全 prompt，
或允许长段落、表格、UI 面板的 prompt 都会阻塞验收。不同页面还必须使用独立教学插图；
如果只是把同一张图片复制到不同页面路径，`validate_imagegen_assets` 会通过图片内容哈希拦截。

## Layout Smoke

最终给学习者预览前，建议在本机 dev server 已启动时执行：

```bash
npm run smoke:layout -- --runId <run-id> --desktop-only
```

该检查会遍历 `coursePack.units` 下的每个单元和每一页，写入：

```text
runs/<run-id>/quality/layout-smoke/layout-smoke-report.json
```

当前 layout smoke 会拦截：

- 页面整体出现垂直或水平滚动。
- 页面图片缺失或未加载。
- 浏览器控制台错误。
- `knowledge-board`、正文区或主内容容器出现内容溢出。

如果检查失败，先修页面内容量、图文比例、图片资源或响应式尺寸，再把预览交给学习者。
