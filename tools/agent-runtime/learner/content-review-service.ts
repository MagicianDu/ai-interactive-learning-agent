import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";

export type PrepareContentReviewInput = {
  runId: string;
  maxRounds?: number;
  minScore?: number;
};

export type PrepareContentReviewResult =
  | {
      status: "revision_required";
      runId: string;
      round: number;
      maxRounds: number;
      reviewBriefPath: string;
      codexInstruction: string;
    }
  | {
      status: "review_complete";
      runId: string;
      round: number;
      maxRounds: number;
      stopReason: string;
    };

export type ContentReviewVerdict = "pass" | "revise" | "block";
export type ContentReviewIssueSeverity = "critical" | "major" | "minor";
export type ContentReviewIssueCategory =
  | "density"
  | "knowledge_density"
  | "content_taste"
  | "source_fidelity"
  | "structure"
  | "image_text_fit"
  | "template_language"
  | "learner_readability";

export type ContentReviewIssue = {
  lessonId?: string;
  pageId?: string;
  severity: ContentReviewIssueSeverity;
  category: ContentReviewIssueCategory;
  finding: string;
  recommendation: string;
};

export type ContentReviewMetrics = {
  lessonCount: number;
  pageCount: number;
  templateLabelCount: number;
  missingImagegenAssetCount: number;
  genericTitleCount: number;
  lowDensityPageCount: number;
  sourceAnchoredPageCount: number;
  sourceTracePageCount: number;
  genericSourceTraceSupportCount: number;
  staleVisualPromptCount: number;
  titleDuplicatedInImagePromptCount: number;
  mechanismDepthWeakPageCount: number;
  boilerplateLearnerPhraseCount: number;
  repeatedBoardSectionLabelCount: number;
  titleCorePropositionOverlapCount: number;
  bottomLineRepeatsTitleCount: number;
  genericImageIntentCount: number;
  weakKnowledgeClaimCount: number;
};

export type ContentReviewMetricDelta = ContentReviewMetrics & {
  issueCount: number;
};

export type RecordContentReviewReportInput = {
  runId: string;
  round: number;
  reviewerVerdict?: ContentReviewVerdict;
  summary: string;
  issues: ContentReviewIssue[];
};

export type RecordContentReviewReportResult = {
  status: "review_report_recorded";
  runId: string;
  round: number;
  reviewerVerdict: ContentReviewVerdict;
  reportPath: string;
  statePath: string;
  metrics: ContentReviewMetrics;
  delta: ContentReviewMetricDelta | null;
  finalVerdict?: ContentReviewVerdict;
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const REVIEW_VERDICTS = new Set<ContentReviewVerdict>(["pass", "revise", "block"]);
const ISSUE_SEVERITIES = new Set<ContentReviewIssueSeverity>(["critical", "major", "minor"]);
const ISSUE_CATEGORIES = new Set<ContentReviewIssueCategory>([
  "density",
  "knowledge_density",
  "content_taste",
  "source_fidelity",
  "structure",
  "image_text_fit",
  "template_language",
  "learner_readability"
]);
const TEMPLATE_LABELS = new Set([
  "机制链",
  "机制板书",
  "正式术语",
  "例子 / 证据",
  "例子/证据",
  "边界案例",
  "来源证据",
  "术语落地",
  "边界",
  "机制链路"
]);
const GENERIC_PAGE_TITLES = new Set([
  "直观模型",
  "机制链路",
  "来源证据",
  "迁移总结",
  "先看失败",
  "结构与术语",
  "正式术语",
  "机制板书"
]);
const LOW_DENSITY_CHAR_THRESHOLD = 120;
const MECHANISM_DEPTH_MIN_ITEM_COUNT = 4;
const GENERIC_SOURCE_TRACE_SUPPORT_PATTERNS = [
  /支撑本页核心命题/u,
  /给出来源证据或边界/u,
  /来源支持这个命题/u,
  /支撑这个命题/u,
  /给出证据/u
];
const BOILERPLATE_LEARNER_PHRASE_PATTERNS = [
  /本页(帮助|带你|让你|会|将)/u,
  /建立(正确|完整|清晰)?心智模型/u,
  /掌握核心内容/u,
  /快速理解/u,
  /更好地理解/u
];
const REPEATED_BOARD_LABEL_THRESHOLD = 3;
const GENERIC_IMAGE_INTENT_PATTERNS = [
  /^教学插图$/u,
  /^解释本页的关键知识关系$/u,
  /^用于解释.*的教学插图$/u,
  /表达条件、关系和边界/u
];

export class ContentReviewService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async prepareReview(input: PrepareContentReviewInput): Promise<PrepareContentReviewResult> {
    assertSafeRunId(input.runId);
    const maxRounds = normalizeMaxRounds(input.maxRounds);
    const completedRounds = await this.countReviewRounds(input.runId);
    if (completedRounds >= maxRounds) {
      return {
        status: "review_complete",
        runId: input.runId,
        round: completedRounds,
        maxRounds,
        stopReason: "max review rounds reached; use the latest revised bundle for publishing"
      };
    }

    const round = completedRounds + 1;
    const coursePack = await this.readPreviewJson(input.runId, "course-pack.json");
    const lessonPaths = await this.listLessonPaths(input.runId);
    const lessons = await Promise.all(lessonPaths.map((lessonPath) => this.readPreviewJson(input.runId, `lessons/${lessonPath}`)));
    const quality = await this.readQuality(input.runId);
    const currentMetrics = await this.collectMetrics(input.runId);
    const automaticFindings = buildAutomaticFindings(currentMetrics);
    const reviewBrief = {
      runId: input.runId,
      round,
      maxRounds,
      criticRole: "content-review-agent",
      targetQuality: {
        minScore: input.minScore ?? 90,
        learnerMode: inferLearnerMode(lessons)
      },
      roundFocus: roundFocus(round),
      reviewPrinciples: [
        "挑刺优先：指出内容泛、跳步、低密度、模板化、图文不匹配的位置。",
        "学生自学优先：每页必须能让学生获得一个明确知识判断。",
        "来源优先：source-backed 页面必须讲出来源材料的具体概念或关系。",
        "内容品味优先：删除课程模板腔、重复栏目名和不给知识判断的自我说明。",
        "第三轮产出优先：第 3 轮只保留可发布内容，不保留批注过程。"
      ],
      reviewerOutputContract: {
        critiqueFirst: true,
        reviseSecond: true,
        recordReportTool: "learning_agent.record_content_review_report",
        finalRoundPublishesCleanBundle: round === maxRounds,
        preserveCoursePackUnits: true
      },
      reviewReportContract: {
        tool: "learning_agent.record_content_review_report",
        requiredFields: ["runId", "round", "reviewerVerdict", "summary", "issues"],
        issueCategories: Array.from(ISSUE_CATEGORIES),
        issueSeverities: Array.from(ISSUE_SEVERITIES)
      },
      currentMetrics,
      automaticFindings,
      coursePack,
      lessons,
      quality
    };
    const reviewBriefPath = await this.writeBrief(input.runId, round, reviewBrief);
    return {
      status: "revision_required",
      runId: input.runId,
      round,
      maxRounds,
      reviewBriefPath,
      codexInstruction: buildCodexInstruction(round, maxRounds, reviewBriefPath)
    };
  }

  async recordReviewReport(input: RecordContentReviewReportInput): Promise<RecordContentReviewReportResult> {
    assertSafeRunId(input.runId);
    const round = normalizeRound(input.round);
    const issues = normalizeIssues(input.issues);
    const reviewerVerdict = normalizeVerdict(input.reviewerVerdict, issues.length);
    const summary = normalizeRequiredText(input.summary, "summary");
    const metrics = await this.collectMetrics(input.runId);
    const previousReport = await this.readPreviousReport(input.runId, round);
    const delta = previousReport ? diffMetrics(metrics, previousReport.metrics, issues.length, previousReport.issueCount) : null;
    const report = {
      runId: input.runId,
      round,
      reviewerVerdict,
      summary,
      issueCount: issues.length,
      issues,
      metrics,
      delta,
      recordedAt: new Date().toISOString(),
      recommendedNextAction: recommendedNextAction(round, reviewerVerdict)
    };
    const reportPath = await this.writeReport(input.runId, round, report);
    const statePath = await this.writeState(input.runId, round, reviewerVerdict, metrics, delta, reportPath);

    return {
      status: "review_report_recorded",
      runId: input.runId,
      round,
      reviewerVerdict,
      reportPath,
      statePath,
      metrics,
      delta,
      ...(round >= 3 ? { finalVerdict: reviewerVerdict } : {})
    };
  }

  private async readPreviewJson(runId: string, relativePath: string): Promise<unknown> {
    return JSON.parse(await readFile(path.join(this.previewRoot(runId), relativePath), "utf8")) as unknown;
  }

  private async readQuality(runId: string): Promise<unknown> {
    const qualityPath = path.join(this.runRoot(runId), "quality", "course-quality-report.json");
    return JSON.parse(await readFile(qualityPath, "utf8")) as unknown;
  }

  private async listLessonPaths(runId: string): Promise<string[]> {
    const lessonsDir = path.join(this.previewRoot(runId), "lessons");
    return (await readdir(lessonsDir)).filter((entry) => entry.endsWith(".json")).sort();
  }

  private async countReviewRounds(runId: string): Promise<number> {
    const entries = await readdir(this.reviewDir(runId)).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return [];
      }
      throw error;
    });
    return entries.filter((entry) => /^round-[0-9]{3}-content-review\.json$/u.test(entry)).length;
  }

  private async collectMetrics(runId: string): Promise<ContentReviewMetrics> {
    const lessonPaths = await this.listLessonPaths(runId);
    const lessons = await Promise.all(lessonPaths.map((lessonPath) => this.readPreviewJson(runId, `lessons/${lessonPath}`)));
    const metrics: ContentReviewMetrics = {
      lessonCount: lessons.length,
      pageCount: 0,
      templateLabelCount: 0,
      missingImagegenAssetCount: 0,
      genericTitleCount: 0,
      lowDensityPageCount: 0,
      sourceAnchoredPageCount: 0,
      sourceTracePageCount: 0,
      genericSourceTraceSupportCount: 0,
      staleVisualPromptCount: 0,
      titleDuplicatedInImagePromptCount: 0,
      mechanismDepthWeakPageCount: 0,
      boilerplateLearnerPhraseCount: 0,
      repeatedBoardSectionLabelCount: 0,
      titleCorePropositionOverlapCount: 0,
      bottomLineRepeatsTitleCount: 0,
      genericImageIntentCount: 0,
      weakKnowledgeClaimCount: 0
    };

    for (const lesson of lessons) {
      if (!isRecord(lesson) || !Array.isArray(lesson.pages)) {
        continue;
      }
      const boardLabelsInLesson: string[] = [];
      for (const page of lesson.pages) {
        if (!isRecord(page)) {
          continue;
        }
        metrics.pageCount += 1;
        metrics.templateLabelCount += countTemplateLabels(page);
        if (await isMissingImagegenAsset(this.previewRoot(runId), runId, page)) {
          metrics.missingImagegenAssetCount += 1;
        }
        if (isGenericTitle(page.title)) {
          metrics.genericTitleCount += 1;
        }
        if (contentDensityChars(page) < LOW_DENSITY_CHAR_THRESHOLD) {
          metrics.lowDensityPageCount += 1;
        }
        if (Array.isArray(page.sourceAnchorIds) && page.sourceAnchorIds.length > 0) {
          metrics.sourceAnchoredPageCount += 1;
        }
        const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
        if (knowledgeBoard && Array.isArray(knowledgeBoard.sourceTrace) && knowledgeBoard.sourceTrace.length > 0) {
          metrics.sourceTracePageCount += 1;
          metrics.genericSourceTraceSupportCount += countGenericSourceTraceSupports(knowledgeBoard.sourceTrace);
        }
        if (hasStaleVisualPrompt(page)) {
          metrics.staleVisualPromptCount += 1;
        }
        if (titleDuplicatedInImagePrompt(page)) {
          metrics.titleDuplicatedInImagePromptCount += 1;
        }
        if (mechanismDepthWeak(page)) {
          metrics.mechanismDepthWeakPageCount += 1;
        }
        metrics.boilerplateLearnerPhraseCount += countBoilerplateLearnerPhrases(page);
        if (titleCorePropositionOverlap(page)) {
          metrics.titleCorePropositionOverlapCount += 1;
        }
        if (bottomLineRepeatsTitle(page)) {
          metrics.bottomLineRepeatsTitleCount += 1;
        }
        if (genericImageIntent(page)) {
          metrics.genericImageIntentCount += 1;
        }
        if (weakKnowledgeClaim(page)) {
          metrics.weakKnowledgeClaimCount += 1;
        }
        boardLabelsInLesson.push(...boardSectionLabels(page));
      }
      metrics.repeatedBoardSectionLabelCount += countRepeatedBoardSectionLabels(boardLabelsInLesson);
    }

    return metrics;
  }

  private async readPreviousReport(
    runId: string,
    round: number
  ): Promise<{ metrics: ContentReviewMetrics; issueCount: number } | null> {
    if (round <= 1) {
      return null;
    }
    const previousPath = this.reportPath(runId, round - 1);
    const report = await readJsonIfExists(previousPath);
    if (!isRecord(report) || !isContentReviewMetrics(report.metrics)) {
      return null;
    }
    return {
      metrics: report.metrics,
      issueCount: typeof report.issueCount === "number" ? report.issueCount : 0
    };
  }

  private async writeBrief(runId: string, round: number, brief: Record<string, unknown>): Promise<string> {
    const dir = this.reviewDir(runId);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `round-${String(round).padStart(3, "0")}-content-review.json`);
    await writeFile(filePath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
    return filePath;
  }

  private async writeReport(runId: string, round: number, report: Record<string, unknown>): Promise<string> {
    const dir = this.reviewDir(runId);
    await mkdir(dir, { recursive: true });
    const filePath = this.reportPath(runId, round);
    await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return filePath;
  }

  private async writeState(
    runId: string,
    round: number,
    reviewerVerdict: ContentReviewVerdict,
    metrics: ContentReviewMetrics,
    delta: ContentReviewMetricDelta | null,
    reportPath: string
  ): Promise<string> {
    const dir = this.reviewDir(runId);
    await mkdir(dir, { recursive: true });
    const reportPaths = await this.listReportPaths(runId, reportPath);
    const state = {
      runId,
      latestRound: round,
      latestVerdict: reviewerVerdict,
      ...(round >= 3 ? { finalVerdict: reviewerVerdict } : {}),
      latestMetrics: metrics,
      latestDelta: delta,
      reportPaths
    };
    const statePath = path.join(dir, "content-review-state.json");
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return statePath;
  }

  private async listReportPaths(runId: string, currentReportPath: string): Promise<string[]> {
    const entries = await readdir(this.reviewDir(runId)).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return [];
      }
      throw error;
    });
    const existing = entries
      .filter((entry) => /^round-[0-9]{3}-content-review-report\.json$/u.test(entry))
      .map((entry) => path.join(this.reviewDir(runId), entry));
    return Array.from(new Set([...existing, currentReportPath])).sort();
  }

  private reportPath(runId: string, round: number): string {
    return path.join(this.reviewDir(runId), `round-${String(round).padStart(3, "0")}-content-review-report.json`);
  }

  private runRoot(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId);
  }

  private previewRoot(runId: string): string {
    return path.join(this.runRoot(runId), "preview");
  }

  private reviewDir(runId: string): string {
    return path.join(this.runRoot(runId), "quality", "content-review");
  }
}

function buildCodexInstruction(round: number, maxRounds: number, reviewBriefPath: string): string {
  return [
    `请执行第 ${round} / ${maxRounds} 轮内容审核。`,
    `读取 review brief: ${reviewBriefPath}`,
    "你现在扮演 content-review-agent，先给 Codex 挑刺，再输出修订后的 coursePack/lessons。",
    "重点检查：知识密度、来源具体性、图文匹配、模板化标题、学生是否能自学。",
    "优先处理 review brief 中的 currentMetrics 与 automaticFindings；这些是 MCP 自动发现的语义质量风险。",
    "不要改 coursePack.units、unit page counts、sourceAnchorIds，除非当前来源锚点明显错误。",
    "修订和重新 publish 后，调用 learning_agent.record_content_review_report 记录 reviewerVerdict、问题列表、指标和 delta。",
    round === maxRounds ? "这是第 3 轮：只产出可发布版本，去掉审核批注和过程性语言。" : "修订后调用 learning_agent.publish_learning_course，再进入下一轮审核。"
  ].join("\n");
}

function inferLearnerMode(lessons: unknown[]): string {
  return lessons.some((lesson) => isRecord(lesson) && lesson.displayMode === "textbook_deck") ? "student_self_study_textbook" : "learning_deck";
}

function roundFocus(round: number): string {
  if (round === 1) {
    return "structure-and-knowledge-chain";
  }
  if (round === 2) {
    return "source-fidelity-and-density";
  }
  return "learner-readability-and-image-text-fit";
}

function normalizeMaxRounds(value: number | undefined): number {
  if (value === undefined) {
    return 3;
  }
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AgentRuntimeError("maxRounds must be an integer between 1 and 5", "INVALID_RUN_CONFIG");
  }
  return value;
}

function normalizeRound(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AgentRuntimeError("round must be an integer between 1 and 5", "INVALID_RUN_CONFIG");
  }
  return value;
}

function normalizeVerdict(value: ContentReviewVerdict | undefined, issueCount: number): ContentReviewVerdict {
  if (value === undefined) {
    return issueCount > 0 ? "revise" : "pass";
  }
  if (!REVIEW_VERDICTS.has(value)) {
    throw new AgentRuntimeError("reviewerVerdict must be pass, revise, or block", "INVALID_RUN_CONFIG");
  }
  return value;
}

function normalizeIssues(value: ContentReviewIssue[]): ContentReviewIssue[] {
  if (!Array.isArray(value)) {
    throw new AgentRuntimeError("issues must be an array", "INVALID_RUN_CONFIG");
  }
  return value.map((issue, index) => normalizeIssue(issue, index));
}

function normalizeIssue(issue: ContentReviewIssue, index: number): ContentReviewIssue {
  if (!isRecord(issue)) {
    throw new AgentRuntimeError(`issues[${index}] must be an object`, "INVALID_RUN_CONFIG");
  }
  const severity = issue.severity;
  const category = issue.category;
  if (typeof severity !== "string" || !ISSUE_SEVERITIES.has(severity as ContentReviewIssueSeverity)) {
    throw new AgentRuntimeError(`issues[${index}].severity is invalid`, "INVALID_RUN_CONFIG");
  }
  if (typeof category !== "string" || !ISSUE_CATEGORIES.has(category as ContentReviewIssueCategory)) {
    throw new AgentRuntimeError(`issues[${index}].category is invalid`, "INVALID_RUN_CONFIG");
  }
  return {
    ...(typeof issue.lessonId === "string" && issue.lessonId.trim() ? { lessonId: issue.lessonId.trim() } : {}),
    ...(typeof issue.pageId === "string" && issue.pageId.trim() ? { pageId: issue.pageId.trim() } : {}),
    severity: severity as ContentReviewIssueSeverity,
    category: category as ContentReviewIssueCategory,
    finding: normalizeRequiredText(issue.finding, `issues[${index}].finding`),
    recommendation: normalizeRequiredText(issue.recommendation, `issues[${index}].recommendation`)
  };
}

function normalizeRequiredText(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AgentRuntimeError(`${key} is required`, "INVALID_RUN_CONFIG");
  }
  return value.trim();
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function countTemplateLabels(page: Record<string, unknown>): number {
  const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  if (!knowledgeBoard) {
    return 0;
  }
  let count = 0;
  for (const columnName of ["leftColumn", "rightColumn"]) {
    const column = knowledgeBoard[columnName];
    if (!Array.isArray(column)) {
      continue;
    }
    for (const section of column) {
      if (isRecord(section) && typeof section.label === "string" && TEMPLATE_LABELS.has(section.label.trim())) {
        count += 1;
      }
    }
  }
  return count;
}

async function isMissingImagegenAsset(previewRoot: string, runId: string, page: Record<string, unknown>): Promise<boolean> {
  const visualSpec = isRecord(page.visualSpec) ? page.visualSpec : undefined;
  const imageUrl = typeof visualSpec?.imageUrl === "string" ? visualSpec.imageUrl : "";
  const provider = typeof visualSpec?.imageProvider === "string" ? visualSpec.imageProvider : "";
  if (!imageUrl || provider !== "imagegen" || imageUrl.endsWith(".svg")) {
    return true;
  }

  const previewPrefix = `/__learning-preview/${runId}/`;
  if (!imageUrl.startsWith(previewPrefix)) {
    return false;
  }
  const relativePath = imageUrl.slice(previewPrefix.length);
  return !(await fileExists(path.join(previewRoot, relativePath)));
}

function isGenericTitle(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim();
  return GENERIC_PAGE_TITLES.has(normalized) || /^第\s*[0-9一二三四五六七八九十]+\s*[页講讲]/u.test(normalized);
}

function contentDensityChars(page: Record<string, unknown>): number {
  const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  const values: string[] = [];
  if (knowledgeBoard) {
    collectText(knowledgeBoard.coreProposition, values);
    collectText(knowledgeBoard.bottomLine, values);
    collectColumnText(knowledgeBoard.leftColumn, values);
    collectColumnText(knowledgeBoard.rightColumn, values);
  }
  collectText(page.narrative, values);
  return values.join("").replace(/\s/gu, "").length;
}

function countGenericSourceTraceSupports(sourceTrace: unknown[]): number {
  return sourceTrace.filter((entry) => {
    if (!isRecord(entry) || typeof entry.supports !== "string") {
      return false;
    }
    const supports = entry.supports;
    return GENERIC_SOURCE_TRACE_SUPPORT_PATTERNS.some((pattern) => pattern.test(supports));
  }).length;
}

function hasStaleVisualPrompt(page: Record<string, unknown>): boolean {
  const visualSpec = isRecord(page.visualSpec) ? page.visualSpec : undefined;
  const prompt = typeof visualSpec?.imagePrompt === "string" ? visualSpec.imagePrompt.trim() : "";
  if (!prompt) {
    return true;
  }
  const title = typeof page.title === "string" ? page.title.trim() : "";
  return title.length > 0 && (prompt.includes(`只表达“${title}”`) || prompt.includes(`核心知识关系：${title}`));
}

function titleDuplicatedInImagePrompt(page: Record<string, unknown>): boolean {
  const visualSpec = isRecord(page.visualSpec) ? page.visualSpec : undefined;
  const prompt = typeof visualSpec?.imagePrompt === "string" ? visualSpec.imagePrompt.trim() : "";
  const title = typeof page.title === "string" ? page.title.trim() : "";
  return prompt.length > 0 && title.length > 0 && prompt.includes(title);
}

function mechanismDepthWeak(page: Record<string, unknown>): boolean {
  const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  if (!knowledgeBoard) {
    return true;
  }
  return countBoardItems(knowledgeBoard.leftColumn) + countBoardItems(knowledgeBoard.rightColumn) < MECHANISM_DEPTH_MIN_ITEM_COUNT;
}

function countBoilerplateLearnerPhrases(page: Record<string, unknown>): number {
  const values: string[] = [];
  collectText(page.narrative, values);
  const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  if (knowledgeBoard) {
    collectText(knowledgeBoard.coreProposition, values);
    collectText(knowledgeBoard.bottomLine, values);
    collectColumnText(knowledgeBoard.leftColumn, values);
    collectColumnText(knowledgeBoard.rightColumn, values);
  }
  const joined = values.join("\n");
  return BOILERPLATE_LEARNER_PHRASE_PATTERNS.some((pattern) => pattern.test(joined)) ? 1 : 0;
}

function titleCorePropositionOverlap(page: Record<string, unknown>): boolean {
  const title = typeof page.title === "string" ? page.title : "";
  const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  const coreProposition = knowledgeBoard && typeof knowledgeBoard.coreProposition === "string" ? knowledgeBoard.coreProposition : "";
  return normalizedTextOverlaps(title, coreProposition);
}

function bottomLineRepeatsTitle(page: Record<string, unknown>): boolean {
  const title = typeof page.title === "string" ? page.title : "";
  const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  const bottomLine = knowledgeBoard && typeof knowledgeBoard.bottomLine === "string" ? knowledgeBoard.bottomLine : "";
  return normalizedTextOverlaps(title, bottomLine);
}

function genericImageIntent(page: Record<string, unknown>): boolean {
  const visualSpec = isRecord(page.visualSpec) ? page.visualSpec : undefined;
  if (!visualSpec) {
    return true;
  }
  const imageAlt = typeof visualSpec.imageAlt === "string" ? visualSpec.imageAlt.trim() : "";
  const imagePrompt = typeof visualSpec.imagePrompt === "string" ? visualSpec.imagePrompt.trim() : "";
  return [imageAlt, imagePrompt].some((value) => GENERIC_IMAGE_INTENT_PATTERNS.some((pattern) => pattern.test(value)));
}

function weakKnowledgeClaim(page: Record<string, unknown>): boolean {
  const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  const coreProposition = knowledgeBoard && typeof knowledgeBoard.coreProposition === "string" ? knowledgeBoard.coreProposition : "";
  return (
    titleCorePropositionOverlap(page) ||
    bottomLineRepeatsTitle(page) ||
    BOILERPLATE_LEARNER_PHRASE_PATTERNS.some((pattern) => pattern.test(coreProposition)) ||
    normalizeForComparison(coreProposition).length < 18
  );
}

function normalizedTextOverlaps(left: string, right: string): boolean {
  const normalizedLeft = normalizeForComparison(left);
  const normalizedRight = normalizeForComparison(right);
  if (normalizedLeft.length < 4 || normalizedRight.length < 4) {
    return false;
  }
  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function normalizeForComparison(value: string): string {
  return value.normalize("NFKC").replace(/[\s，。；：、,.!?！？:;'"“”‘’()[\]（）【】《》<>]/gu, "").toLocaleLowerCase();
}

function boardSectionLabels(page: Record<string, unknown>): string[] {
  const knowledgeBoard = isRecord(page.knowledgeBoard) ? page.knowledgeBoard : undefined;
  if (!knowledgeBoard) {
    return [];
  }
  const labels: string[] = [];
  for (const columnName of ["leftColumn", "rightColumn"]) {
    const column = knowledgeBoard[columnName];
    if (!Array.isArray(column)) {
      continue;
    }
    for (const section of column) {
      if (isRecord(section) && typeof section.label === "string" && section.label.trim().length > 0) {
        labels.push(section.label.trim());
      }
    }
  }
  return labels;
}

function countRepeatedBoardSectionLabels(labels: string[]): number {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.values())
    .filter((count) => count >= REPEATED_BOARD_LABEL_THRESHOLD)
    .reduce((sum, count) => sum + count, 0);
}

function countBoardItems(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }
  return value.reduce((count, section) => {
    if (!isRecord(section) || !Array.isArray(section.items)) {
      return count;
    }
    return count + section.items.filter((item) => typeof item === "string" && item.trim().length > 0).length;
  }, 0);
}

function collectColumnText(value: unknown, target: string[]): void {
  if (!Array.isArray(value)) {
    return;
  }
  for (const section of value) {
    if (!isRecord(section)) {
      continue;
    }
    collectText(section.label, target);
    collectText(section.items, target);
  }
}

function collectText(value: unknown, target: string[]): void {
  if (typeof value === "string") {
    target.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, target);
    }
    return;
  }
  if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      collectText(nested, target);
    }
  }
}

function diffMetrics(
  current: ContentReviewMetrics,
  previous: ContentReviewMetrics,
  currentIssueCount: number,
  previousIssueCount: number
): ContentReviewMetricDelta {
  return {
    lessonCount: current.lessonCount - previous.lessonCount,
    pageCount: current.pageCount - previous.pageCount,
    templateLabelCount: current.templateLabelCount - previous.templateLabelCount,
    missingImagegenAssetCount: current.missingImagegenAssetCount - previous.missingImagegenAssetCount,
    genericTitleCount: current.genericTitleCount - previous.genericTitleCount,
    lowDensityPageCount: current.lowDensityPageCount - previous.lowDensityPageCount,
    sourceAnchoredPageCount: current.sourceAnchoredPageCount - previous.sourceAnchoredPageCount,
    sourceTracePageCount: current.sourceTracePageCount - previous.sourceTracePageCount,
    genericSourceTraceSupportCount: current.genericSourceTraceSupportCount - previous.genericSourceTraceSupportCount,
    staleVisualPromptCount: current.staleVisualPromptCount - previous.staleVisualPromptCount,
    titleDuplicatedInImagePromptCount: current.titleDuplicatedInImagePromptCount - previous.titleDuplicatedInImagePromptCount,
    mechanismDepthWeakPageCount: current.mechanismDepthWeakPageCount - previous.mechanismDepthWeakPageCount,
    boilerplateLearnerPhraseCount: current.boilerplateLearnerPhraseCount - previous.boilerplateLearnerPhraseCount,
    repeatedBoardSectionLabelCount: current.repeatedBoardSectionLabelCount - previous.repeatedBoardSectionLabelCount,
    titleCorePropositionOverlapCount: current.titleCorePropositionOverlapCount - previous.titleCorePropositionOverlapCount,
    bottomLineRepeatsTitleCount: current.bottomLineRepeatsTitleCount - previous.bottomLineRepeatsTitleCount,
    genericImageIntentCount: current.genericImageIntentCount - previous.genericImageIntentCount,
    weakKnowledgeClaimCount: current.weakKnowledgeClaimCount - previous.weakKnowledgeClaimCount,
    issueCount: currentIssueCount - previousIssueCount
  };
}

function buildAutomaticFindings(metrics: ContentReviewMetrics): Array<{
  metric: keyof ContentReviewMetrics;
  value: number;
  severity: ContentReviewIssueSeverity;
  finding: string;
  recommendation: string;
}> {
  const findings: Array<{
    metric: keyof ContentReviewMetrics;
    value: number;
    severity: ContentReviewIssueSeverity;
    finding: string;
    recommendation: string;
  }> = [];

  if (metrics.templateLabelCount > 0) {
    findings.push({
      metric: "templateLabelCount",
      value: metrics.templateLabelCount,
      severity: "major",
      finding: "存在模板化栏目标题，页面仍暴露 authoring 模板而不是内容专属板书。",
      recommendation: "把栏目标题改成与本页知识命题直接相关的小标题，避免机制链、正式术语、例子/证据等通用标签。"
    });
  }
  if (metrics.missingImagegenAssetCount > 0) {
    findings.push({
      metric: "missingImagegenAssetCount",
      value: metrics.missingImagegenAssetCount,
      severity: "major",
      finding: "存在缺失 imagegen PNG/WebP 教学插图或仍使用 SVG/非 imagegen provider 的页面。",
      recommendation: "为每页补齐 visualSpec.imageUrl、imageProvider:imagegen 和安全 imagePrompt，最终进入 imagegen 资产批处理。"
    });
  }
  if (metrics.genericTitleCount > 0) {
    findings.push({
      metric: "genericTitleCount",
      value: metrics.genericTitleCount,
      severity: "major",
      finding: "存在泛化页面标题，学习者无法从标题看出本页知识判断。",
      recommendation: "把页面标题改成内容命题或真实学习问题，不使用直观模型、机制链路、来源证据等页面角色。"
    });
  }
  if (metrics.lowDensityPageCount > 0) {
    findings.push({
      metric: "lowDensityPageCount",
      value: metrics.lowDensityPageCount,
      severity: "major",
      finding: "存在低知识密度页面，正文和板书不足以支撑学生自学。",
      recommendation: "补入具体机制、条件、例子、边界或对比，让每页至少交付一个可带走的判断。"
    });
  }
  if (metrics.genericSourceTraceSupportCount > 0) {
    findings.push({
      metric: "genericSourceTraceSupportCount",
      value: metrics.genericSourceTraceSupportCount,
      severity: "major",
      finding: "存在泛化 sourceTrace.supports，来源锚点没有说明具体支撑哪条命题、例子或边界。",
      recommendation: "把 sourceTrace.supports 改成页面命题级的具体来源说明。"
    });
  }
  if (metrics.staleVisualPromptCount > 0) {
    findings.push({
      metric: "staleVisualPromptCount",
      value: metrics.staleVisualPromptCount,
      severity: "major",
      finding: "存在缺失或标题式旧模板 image prompt，图像生成无法跟随当前知识机制。",
      recommendation: "重写 imagePrompt，描述中间视觉区应画出的机制、关系或边界。"
    });
  }
  if (metrics.titleDuplicatedInImagePromptCount > 0) {
    findings.push({
      metric: "titleDuplicatedInImagePromptCount",
      value: metrics.titleDuplicatedInImagePromptCount,
      severity: "minor",
      finding: "存在直接包含页面标题的 image prompt，容易生成重复标题而不是教学图像。",
      recommendation: "去掉页面标题复述，改用少量短标签和机制画面描述。"
    });
  }
  if (metrics.mechanismDepthWeakPageCount > 0) {
    findings.push({
      metric: "mechanismDepthWeakPageCount",
      value: metrics.mechanismDepthWeakPageCount,
      severity: "major",
      finding: "存在机制板书内容项过少的页面，可能缺少条件、机制、例子或边界。",
      recommendation: "补齐左右栏具体内容项，让学生能看到判断链路和失效边界。"
    });
  }
  if (metrics.boilerplateLearnerPhraseCount > 0) {
    findings.push({
      metric: "boilerplateLearnerPhraseCount",
      value: metrics.boilerplateLearnerPhraseCount,
      severity: "major",
      finding: "存在课程模板腔或自我说明式句子，页面在描述学习活动而不是直接交付知识判断。",
      recommendation: "删除“本页帮助你…”“建立心智模型”等空泛句，改成条件、机制、例子或边界的具体判断。"
    });
  }
  if (metrics.repeatedBoardSectionLabelCount > 0) {
    findings.push({
      metric: "repeatedBoardSectionLabelCount",
      value: metrics.repeatedBoardSectionLabelCount,
      severity: "major",
      finding: "同一课程内多个页面重复使用相同板书栏目名，模板味过重，削弱自学材料的知识辨识度。",
      recommendation: "把重复栏目改成与每页命题直接相关的内容专属小标题。"
    });
  }
  if (metrics.titleCorePropositionOverlapCount > 0) {
    findings.push({
      metric: "titleCorePropositionOverlapCount",
      value: metrics.titleCorePropositionOverlapCount,
      severity: "major",
      finding: "存在标题和核心命题重复的页面，标题区和正文没有形成新的知识推进。",
      recommendation: "标题保留学习问题或命题，核心命题必须补出因果、条件、机制或边界，避免复读标题。"
    });
  }
  if (metrics.bottomLineRepeatsTitleCount > 0) {
    findings.push({
      metric: "bottomLineRepeatsTitleCount",
      value: metrics.bottomLineRepeatsTitleCount,
      severity: "major",
      finding: "存在底部总结复读标题的页面，学习者读到最后没有获得压缩后的判断。",
      recommendation: "把 bottomLine 改成可记忆的判断句：什么条件下成立、为什么成立、何时失效。"
    });
  }
  if (metrics.genericImageIntentCount > 0) {
    findings.push({
      metric: "genericImageIntentCount",
      value: metrics.genericImageIntentCount,
      severity: "major",
      finding: "存在泛化图片意图，imageAlt 或 imagePrompt 只说教学插图，没有说明要画出的知识关系。",
      recommendation: "为每页写出具体画面：对象、关系、方向、变化或边界，让 imagegen 生成真正服务自学的图。"
    });
  }
  if (metrics.weakKnowledgeClaimCount > 0) {
    findings.push({
      metric: "weakKnowledgeClaimCount",
      value: metrics.weakKnowledgeClaimCount,
      severity: "major",
      finding: "存在弱知识命题：页面在讲学习意图或复述标题，而不是直接交付可迁移的知识判断。",
      recommendation: "提升知识密度：每页至少写清一个关键链路、一个成立条件和一个容易误用的边界。"
    });
  }

  return findings;
}

async function readJsonIfExists(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

function isContentReviewMetrics(value: unknown): value is ContentReviewMetrics {
  return (
    isRecord(value) &&
    typeof value.lessonCount === "number" &&
    typeof value.pageCount === "number" &&
    typeof value.templateLabelCount === "number" &&
    typeof value.missingImagegenAssetCount === "number" &&
    typeof value.genericTitleCount === "number" &&
    typeof value.lowDensityPageCount === "number" &&
    typeof value.sourceAnchoredPageCount === "number" &&
    typeof value.sourceTracePageCount === "number" &&
    typeof value.genericSourceTraceSupportCount === "number" &&
    typeof value.staleVisualPromptCount === "number" &&
    typeof value.titleDuplicatedInImagePromptCount === "number" &&
    typeof value.mechanismDepthWeakPageCount === "number" &&
    typeof value.boilerplateLearnerPhraseCount === "number" &&
    typeof value.repeatedBoardSectionLabelCount === "number" &&
    typeof value.titleCorePropositionOverlapCount === "number" &&
    typeof value.bottomLineRepeatsTitleCount === "number" &&
    typeof value.genericImageIntentCount === "number" &&
    typeof value.weakKnowledgeClaimCount === "number"
  );
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (isFileNotFound(error)) {
      return false;
    }
    throw error;
  }
}

function recommendedNextAction(round: number, reviewerVerdict: ContentReviewVerdict): string {
  if (reviewerVerdict === "block") {
    return "revise the blocked pages before publishing or imagegen";
  }
  if (round >= 3) {
    return reviewerVerdict === "pass" ? "proceed to imagegen batch validation" : "use Codex judgment before imagegen; unresolved issues remain";
  }
  return reviewerVerdict === "pass" ? "prepare the next review round if maxRounds has not been reached" : "revise and republish, then prepare the next review round";
}
