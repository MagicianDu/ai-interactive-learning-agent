import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";

export type AuthoringQualityComparisonInput = {
  authoredRunId: string;
  draftRunId: string;
};

export type AuthoringQualityComparisonResult = {
  status: "authoring_quality_compared";
  authoredRunId: string;
  draftRunId: string;
  comparedAt: string;
  reportPath: string;
  summary: string[];
  draft: RunQualitySnapshot;
  authored: RunQualitySnapshot;
  improvements: ComparisonFinding[];
  remainingGaps: ComparisonFinding[];
  recommendedNextActions: string[];
};

export type RunQualitySnapshot = {
  runId: string;
  lessonCount: number;
  quality?: {
    status?: string;
    score?: number;
  };
  metrics: ContentQualityMetrics;
};

export type ContentQualityMetrics = {
  pageCount: number;
  visualPageCount: number;
  interactivePageCount: number;
  assessmentPageCount: number;
  transferTaskCount: number;
  sourceAnchoredPageCount: number;
  sourceAnchoredPageRatio: number;
  academicMarkerCount: number;
  genericPageCount: number;
  weakSourceSynthesisPageCount: number;
  cognitiveInteractionPageCount: number;
};

export type ComparisonFinding = {
  id: string;
  title: string;
  evidence: string;
};

const safeRunIdPattern = /^[a-z][a-z0-9-]{0,63}$/u;

const academicMarkers = [
  "先修概念",
  "正式术语",
  "课堂讨论",
  "课后作业",
  "研究问题",
  "证据链",
  "局限边界",
  "方法假设",
  "批判性讨论"
];

export class AuthoringQualityComparisonService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async compare(input: AuthoringQualityComparisonInput): Promise<AuthoringQualityComparisonResult> {
    assertRunId(input.authoredRunId, "authoredRunId");
    assertRunId(input.draftRunId, "draftRunId");
    if (input.authoredRunId === input.draftRunId) {
      throw new AgentRuntimeError("authoredRunId and draftRunId must be different", "INVALID_RUN_CONFIG");
    }

    const draft = await this.readSnapshot(input.draftRunId);
    const authored = await this.readSnapshot(input.authoredRunId);
    const improvements = buildImprovements(authored, draft);
    const remainingGaps = buildRemainingGaps(authored, draft);
    const result: AuthoringQualityComparisonResult = {
      status: "authoring_quality_compared",
      authoredRunId: input.authoredRunId,
      draftRunId: input.draftRunId,
      comparedAt: new Date().toISOString(),
      reportPath: "",
      summary: buildSummary(authored, draft, improvements, remainingGaps),
      draft,
      authored,
      improvements,
      remainingGaps,
      recommendedNextActions: recommendedNextActions(remainingGaps)
    };

    const reportPath = path.join(this.workspaceRoot, "runs", input.authoredRunId, "quality", "authoring-quality-comparison.json");
    await mkdir(path.dirname(reportPath), { recursive: true });
    result.reportPath = reportPath;
    await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    return result;
  }

  private async readSnapshot(runId: string): Promise<RunQualitySnapshot> {
    const lessons = await readPreviewLessons(this.workspaceRoot, runId);
    return {
      runId,
      lessonCount: lessons.length,
      quality: await readQualityReport(this.workspaceRoot, runId),
      metrics: collectMetrics(lessons)
    };
  }
}

async function readPreviewLessons(workspaceRoot: string, runId: string): Promise<Record<string, unknown>[]> {
  const lessonsDir = path.join(workspaceRoot, "runs", runId, "preview", "lessons");
  let entries: string[];
  try {
    entries = await readdir(lessonsDir);
  } catch (error) {
    if (isFileNotFound(error)) {
      throw new AgentRuntimeError(`preview lessons not found for run ${runId}`, "MISSING_ARTIFACT");
    }
    throw error;
  }

  const lessons = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .sort()
      .map(async (entry) => parseJsonFile(path.join(lessonsDir, entry)))
  );
  const validLessons = lessons.filter(isRecord);
  if (validLessons.length === 0) {
    throw new AgentRuntimeError(`preview lessons not found for run ${runId}`, "MISSING_ARTIFACT");
  }
  return validLessons;
}

async function readQualityReport(workspaceRoot: string, runId: string): Promise<RunQualitySnapshot["quality"]> {
  try {
    const parsed = await parseJsonFile(path.join(workspaceRoot, "runs", runId, "quality", "course-quality-report.json"));
    if (!isRecord(parsed)) {
      return undefined;
    }
    return {
      ...(typeof parsed.status === "string" ? { status: parsed.status } : {}),
      ...(typeof parsed.score === "number" ? { score: parsed.score } : {})
    };
  } catch (error) {
    if (isFileNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

async function parseJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function collectMetrics(lessons: Record<string, unknown>[]): ContentQualityMetrics {
  const pages = lessons.flatMap((lesson) => arrayOfRecords(lesson.pages));
  const text = JSON.stringify(lessons);
  const sourceAnchoredPageCount = pages.filter((page) => stringArray(page.sourceAnchorIds).length > 0).length;
  return {
    pageCount: pages.length,
    visualPageCount: pages.filter((page) => isRecord(page.visualSpec)).length,
    interactivePageCount: pages.filter((page) => isRecord(page.interactionSpec)).length,
    assessmentPageCount: pages.filter((page) => isRecord(page.assessmentSpec) || isAssessmentPageType(page.type)).length,
    transferTaskCount: lessons.reduce((count, lesson) => count + arrayOfRecords(lesson.transferTasks).length, 0) + pages.filter((page) => page.type === "transfer_challenge").length,
    sourceAnchoredPageCount,
    sourceAnchoredPageRatio: pages.length === 0 ? 0 : roundRatio(sourceAnchoredPageCount / pages.length),
    academicMarkerCount: academicMarkers.reduce((count, marker) => count + occurrences(text, marker), 0),
    genericPageCount: pages.filter((page) => isGenericPage(JSON.stringify(page))).length,
    weakSourceSynthesisPageCount: pages.filter((page) => stringArray(page.sourceAnchorIds).length > 0 && !hasSourceSynthesisSignal(JSON.stringify(page))).length,
    cognitiveInteractionPageCount: pages.filter(hasCognitiveInteraction).length
  };
}

const assessmentPageTypes = new Set(["quiz", "misconception_check", "transfer_challenge"]);

function isAssessmentPageType(value: unknown): boolean {
  return typeof value === "string" && assessmentPageTypes.has(value);
}

function buildImprovements(authored: RunQualitySnapshot, draft: RunQualitySnapshot): ComparisonFinding[] {
  const improvements: ComparisonFinding[] = [];
  if ((authored.quality?.score ?? 0) > (draft.quality?.score ?? 0)) {
    improvements.push({
      id: "quality-score",
      title: "整体质量分提升",
      evidence: `authored=${authored.quality?.score ?? "unknown"}，draft=${draft.quality?.score ?? "unknown"}。`
    });
  }
  if (authored.metrics.academicMarkerCount > draft.metrics.academicMarkerCount) {
    improvements.push({
      id: "academic-depth",
      title: "大学课程深度更明显",
      evidence: `学术深度标记 authored=${authored.metrics.academicMarkerCount}，draft=${draft.metrics.academicMarkerCount}。`
    });
  }
  if (authored.metrics.sourceAnchoredPageRatio > draft.metrics.sourceAnchoredPageRatio) {
    improvements.push({
      id: "source-grounding",
      title: "页级来源锚点覆盖更强",
      evidence: `页级来源覆盖 authored=${authored.metrics.sourceAnchoredPageRatio}，draft=${draft.metrics.sourceAnchoredPageRatio}。`
    });
  }
  if (authored.metrics.interactivePageCount + authored.metrics.assessmentPageCount > draft.metrics.interactivePageCount + draft.metrics.assessmentPageCount) {
    improvements.push({
      id: "learner-action",
      title: "学习动作和检查更多",
      evidence: `动作/检查页 authored=${authored.metrics.interactivePageCount + authored.metrics.assessmentPageCount}，draft=${draft.metrics.interactivePageCount + draft.metrics.assessmentPageCount}。`
    });
  }
  if (authored.metrics.transferTaskCount > draft.metrics.transferTaskCount) {
    improvements.push({
      id: "transfer-design",
      title: "迁移任务更完整",
      evidence: `迁移任务 authored=${authored.metrics.transferTaskCount}，draft=${draft.metrics.transferTaskCount}。`
    });
  }
  if (authored.metrics.genericPageCount < draft.metrics.genericPageCount) {
    improvements.push({
      id: "less-generic",
      title: "泛化页面更少",
      evidence: `泛化页 authored=${authored.metrics.genericPageCount}，draft=${draft.metrics.genericPageCount}。`
    });
  }
  if (authored.metrics.weakSourceSynthesisPageCount < draft.metrics.weakSourceSynthesisPageCount) {
    improvements.push({
      id: "source-synthesis",
      title: "来源综合更具体",
      evidence: `弱来源综合页 authored=${authored.metrics.weakSourceSynthesisPageCount}，draft=${draft.metrics.weakSourceSynthesisPageCount}。`
    });
  }
  if (authored.metrics.cognitiveInteractionPageCount > draft.metrics.cognitiveInteractionPageCount) {
    improvements.push({
      id: "cognitive-interaction",
      title: "互动认知目的更清楚",
      evidence: `认知互动页 authored=${authored.metrics.cognitiveInteractionPageCount}，draft=${draft.metrics.cognitiveInteractionPageCount}。`
    });
  }
  return improvements;
}

function buildRemainingGaps(authored: RunQualitySnapshot, draft: RunQualitySnapshot): ComparisonFinding[] {
  const gaps: ComparisonFinding[] = [];
  if (authored.lessonCount < draft.lessonCount || authored.metrics.pageCount < draft.metrics.pageCount * 0.8) {
    gaps.push({
      id: "scope-coverage",
      title: "Codex-authored 覆盖范围不足",
      evidence: `authored=${authored.lessonCount} 个 lesson / ${authored.metrics.pageCount} 页，draft=${draft.lessonCount} 个 lesson / ${draft.metrics.pageCount} 页。不能把较窄 authored 样例当作完整课程验收。`
    });
  }
  if (authored.quality?.status && authored.quality.status !== "passed") {
    gaps.push({
      id: "quality-report",
      title: "质量报告未通过",
      evidence: `当前 authored quality status=${authored.quality.status}。`
    });
  }
  if (authored.metrics.academicMarkerCount < 4) {
    gaps.push({
      id: "academic-depth",
      title: "学术课程深度仍不足",
      evidence: "课程中缺少先修概念、正式术语、课堂讨论、课后作业、证据链或局限边界等高阶学习标记。"
    });
  }
  if (authored.metrics.sourceAnchoredPageRatio < 0.8) {
    gaps.push({
      id: "source-grounding",
      title: "页级来源覆盖不足",
      evidence: `当前页级来源覆盖率=${authored.metrics.sourceAnchoredPageRatio}。`
    });
  }
  if (authored.metrics.interactivePageCount < 1 || authored.metrics.assessmentPageCount < 1) {
    gaps.push({
      id: "learner-action",
      title: "学习动作或检查不足",
      evidence: `互动页=${authored.metrics.interactivePageCount}，检查页=${authored.metrics.assessmentPageCount}。`
    });
  }
  if (authored.metrics.transferTaskCount < 1) {
    gaps.push({
      id: "transfer-design",
      title: "缺少迁移任务",
      evidence: "课程还没有明确 transfer task 或 transfer_challenge 页面。"
    });
  }
  if (authored.metrics.genericPageCount > 0) {
    gaps.push({
      id: "generic-content",
      title: "Codex-authored 内容仍有泛化页面",
      evidence: `泛化页数量=${authored.metrics.genericPageCount}。这些页面像学习网页说明，而不是来源重构后的课程页面。`
    });
  }
  if (authored.metrics.weakSourceSynthesisPageCount > 0) {
    gaps.push({
      id: "source-synthesis",
      title: "来源综合仍不足",
      evidence: `弱来源综合页=${authored.metrics.weakSourceSynthesisPageCount}。这些页面有 sourceAnchorIds，但没有把来源术语、证据、限制或机制转化为教学内容。`
    });
  }
  return gaps;
}

function buildSummary(
  authored: RunQualitySnapshot,
  draft: RunQualitySnapshot,
  improvements: ComparisonFinding[],
  remainingGaps: ComparisonFinding[]
): string[] {
  return [
    `Codex authored 与 deterministic draft 已对照：authored ${authored.lessonCount} 个 lesson / ${authored.metrics.pageCount} 页，draft ${draft.lessonCount} 个 lesson / ${draft.metrics.pageCount} 页。`,
    improvements.length > 0 ? `发现 ${improvements.length} 项 authored 改进。` : "未发现 authored 相对 draft 的可计算改进。",
    remainingGaps.length > 0 ? `仍有 ${remainingGaps.length} 项内容质量 gap 需要修订。` : "未发现阻塞级内容质量 gap。"
  ];
}

function recommendedNextActions(remainingGaps: ComparisonFinding[]): string[] {
  if (remainingGaps.length === 0) {
    return ["可进入真实学习者试用，并收集难度、节奏和练习反馈。"];
  }
  return [
    "请由 Codex 按 remainingGaps 修订 coursePack 与 lessons，再调用 learning_agent.publish_learning_course。",
    "修订后再次调用 learning_agent.compare_authoring_quality，确认 authored 版本相对 deterministic draft 的改进仍然成立。"
  ];
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

const genericPageMarkers = ["核心概念", "整体内容", "资料大意", "基本概念", "学习重点", "帮助学习者理解", "快速摘要", "本页介绍"];
const sourceSynthesisMarkers = [
  "证据链",
  "局限边界",
  "方法假设",
  "来源机制",
  "来源术语",
  "权利要求",
  "实施例",
  "tool feedback",
  "reflection",
  "evaluation",
  "limitation",
  "boundary"
];
const cognitivePurposeMarkers = [
  "因果",
  "结构",
  "预测",
  "误区",
  "决策",
  "比较",
  "迁移",
  "边界",
  "机制",
  "证据",
  "参数",
  "诊断",
  "路径",
  "选择",
  "权衡",
  "搜索",
  "缩小",
  "候选范围",
  "讨论",
  "作业",
  "审查",
  "批判",
  "阅读",
  "标准判断",
  "术语"
];
const vagueCognitivePurposeMarkers = ["帮助理解", "增加互动", "提升参与", "理解内容", "学习内容", "熟悉内容"];

function isGenericPage(pageText: string): boolean {
  return genericPageMarkers.filter((marker) => pageText.includes(marker)).length >= 2;
}

function hasSourceSynthesisSignal(pageText: string): boolean {
  const normalized = pageText.toLocaleLowerCase();
  return sourceSynthesisMarkers.some((marker) => normalized.includes(marker.toLocaleLowerCase()));
}

function hasCognitiveInteraction(page: Record<string, unknown>): boolean {
  const interactionSpec = isRecord(page.interactionSpec) ? page.interactionSpec : undefined;
  const cognitivePurpose = typeof interactionSpec?.cognitivePurpose === "string" ? interactionSpec.cognitivePurpose : "";
  if (cognitivePurpose.length === 0 || vagueCognitivePurposeMarkers.some((marker) => cognitivePurpose.includes(marker))) {
    return false;
  }
  return cognitivePurposeMarkers.some((marker) => cognitivePurpose.includes(marker));
}

function occurrences(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertRunId(runId: string, fieldName: string): void {
  if (!safeRunIdPattern.test(runId)) {
    throw new AgentRuntimeError(`${fieldName} must match /^[a-z][a-z0-9-]{0,63}$/`, "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
