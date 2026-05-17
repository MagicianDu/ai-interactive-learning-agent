# 真实书籍和论文生产验收记录（2026-05-17）

本记录补充自动化 fixture 之外的真实资料验收。结论不能简化为“已通过”：真实书籍和真实论文都已跑检查，但它们暴露了当前生产链路的实际 gap。

## 资料

### 书籍

- Source: `/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf`
- 文件大小：19M
- `pdftotext` 可读取。
- 抽样内容识别到：`Agentic Design Patterns`，目录含 Prompt Chaining、Routing、Parallelization、Reflection、Tool Use、Planning、Multi-Agent、Memory Management、MCP、RAG、Guardrails、Evaluation 等章节。

### 论文

- Source: `/Users/dm/Documents/1.书籍资料/1.基础模型训练/推理/Agents Thinking Fast and Slow- A Talker-Reasoner Architecture.pdf`
- 文件大小：1.0M
- `pdftotext` 可读取。
- 抽样内容识别到：`Agents Thinking Fast and Slow: A Talker-Reasoner Architecture`，arXiv:2410.08328v1，abstract 明确提出 Talker/Reasoner 双系统架构。

## Run

### 书籍 run

- Run ID: `self-study-agentic-design-patterns-quality-v1`
- Source kind: `book`
- Source path: `/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf`
- Course shape: 4 units / 34 pages
- Units:
  - `unit-overview`: 10 pages
  - `unit-topic-01`: Prompt Chaining, 8 pages
  - `unit-topic-02`: Tool Use, 8 pages
  - `unit-topic-03`: Reflection, 8 pages

### 论文 run

- Run ID: `talker-reasoner-paper-authored-v5-20260507`
- Source kind: `paper`
- Source path: `/Users/dm/Documents/1.书籍资料/1.基础模型训练/推理/Agents Thinking Fast and Slow- A Talker-Reasoner Architecture.pdf`
- Course shape: 5 units / 40 pages
- Units:
  - `unit-overview`: 8 pages
  - `unit-topic-01`: 研究问题, 8 pages
  - `unit-topic-02`: 方法结构, 8 pages
  - `unit-topic-03`: 证据边界, 8 pages
  - `unit-topic-04`: 局限条件, 8 pages

## 验收命令和结果

### 1. 课程质量报告

书籍：

- `runs/self-study-agentic-design-patterns-quality-v1/quality/course-quality-report.json`
- Status: `passed`
- Score: `100`
- Top issues: `0`

论文：

- `runs/talker-reasoner-paper-authored-v5-20260507/quality/course-quality-report.json`
- Status: `passed`
- Score: `100`
- Top issues: `0`

解释：这两个分数来自旧的结构质量检查。它们不足以证明已经通过当前 one-shot production 标准。

### 2. 内容品味 review 指标

命令：

```bash
npx tsx -e "import { ContentReviewService } from './tools/agent-runtime/learner/content-review-service.ts'; /* prepareReview on both real runs */"
```

书籍结果：

- Pages: `34`
- `templateLabelCount`: `0`
- `missingImagegenAssetCount`: `0`
- `genericTitleCount`: `0`
- `lowDensityPageCount`: `0`
- `sourceAnchoredPageCount`: `34`
- `sourceTracePageCount`: `34`
- `mechanismDepthWeakPageCount`: `0`
- `weakKnowledgeClaimCount`: `0`
- Automatic findings: `0`

解释：书籍内容结构和知识密度通过当前 content-review 自动指标。

论文结果：

- Pages: `40`
- `missingImagegenAssetCount`: `40`
- `lowDensityPageCount`: `13`
- `sourceAnchoredPageCount`: `40`
- `sourceTracePageCount`: `0`
- `staleVisualPromptCount`: `40`
- `mechanismDepthWeakPageCount`: `40`
- `weakKnowledgeClaimCount`: `40`
- Automatic findings: `5`

解释：论文旧 run 在当前自学 Web Deck 标准下不合格。它有来源锚点，但缺少当前 `knowledgeBoard`、imagegen 资产、机制板书和足够知识密度。

### 3. Imagegen 资产校验

命令：

```bash
npx tsx -e "import { ImagegenAssetBatchService } from './tools/agent-runtime/learner/imagegen-asset-batch-service.ts'; /* validateAssets on both real runs */"
```

书籍结果：

- Status: `failed`
- Checked pages: `34`
- Issues: `30`
- Main issue: `imagegen.asset.duplicate-image-content`

解释：书籍 run 有每页图片文件和 `imageProvider=imagegen`，但多页图片内容完全重复，不满足“每页独立教学插图”的当前规则。

论文结果：

- Status: `failed`
- Checked pages: `40`
- Issues: `120`
- Main issues:
  - `imagegen.asset.provider-missing`
  - `imagegen.asset.url-not-preview`
  - `imagegen.asset.prompt-guard-missing`

解释：论文旧 run 不是当前 imagegen 生产形态，不能算通过。

### 4. Layout smoke

书籍命令：

```bash
npm run smoke:layout -- --runId self-study-agentic-design-patterns-quality-v1 --desktop-only
```

书籍结果：

- Status: `passed`
- Checked pages: `34`
- Issues: `0`

论文 layout smoke：

- 对 `talker-reasoner-paper-authored-v5-20260507` 试跑后长时间未完成，已终止。
- 该 run 缺当前 imagegen 资产和当前自学页面结构，不应将 layout 结果作为通过证据。

### 5. Production benchmark

命令：

```bash
npx tsx -e "import { CourseProductionBenchmarkService } from './tools/agent-runtime/learner/course-production-benchmark-service.ts'; /* evaluate real book + paper run */"
```

结果：

- Overall status: `failed`
- Book target:
  - Score: `100`
  - Review rounds: `3`
  - Review verdict: `pass`
  - Layout: `passed`
  - Blocking reason: missing/incomplete imagegen batch state
  - Warning: only 1 production repeat
- Paper target:
  - Score: `100`
  - Review rounds: `0`
  - Imagegen batch: missing
  - Layout report: missing
  - Warning: only 1 production repeat

## 结论

真实书籍和真实论文已经补测，但当前不能宣称“真实资料 one-shot production 已通过”。

- 书籍内容和布局已经接近当前标准，但需要重新生成独立 imagegen 插图，并补齐 batch state 后再跑 benchmark。
- 论文旧课程不符合当前 self-study Web Deck 标准，需要重新按 one-shot pipeline 创作，而不是沿用 2026-05-07 的旧 authored deck。
- 新增的 production benchmark 是有效的：它没有被旧的 `quality score=100` 误导，而是正确拦住了缺 imagegen batch、缺 content review、缺 layout evidence 的真实 run。

## 下一步

1. 对 `self-study-agentic-design-patterns-quality-v1` 执行 imagegen batch 重发：每页独立教学插图，修复 30 个 duplicate-image-content 问题。
2. 对 Talker-Reasoner 论文新建当前标准 run：`student_self_study_textbook`，总览 + 研究问题 + 架构机制 + 证据边界 + 局限条件。
3. 每个真实 source 至少保留两次 production repeat，再进入 `CourseProductionBenchmarkService`。
