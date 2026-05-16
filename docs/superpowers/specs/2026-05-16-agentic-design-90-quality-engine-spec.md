# Agentic Design Patterns 90+ 课程质量引擎规格

日期：2026-05-16

## 1. 背景

当前项目已经具备 source-backed 自学课程生成、内容审核 brief、imagegen 资产批处理、preview 发布和质量报告能力。但从用户视角看，产品还没有稳定证明一件事：

> 给定一本真实技术书，系统能稳定生成具有学习获得感的中文自学 Web Deck，而不是只生成结构合法的页面。

这份规格聚焦三个紧急 gap：

1. 内容质量闭环不够强：已有自动指标和 review brief，但还需要把三轮内容审核做成默认、高约束、可度量的质量提升机制。
2. imagegen 资产流程不够自动：已有 manifest、记录和校验工具，但还需要把整包插图生成纳入课程发布路径。
3. 学习页质量约束仍需固化：已形成“图片 + 高密度讲解 + 一屏学习”的方向，但需要变成可验收规则。

本阶段不扩展课程库 UI、用户账号、学习进度、队列系统或新资料类型。目标是把内容生成内核做稳。

## 2. 总目标

完成 `Course Quality Engine v1`：

> 使用 `Agentic Design Patterns` 作为真实资料验收样本，生成一版中文学生自学 Web Deck，经过三轮 Codex 内容审核、imagegen 教学插图批处理和页面质量门禁后，最终课程质量分达到 `90+`。

## 3. 验收资料

默认验收资料：

```text
/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf
```

备用资料：

```text
/Users/dm/Documents/1.书籍资料/BOOKS/Agentic Design Patterns_ A Hands-On Guide to Building Intelligent Systems{Antonio Gulli}(2025 December 03, Springer){111118544} libgen.li.epub
```

默认 run id：

```text
self-study-agentic-design-patterns-quality-v1
```

默认课程形态：

```text
courseIntent = student_self_study_textbook
displayMode = textbook_deck
language = zh-CN
audience = 有编程和 AI 应用经验，希望系统掌握智能体设计模式的中文学习者
level = 大学高年级 / 研究生入门到进阶
```

## 4. 默认课程规模

本阶段先做中等规模验收包：

```text
总览课：10 页
核心 topic：3 个
每个 topic：8 页
总页数：约 34 页
```

推荐 topic 由 Codex 从资料中选择，但必须满足：

1. 是书中可形成独立学习单元的核心模式或核心能力。
2. 能和总览课形成“先看全局，再深入机制”的路径。
3. 每个 topic 都能讲清关键链路、适用边界和失败模式。

不建议在本阶段直接做 5 个 topic 或全书完整路径。原因是当前主要目标是验证质量闭环，而不是追求覆盖范围。

## 5. 用户体验目标

用户通过 Codex 或类似入口提出需求后，应看到的是：

1. 课程范围确认：默认总览 10 页 + 3 个 topic，每个 topic 8 页。
2. 系统快速说明默认会执行三轮内容审核和 imagegen 插图批处理。
3. 最终只给用户 preview URL、课程结构和质量摘要。
4. 不要求用户审批 review brief、imagegen manifest 或中间 artifacts。

用户不需要具备判断中间 artifact 的能力。系统必须把质量判断前置到 Codex 和 MCP 的工作流中。

## 6. 内容质量闭环目标

### 6.1 三轮审核职责

三轮审核不是重复打分，而是分工明确。

第一轮：结构和知识链路

- 检查总览课是否建立全局地图。
- 检查 topic 是否承接总览，而不是孤立摘录。
- 检查页面顺序是否符合学生自学路径。
- 检查页面标题是否是内容命题或真实问题。
- 检查是否存在模板标题、页面角色标题或 authoring scaffold。

第二轮：知识密度和来源具体性

- 检查每页是否讲清一个关键节点或关键链路。
- 检查是否包含机制、条件、例子、边界或反例。
- 检查 `sourceAnchorIds` 和 `knowledgeBoard.sourceTrace` 是否支撑实际主张。
- 检查是否存在泛化来源支撑句。
- 检查是否把书中内容压扁成空泛摘要。

第三轮：学生自学视角和图文配合

- 检查页面是否像学生自学教材页，而不是教师讲课提纲。
- 检查右侧讲解是否高密度但可读。
- 检查图片 prompt 是否解释中间视觉知识点。
- 检查图片、标题、右侧文字和底部总结是否互补而非重复。
- 检查每页是否保持一屏学习体验。

### 6.2 审核输出要求

每轮必须通过 `learning_agent.record_content_review_report` 记录：

- `round`
- `reviewerVerdict`
- `summary`
- 具体到 `lessonId` 和 `pageId` 的 issues
- `severity`
- `category`
- `finding`
- `recommendation`

不接受泛泛的“内容还可以更深入”。问题必须能指导 Codex 修改具体页面。

### 6.3 审核停止条件

满足以下条件之一才可以进入 imagegen 批处理：

1. 完成第三轮内容审核，并且第三轮修订后的课程重新发布成功。
2. `prepare_content_review` 返回 `review_complete`，且当前质量分已经达到 `90+`。

如果第三轮后仍低于 `90`，不得静默通过。必须记录未达标原因，并决定继续修订或降低本轮验收范围。

## 7. imagegen 批处理目标

### 7.1 默认流程

第三轮内容审核后的课程包进入 imagegen 批处理：

1. 调用 `learning_agent.create_imagegen_manifest`。
2. Codex 读取 `imagegen-prompt-manifest.json`。
3. Codex 为每个 manifest item 调用 imagegen。
4. 将生成的 PNG 或 WebP 保存到本地临时路径。
5. 调用 `learning_agent.record_imagegen_asset` 写回课程 preview。
6. 调用 `learning_agent.validate_imagegen_assets`。
7. 对失败页面重新生成或重新记录图片。
8. 最终重新发布并返回 preview。

### 7.2 图片内容规则

每页图片必须服务中间知识讲解：

- 图片解释一个机制、关系、过程或对比。
- 可以有少量短标签、箭头、局部注释。
- 不能重复页面标题。
- 不能重复底部总结。
- 不能复制右侧文字卡片。
- 不能出现长段文字。
- 不能出现表格。
- 不能出现 UI 面板式文字框。
- 不能使用 SVG 或程序化占位图冒充教学插图。

### 7.3 图片 prompt 规则

每个 `visualSpec.imagePrompt` 必须明确包含限制：

```text
禁止长段文字，禁止表格，禁止 UI 面板，禁止重复页面标题和底部总结。
```

prompt 应描述图片要解释的知识关系，而不是描述页面布局。

### 7.4 资产验收标准

最终课程必须满足：

- `textbook_deck` 每页都有 `visualSpec.imageUrl`。
- 每页 `visualSpec.imageProvider = "imagegen"`。
- `imageUrl` 指向 preview 可访问的 PNG 或 WebP。
- 不存在 `.svg` 图片。
- `validate_imagegen_assets` 返回 passed。

## 8. 学习页质量规则

### 8.1 页面结构

每页固定为学习页，而不是幻灯片提纲：

1. 顶部：标题和核心问题。
2. 中间左侧：imagegen 教学插图，占视觉主导。
3. 中间右侧：高密度讲解，使用内容专属小标题。
4. 底部：一句压缩总结。

页面必须一屏可读。不得依赖上下滚动来消化核心内容。

### 8.2 内容规则

每页只解决一个关键节点或一条关键链路。

优秀页面应包含以下至少两类内容：

- 机制：事情如何发生。
- 条件：什么时候成立。
- 例子：在书中或现实系统中如何出现。
- 边界：什么时候不适用。
- 对比：和相近模式或做法的差异。
- 失败模式：错误使用会导致什么问题。

禁止：

- 模板栏目标题，例如“机制链”“正式术语”“例子 / 证据”“边界案例”。
- 页面标题和 `knowledgeBoard.headline` 大面积重复。
- 右侧内容只做名词解释。
- 底部总结只是重复标题。
- 使用“本页围绕”“本页从……入手”等 authoring scaffold。

### 8.3 自学教材感

最终页面应像“压缩教材页”，不是：

- 老师上课用提纲。
- 博客摘要。
- 产品宣传页。
- 只有术语列表的知识卡。

学习者读完一页，应能说出一个新的判断，例如：

```text
Prompt Chaining 的关键不是多次调用模型，而是把任务拆成可检查、可替换、可定位失败的小步骤。
```

## 9. 质量指标

最终验收必须达到：

```text
qualityReport.score >= 90
qualityReport.status = passed 或 warning 但 warning 有明确记录和可接受原因
```

以下指标应为 0，或有逐项豁免说明：

- `templateLabelCount`
- `missingImagegenAssetCount`
- `genericTitleCount`
- `lowDensityPageCount`
- `genericSourceTraceSupportCount`
- `staleVisualPromptCount`
- `titleDuplicatedInImagePromptCount`
- `mechanismDepthWeakPageCount`

如果存在 major `automaticFindings`，不得直接向用户声明课程已达标。

## 10. 工程边界

### 10.1 Codex 负责

- 阅读 source semantics、course plan 和 content blueprint。
- 设计课程结构和页面知识链路。
- 执行三轮内容审核和修订。
- 设计 imagegen prompt。
- 调用 imagegen 生成教学插图。
- 对失败页面进行内容或图片修订。

### 10.2 MCP 负责

- 资料摄取、课程准备、发布、preview 文件写入。
- 生成 review brief。
- 记录 review report。
- 计算自动语义指标和 delta。
- 生成 imagegen manifest。
- 记录图片资产。
- 校验最终课程包。

### 10.3 不做的事

本阶段不做：

- 课程库 UI。
- 用户登录。
- 学习进度保存。
- 多用户队列。
- 在线部署。
- 新资料类型扩展。
- 自动替用户选择商业模型或外部图像来源。

## 11. 测试方案

### 11.1 单元测试

必须覆盖：

- `prepare_content_review` 输出 `currentMetrics` 和 `automaticFindings`。
- `record_content_review_report` 记录 delta。
- `create_imagegen_manifest` 生成每页 prompt。
- `record_imagegen_asset` 能写回 lesson JSON。
- `validate_imagegen_assets` 拦截缺图、SVG、非 imagegen provider、危险 prompt 和缺失 guard。
- self-study rubric 拦截模板栏目、重复标题、低密度页面。

### 11.2 集成验证

至少运行：

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run codex:mcp:check
```

### 11.3 真实资料验收

使用默认资料生成：

```text
self-study-agentic-design-patterns-quality-v1
```

验收记录应写入：

```text
docs/runtime/agentic-design-patterns-quality-acceptance.md
```

记录内容：

- 资料路径。
- 课程规模。
- 选定 topic。
- 三轮 review 摘要。
- review metrics delta。
- imagegen manifest 状态。
- imagegen validation 状态。
- 最终 preview URL。
- 最终质量分。
- 未解决问题和下一步。

## 12. 完成定义

本阶段完成的条件：

1. 中文 spec 已落地。
2. 实现缺口已补齐，且所有自动化测试通过。
3. 使用 `Agentic_Design_Patterns.pdf` 生成约 34 页课程包。
4. 完成最多三轮内容审核和修订。
5. 完成 imagegen manifest、图片记录和资产校验。
6. 最终质量分达到 `90+`。
7. preview 可打开，页面图文布局符合自学教材规则。
8. 验收记录写入 `docs/runtime/agentic-design-patterns-quality-acceptance.md`。

## 13. 后续演进

完成本阶段后，再考虑：

1. 扩到 5 个 topic 或全书学习路径。
2. 把三轮审核封装为一条更高层 MCP 工具。
3. 增加课程版本对比和回滚。
4. 增加课程库 UI。
5. 支持专利、博客、论文混合资料包的同一质量闭环。

