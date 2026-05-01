# 完整学习产品开发 Spec

## 1. 文档目的

本文定义 AI Interactive Learning Agent 从当前 alpha 形态推进到完整学习产品所需的产品目标、用户路径、能力边界、数据对象、验收标准和开发阶段。

这个产品不是通用 PPT 生成器、课程大纲生成器，也不是面向开发者的 artifact 控制台。它的目标是把书籍、论文、专利、博客、文档、笔记和技术主题，重构成中文优先、来源可追溯、视觉化、可交互、有反馈、可迁移的学习体验，帮助学习者建立稳定的心智模型。

默认入口是 Codex、Claude 或未来 OpenClaw 这类自然语言 agent 环境。默认学习体验是浏览器里的互动课程。

## 2. 产品北极星

用户应该可以用自然语言说：

```text
这本书我想系统学一遍。
请先给我一门总览课，再按核心 topic 拆成多个学习单元。
每个单元 8 页，面向有编程基础但缺少系统心智模型的中文学习者。
生成可以直接打开学习的网页。
```

系统随后应该做到：

1. 理解资料、学习者画像、学习目标和课程组织方式。
2. 最多追问 3 个必要问题。
3. 不让学习者审批 `source-map`、`concept-map`、`curriculum-plan` 等内部 artifacts。
4. 快速生成可学习的中文预览。
5. 生成总览课，并按 topic、章节、任务或混合策略生成多个学习单元。
6. 保留来源锚点、章节映射和 topic 映射。
7. 输出 Web Deck 课程，包含视觉解释、互动、测验、误区检查、解释性反馈、迁移任务和总结卡。
8. 在前端默认打开学习界面，而不是开发者控制台。
9. 允许用户用自然语言反馈，并对指定课程、单元或页面做定向修订。
10. 在专家模式下保留 artifacts、质量报告、review gates 和审计能力。
11. 能把课程导出或分享为可运行的静态学习产品。

## 3. 完整 v1 产品定义

完整 v1 产品被接受的标准是：非开发者用户可以通过 Codex 或其他支持的 agent，从真实资料生成、查看、学习、修订、审计和分享一套中文互动课程。

完整 v1 必须包含：

- 自然语言创建学习项目。
- 书籍、论文、专利、博客、文档、笔记、混合资料和纯 topic 输入。
- 来源抽取、来源锚点和来源覆盖报告。
- 总览、章节、topic、任务、混合策略的课程规划。
- 多单元课程生成，而不是把一本书压缩成 8-12 页。
- Web Deck 学习体验。
- 知识地图视图。
- 至少一类可复用 playground。
- 用户反馈和定向修订。
- 中文优先、来源 grounding、课程质量和互动质量 gates。
- 项目库、预览、导出和可分享产物。
- 面向高级用户的 operator / audit 模式。

完整 v1 不要求：

- 云端账号系统。
- 多租户 SaaS。
- 付费、账单和团队管理。
- 移动端原生应用。
- 所有扫描 PDF 的完美 OCR。
- 完整 LMS 集成。
- 完全自动的付费大模型路由。

## 4. 当前基线

当前仓库已经具备：

- React / Vite Web Deck 应用。
- 结构化 lesson schema 和 course pack schema。
- lesson registry 和 course pack registry。
- 中文优先样例课程。
- learner-facing MCP 工具：
  - `learning_agent.create_learning_project`
  - `learning_agent.generate_grounded_course`
  - `learning_agent.publish_learning_course`
  - `learning_agent.get_learning_preview`
  - `learning_agent.generate_quick_preview`
  - `learning_agent.revise_learning_course`
- advanced/operator MCP 工具：plan、status、artifacts、gates、course run、promote 等。
- `tools/agent-runtime` 下的本地文件型 runtime。
- topic、text、file、folder、PDF、URL 等输入的 source normalization。
- source grounding、Chinese-first、lesson quality validators。
- book、paper、patent、blog 的 real-source regression。
- MCP 安装、seed user、source acceptance、beta operator loop 等文档。

当前主要缺口：

- 最新 learner-first UI 和 grounded demo course 仍未提交。
- learner 快速路径只生成有限课程切片，还不是完整多单元课程。
- 生成内容结构上合格，但仍偏模板化，对真实资料语义理解不够深。
- 反馈修订能记录意图，但还不能稳定做页面级、单元级的语义定向修改。
- URL / blog 抽取仍可能退化到 URL-level anchor。
- 项目管理仍偏本地文件，没有完整 learner project library。
- Web Deck 是唯一相对成熟的学习形态。
- 知识地图、playground、tutor、teacher、assessment 还只是早期产品面。

## 5. 用户角色

### 5.1 学习者

学习者只关心能不能学会，不应该理解内部 artifacts。

学习者需要：

- 用自然语言表达资料和目标。
- 快速看到中文课程。
- 看到清晰的总览、单元和页面结构。
- 通过视觉、互动和反馈学习，而不是阅读长文。
- 知道内容来自哪里。
- 能要求修改课程。

### 5.2 Operator

Operator 是 Codex、Claude、OpenClaw 或技术用户，负责驱动 runtime、调用 MCP、检查 artifacts 和处理失败。

Operator 需要：

- 稳定的工具契约。
- Durable run state。
- `reviewQueue` 和 `nextToolCalls`。
- 精确 artifact version。
- 可审计、可恢复的生成流程。

### 5.3 课程作者

课程作者负责把生成内容进一步打磨成高质量教学产品。

课程作者需要：

- 可编辑课程计划。
- 来源覆盖审计。
- lesson quality report。
- revision history。
- 可导出 course bundle。

### 5.4 教师

教师需要把课程用于课堂或训练场景。

教师需要：

- instructor notes。
- 建议节奏。
- 课堂问题。
- live demo 指引。
- 常见误区提示。
- 课后练习和评估题。

## 6. 核心用户路径

### 6.1 快速学习预览

流程：

1. 用户在 Codex 中提供 source path、URL 或 topic。
2. Codex 最多追问 3 个问题。
3. Codex 调用 `create_learning_project`。
4. Codex 调用 `generate_grounded_course`。
5. runtime 生成总览单元和初始 focused units。
6. Codex 调用 `get_learning_preview`。
7. 用户打开前端开始学习。

验收：

- learner path 不出现内部 artifact 审批。
- 预览入口清晰。
- 课程中文优先。
- 前端默认打开学习界面。

### 6.2 一本书生成完整课程

流程：

1. 用户提供 book PDF。
2. 用户选择 `overview_plus_topic`、`chapter_guided`、`topic_guided`、`task_guided` 或 `hybrid`。
3. 系统生成总览课。
4. 系统为所有选中章节或核心 topic 创建 planned units。
5. 系统渐进生成多个学习单元。
6. 前端显示 generated、pending、failed、revised 等状态。

验收：

- 一本书不会被压成一个 8-12 页 lesson。
- `unitPageCount` 表示每个学习单元页数。
- topic-first 课程仍保留章节映射。

### 6.3 用户反馈与定向修订

流程：

1. 用户查看课程。
2. 用户反馈：`第 3 页太抽象，换成更贴近工程实践的例子，并增加一个预测题`。
3. Codex 调用 `revise_learning_course`。
4. runtime 定位课程、单元、页面和修改类型。
5. runtime 修改目标内容并重新校验。
6. 前端预览更新。

验收：

- 修订范围明确。
- 页面反馈不应重生成无关单元。
- 修订后仍通过 Chinese-first、source grounding 和 lesson quality gates。

### 6.4 专家审计

流程：

1. 用户明确要求查看内部生成过程。
2. Codex 切换 advanced/operator mode。
3. Codex 汇报 `beta_status`、`reviewQueue` 和 `nextToolCalls`。
4. Codex 在 approval 前读取精确 artifact version。
5. Codex 只 promote approved lessons 和 critic reports。

验收：

- operator mode 可用，但不是默认 learner path。
- review gates 有 version。
- failed gates 给出可执行修复建议。

### 6.5 导出与分享

流程：

1. 用户接受课程。
2. Codex 调用 export/package flow。
3. runtime 写出静态课程 bundle。
4. bundle 包含 manifest、lessons、source mapping summary 和前端资源。
5. 用户可脱离生成流程打开课程。

验收：

- export 记录 source title、course id、unit ids、approved artifact versions 和 generation warnings。
- dev preview 与 static preview 渲染一致。

## 7. 产品能力模块

### 7.1 自然语言 intake

职责：

- 把用户请求转成 typed learning project。
- 识别 source、audience、language、strategy、unitPageCount、selectedChapters、selectedTopics 和 outputForms。
- 生成最多 3 个 clarification questions。

必需字段：

- `source`
- `sourceKind`
- `language`
- `audience`
- `strategy`
- `unitPageCount`
- `selectedChapters`
- `selectedTopics`
- `outputForms`

验收：

- 常见中文请求可稳定解析。
- 缺失字段产生清晰追问。
- project brief 人类可读。

### 7.2 source ingestion 与 grounding

职责：

- 把原始资料转成 source nodes、anchors、source facts 和 warnings。
- 支持 PDF、text、Markdown、HTML、URL、folder 和 mixed corpus。

不同资料的最低要求：

- book：页码、章节、小节、关键概念、例子。
- paper：abstract、problem、method、experiment、result、limitation、contribution。
- patent：claims、embodiments、technical solution、figures、terms。
- blog/docs：heading hierarchy、steps、code snippets、URL anchors。
- notes：文件路径、标题、段落、列表结构。

验收：

- source-backed claim 必须有 anchor，或者标记为 inference / analogy。
- extraction warnings 不能被吞掉。
- real-source regression 至少覆盖 book、paper、patent、blog。

### 7.3 concept map 与 curriculum plan

职责：

- 把 source facts 变成可教学结构。
- 规划课程路径和学习单元。

必须生成：

- concept dependencies。
- examples。
- misconceptions。
- candidate interactions。
- overview unit。
- unit list。
- chapter mapping。
- topic mapping。
- source coverage。
- generation status。

验收：

- 长资料生成多个 planned units。
- overview unit 解释整体结构。
- focused units 有明确学习目标和来源覆盖。
- learner UI 展示课程结构，但默认不暴露内部 artifact JSON。

### 7.4 lesson generation

职责：

- 把 unit plan 生成结构化 lesson。

每个标准 lesson 必须包含：

- learning objectives。
- prerequisite assumptions。
- 用户指定或默认 8-12 页。
- problem-first opening。
- visual explanations。
- meaningful interactions。
- quiz / prediction check。
- misconception check。
- transfer challenge。
- summary card。
- sourceContext / source anchors。

验收：

- 中文优先。
- 每页一个 learning goal。
- 先直觉和操作，再术语、公式或代码。
- 互动必须有认知目的。
- feedback 解释机制，而不只是对错。

### 7.5 interaction 与 playground

职责：

- 提供可复用互动组件。
- 支持面向 topic 的 playground。

必需 interaction families：

- prediction。
- multiple choice with explanatory feedback。
- step-through execution。
- parameter experiment。
- ordering / process reconstruction。
- build-from-parts。
- debugging / diagnosis。

v1 playground families：

- algorithm execution playground。
- system pipeline playground。
- parameter experiment playground。

验收：

- 每个 interaction 都声明 learnerAction、expectedObservation、cognitivePurpose 和 feedback。
- playground spec 可序列化。
- 互动不是装饰性 reveal button。

### 7.6 quality gates

职责：

- 在发布前拦截弱课程。

必需 validators：

- Chinese-first validator。
- Source-grounding validator。
- Lesson-quality validator。
- Interaction-quality validator。
- Curriculum-coverage validator。
- Revision-diff validator。

验收：

- promotion 失败时说明 failing page、field 和 rule。
- critic report 区分 blocking fixes 与 optional improvements。
- learner path 可以自动修复常见结构问题，不把内部审批推给学习者。
- expert mode 可以检查具体失败 artifact。

### 7.7 learner web product

职责：

- 提供默认学习体验。

必需页面：

- Course library。
- Course overview。
- Unit learning view。
- Knowledge map。
- Playground view。
- Assessment view。
- Feedback panel。
- Source/citation panel。
- Export/share panel。

默认首屏：

- 如果有课程，打开最近或指定课程的学习视图。
- 不默认展示 generation timeline 或内部 artifacts。
- 高级操作细节只在用户明确进入 expert mode 时显示。

验收：

- 学习者打开前端即可开始学。
- course / unit / page navigation 清晰。
- source anchors 可查看但不干扰学习。
- empty、loading、failed、pending states 明确。
- UI label 中文优先。

### 7.8 AI tutor mode

职责：

- 围绕当前课程、页面、互动状态和学习者回答进行辅导。
- 不用纯聊天替代视觉和互动学习。

必需行为：

- 读取 active course、unit、page、interaction state、learner answer 和 source anchors。
- 提出 diagnostic questions。
- 解释 feedback。
- 建议下一步操作。
- 记录 misconception signals。
- 对无来源支持的内容标注 inference。

验收：

- tutor 建议绑定当前页面和来源。
- 关闭 tutor 不影响核心课程。
- tutor 不绕过视觉和互动学习。

### 7.9 teacher 与 assessment modes

职责：

- 从同一 course object 派生教师材料和评估材料。

teacher mode 包含：

- instructor notes。
- pacing。
- classroom questions。
- live demo instructions。
- common misconceptions。
- post-class exercises。

assessment mode 包含：

- recall checks。
- prediction checks。
- misconception checks。
- transfer tasks。
- applied debugging / design tasks。

验收：

- teacher 和 assessment 输出回链到 learning objectives 和 source concepts。
- 前端可预览。
- runtime 可导出到 `runs/<run-id>/exports/`。

### 7.10 project library 与 persistence

职责：

- 把产品从一次性生成器变成可持续使用的学习工具。

必需行为：

- list projects。
- open recent project。
- show project status。
- rename project。
- archive project。
- delete preview safely。
- track revisions。
- track published versions。

验收：

- seed user 可以创建多个课程并重新打开。
- UI 区分 source project、generated course、published course 和 exported bundle。

### 7.11 runtime 与 integration

职责：

- 保持 local-first、agent-operable、可测试。

必需行为：

- MCP tools 包装 runtime services，不复制 orchestration logic。
- CLI 保留用于测试和调试。
- adapter identity 与 model selection 分离。
- Codex、Claude、OpenClaw-style clients 通过同一 tool contract 操作。
- 不支持的能力显式失败。

验收：

- `codex:mcp:check` 可验证安装。
- tool contracts 文档化。
- state 持久化到 `runs/<run-id>/`。
- published artifacts 记录 artifact versions。

## 8. 核心数据对象

### 8.1 LearningProject

表示用户意图和资料设置。

字段：

- `projectId`
- `title`
- `sourceRefs`
- `sourceKind`
- `audience`
- `language`
- `strategy`
- `unitPageCount`
- `selectedChapters`
- `selectedTopics`
- `createdAt`
- `updatedAt`
- `status`

### 8.2 SourceMap

表示资料抽取和来源覆盖。

字段：

- `sources`
- `nodes`
- `anchors`
- `extractionWarnings`
- `coverageSummary`

### 8.3 ConceptMap

表示可教学概念和关系。

字段：

- `concepts`
- `dependencies`
- `examples`
- `misconceptions`
- `candidateInteractions`
- `sourceAnchorRefs`

### 8.4 CurriculumPlan

表示课程组织结构。

字段：

- `strategy`
- `overviewUnit`
- `units`
- `chapterMapping`
- `topicMapping`
- `sourceCoverage`
- `generationStatus`

### 8.5 CoursePack

表示前端可加载的课程产品。

字段：

- `courseId`
- `title`
- `description`
- `language`
- `sourceSummary`
- `strategy`
- `units`
- `coverage`
- `forms`
- `publishManifest`

### 8.6 LessonUnit

表示一个互动学习单元。

字段：

- `id`
- `title`
- `audience`
- `prerequisites`
- `learningObjectives`
- `pages`
- `misconceptions`
- `transferTasks`
- `summary`
- `sourceContext`
- `qualityReport`

### 8.7 RevisionBrief

表示用户要求的一次修改。

字段：

- `revisionId`
- `targetScope`
- `userFeedback`
- `intendedChange`
- `changedArtifacts`
- `validationResult`

## 9. 产品模式

### 9.1 Learner Mode

默认模式。隐藏内部 artifacts，面向学习。

可见能力：

- 开始学习。
- 选择课程和单元。
- 查看知识地图。
- 使用 playground。
- 回答测验。
- 提交反馈。
- 查看来源。

### 9.2 Author Mode

用于打磨课程。

可见能力：

- course plan。
- unit status。
- page list。
- quality report。
- revision history。
- source coverage。

### 9.3 Operator Mode

用于 runtime/MCP/debug。

可见能力：

- `beta_status`。
- `reviewQueue`。
- `nextToolCalls`。
- artifact versions。
- approve / revise gates。
- promote units。

## 10. 课程质量标准

课程可发布的最低标准：

- 中文优先。
- 明确 audience 和 prerequisite。
- 从真实问题开始。
- 概念顺序连贯。
- source-backed claim 有 anchors。
- 对隐藏结构或过程使用视觉解释。
- 标准单元至少包含 2 个有意义互动。
- feedback 解释原因和机制。
- 包含 misconception check。
- 以 transfer challenge 收束。
- promote 后本地 typecheck、lint、test、build 通过。

## 11. 开发阶段

### Phase 0：稳定当前 alpha

目标：

让当前 learner-first UI 和 grounded demo 状态干净、可复现、可提交。

交付：

- 提交当前 learner-first UI。
- 清理或明确标记生成 demo artifacts。
- 跑通 `typecheck`、`lint`、`test`、`build`、`source:regression`、`seed:check`、`codex:mcp:check`。

验收：

- fresh checkout 可以复现 demo。
- 前端默认是学习界面。

### Phase 1：Learning Project Model

目标：

引入一等 learning project 和 project library。

交付：

- Project registry。
- Recent project selection。
- Project status model。
- Course/library UI。
- Safe archive/delete。

验收：

- 用户可以创建多个学习项目并重新打开。
- 状态区分 draft、generating、preview-ready、failed、revised、published、exported。

### Phase 2：完整 source understanding

目标：

从 source anchoring 进入 source-semantic teaching。

交付：

- book、paper、patent、blog、docs、notes、mixed corpus 的语义抽取。
- source facts。
- section/chapter/topic inference。
- coverage reports。
- 更可靠的 URL/blog 正文抽取。

验收：

- book overview 反映整本书结构。
- paper 课程区分 problem、method、evidence、assumptions、limitations。
- patent 课程区分 claims、embodiments、terms、technical solution。
- blog 课程变成可操作教程，而不是摘要。

### Phase 3：多单元课程生成

目标：

生成完整课程，而不是只生成 preview unit。

交付：

- Overview unit generation。
- Batch unit planning。
- Progressive unit generation。
- Planned、pending、failed、complete unit statuses。
- chapter/topic/task/hybrid path selection。

验收：

- 长资料可以生成总览课和多个学习单元。
- `unitPageCount`、`selectedChapters`、`selectedTopics` 被保留。

### Phase 4：source-semantic lesson writer

目标：

降低模板感，提高资料特异性和教学深度。

交付：

- Unit-specific teaching angle。
- Source-specific examples。
- Source-specific misconceptions。
- Bespoke interaction recommendations。
- Page-level source usage plan。

验收：

- 书籍、论文、专利、博客生成的课程风格和结构明显不同。
- 页面讲的是资料中的真实思想，而不是通用 topic 壳。

### Phase 5：Learner Web Product v1

目标：

让浏览器体验像一个学习产品。

交付：

- Course library。
- Course overview。
- Unit list。
- Web Deck polish。
- Source panel。
- Feedback panel。
- Knowledge map v1。
- course/unit/page stable URLs。

验收：

- 学习者打开 app 即进入学习流。
- 多单元书籍课程导航清晰。
- UI 默认不面向开发者。

### Phase 6：反馈与定向修订

目标：

让自然语言反馈修改正确的课程局部。

交付：

- course、unit、page、interaction、assessment、source issue 的 revision targeting。
- diff summary。
- revision revalidation。
- revision history UI。

验收：

- 页面反馈只修改目标页面。
- 课程结构反馈会修改 plan 和受影响 units。

### Phase 7：Playground 与互动扩展

目标：

把操作、因果和反馈做成核心产品能力。

交付：

- Algorithm execution playground。
- System pipeline playground。
- Parameter experiment playground。
- Serializable playground specs。
- Lesson-to-playground deep links。

验收：

- 至少一个 source-backed course 包含可用 playground。
- playground feedback 解释观察结果背后的机制。

### Phase 8：Tutor、Teacher、Assessment

目标：

扩展自学、教学和评估场景。

交付：

- Tutor mode。
- Teacher mode。
- Assessment mode。
- 可导出的 teacher / assessment materials。

验收：

- tutor 能围绕 quiz 或 interaction 提供 grounded guidance。
- teacher 和 assessment 输出能回链到 objectives 和 source concepts。

### Phase 9：Export、Share、Operations

目标：

让课程可携带、可分享、可恢复。

交付：

- Static export bundle。
- Publish manifest。
- Shareable preview route。
- Run dashboard。
- Failure recovery guidance。
- 基础 event log。

验收：

- 用户可以导出课程并脱离生成流程重新打开。
- 生成失败能被理解和恢复。

### Phase 10：多 agent / 多 runtime hardening

目标：

让 Codex、Claude 和未来 OpenClaw-style clients 成为稳定 operator。

交付：

- Stable MCP contract。
- Client-specific usage docs。
- Adapter capability matrix。
- Model selection and capability validation。
- Runtime logs 记录 adapter、model、artifact versions、warnings、promotion results。

验收：

- 同一学习请求可以由支持的 agent clients 通过同一 runtime contract 执行。
- 不支持的 model/client 能力显式失败。

## 12. 里程碑验收

### 12.1 Seed-Ready Product

验收标准：

- 当前 alpha 干净提交。
- 用户可从 Codex 创建 source-backed project，不需要审批内部 artifacts。
- 长资料可生成总览课和至少两个 focused units。
- 前端默认打开 learner mode。
- 用户反馈可修订单元或页面。
- book、paper、patent、blog source regression 通过。

### 12.2 Beta Product

验收标准：

- project library 可用。
- 多单元生成稳定。
- Knowledge map v1 可用。
- 至少一个 generated unit 有可用 playground。
- targeted revisions 通过 validators。
- export bundle 可用。
- seed-user quickstart 准确。

### 12.3 Complete v1 Product

验收标准：

- learner、author、operator modes 都清晰可用。
- 支持的 agent clients 可通过 MCP 完成自然语言操作。
- source-grounded course 可以生成、修订、预览、导出和审计。
- Web Deck、Knowledge Map、Playground、Tutor、Teacher、Assessment 从同一个 course object 派生。
- quality gates 能在发布前拦截弱输出。

## 13. 验证策略

每个产品增量必须跑：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

涉及 runtime 的增量还必须跑：

```bash
npm run codex:mcp:check
npm run source:regression
npm run seed:check
```

涉及前端的增量必须做浏览器验证：

- Course library。
- Course overview。
- Unit navigation。
- Page navigation。
- Interaction feedback。
- Quiz feedback。
- Source panel。
- Feedback/revision entry。

真实资料验收至少覆盖：

- 一本书。
- 一篇论文。
- 一份专利。
- 一篇博客或文档。

## 14. 产品指标

Seed-user 阶段应记录：

- request 到 first preview 的耗时。
- clarification question 数量。
- learner path 中出现的内部审批数量。
- generated unit 数量。
- unit source coverage。
- quality-gate pass rate。
- revision success rate。
- 用户对 overview unit 的有用性评分。
- 用户对 focused units 的有用性评分。

目标方向：

- learner path 内部 artifact 审批数量为 0。
- first preview 足够快，可以作为互动式试用。
- 长资料课程必须暴露多个学习单元。
- revision 应优先修改目标内容，而不是默认全量重生成。

## 15. 开发原则

1. 默认 UI 不做开发者控制台。
2. 不让学习者审批内部 artifacts。
3. source anchoring 不等于教学质量，必须理解并教授资料语义。
4. 长资料不能压缩成一个短 lesson。
5. 新 product form 必须复用 structured course object。
6. source-backed claim 必须有 anchor、inference 标记或 analogy 标记。
7. 互动不能是装饰。
8. 不能绕过 validators 做 demo。
9. 保留 expert/operator mode，但必须由用户显式进入。
10. 中文优先是默认产品语言。

## 16. 推荐下一份 Implementation Plan 范围

下一份 implementation plan 不应该覆盖全部 10 个 phase，而应该聚焦 Seed-Ready Product。

推荐任务：

1. 稳定并提交当前 learner-first UI。
2. 增加一等 project registry 和 project library。
3. 把 `generate_grounded_course` 从 preview slice 升级到 multi-unit generation。
4. 增强 book、paper、patent、blog 的 source-semantic extraction。
5. 增加 revision targeting 和 revalidation。
6. 增加 course / unit / page stable routes。
7. 基于现有 course/concept 数据生成 Knowledge Map v1。
8. 增加 export bundle 和 publish manifest。
9. 扩展 source regression，使其验证语义课程期待，而不只是 anchor 数量。

这个顺序优先补齐真实用户可感知的产品完整性，再继续扩展更高级的 UI 形态。

