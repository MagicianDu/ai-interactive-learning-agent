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
      mechanismDepthWeakPageCount: 0
    };

    for (const lesson of lessons) {
      if (!isRecord(lesson) || !Array.isArray(lesson.pages)) {
        continue;
      }
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
      }
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
    issueCount: currentIssueCount - previousIssueCount
  };
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
    typeof value.mechanismDepthWeakPageCount === "number"
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
