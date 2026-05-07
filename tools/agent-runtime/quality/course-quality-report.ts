import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RunConfig } from "../types.js";
import { validateChineseFirstLesson } from "./chinese-first-validator.js";
import { validateLessonQuality } from "./lesson-quality-validator.js";
import type { LessonCriticReport } from "./lesson-critic.js";
import { validateSourceGrounding } from "./source-grounding-validator.js";
import { analyzeSourceEvidence, type SourceEvidenceSummary, type SourceEvidenceStatus } from "./source-evidence-analyzer.js";
import { isRecord, type QualityIssue } from "./validation-result.js";

export type CourseQualityStatus = "passed" | "warning" | "failed";
export type CourseQualityIssueScope = "course" | "unit" | "lesson" | "page";
export type CourseQualityIssueCategory =
  | "source_evidence"
  | "source_anchor"
  | "generic_page"
  | "decorative_interaction"
  | "missing_feedback"
  | "dense_page"
  | "learner_level_mismatch"
  | "page_structure"
  | "assessment"
  | "interaction"
  | "transfer";

export type CourseQualityAuthoringContext = {
  difficultyLevel?: string;
  sourceSemantics?: {
    keyTerms?: Array<string | { term?: unknown; label?: unknown }>;
    evidenceHints?: unknown[];
    limitationHints?: unknown[];
  };
};

export type CourseQualityIssue = {
  issueId: string;
  scope: CourseQualityIssueScope;
  severity: QualityIssue["severity"];
  category: CourseQualityIssueCategory;
  reason: string;
  requiredFix: string;
  rule: string;
  path: string;
  unitId?: string;
  lessonId?: string;
  pageId?: string;
};

export type CourseQualityIssueSummary = {
  course: number;
  unit: number;
  lesson: number;
  page: number;
  errors: number;
  warnings: number;
  byCategory: Partial<Record<CourseQualityIssueCategory, number>>;
};

export type CourseQualityReport = {
  status: CourseQualityStatus;
  score: number;
  runId: string;
  coursePackId: string;
  summary: string;
  lessonScores: Array<{
    lessonId: string;
    score: number;
    status: CourseQualityStatus;
    requiredFixes: string[];
    optionalImprovements: string[];
  }>;
  checks: {
    sourceEvidence: CourseQualityStatus;
    chineseFirst: CourseQualityStatus;
    pageStructure: CourseQualityStatus;
    interactionQuality: CourseQualityStatus;
    assessmentCoverage: CourseQualityStatus;
    transferCoverage: CourseQualityStatus;
  };
  issues: CourseQualityIssue[];
  issueSummary: CourseQualityIssueSummary;
  requiredFixes: string[];
  optionalImprovements: string[];
  sourceEvidence?: SourceEvidenceSummary;
};

export type CompactCourseQualityReport = {
  status: CourseQualityStatus;
  score: number;
  summary: string;
  reportPath: string;
  requiredFixCount: number;
  optionalImprovementCount: number;
  issueSummary: CourseQualityIssueSummary;
  topIssues: Array<Pick<CourseQualityIssue, "issueId" | "scope" | "severity" | "category" | "reason" | "requiredFix" | "lessonId" | "pageId">>;
  checks: CourseQualityReport["checks"];
  lessonScores: Array<{
    lessonId: string;
    score: number;
    status: CourseQualityStatus;
  }>;
};

export type BuildCourseQualityReportInput = {
  runId: string;
  coursePackId: string;
  lessons: unknown[];
  sourceGroundingConfig?: RunConfig;
  sourceEvidence?: SourceEvidenceSummary;
  criticReports?: LessonCriticReport[];
  authoringContext?: CourseQualityAuthoringContext;
};

export function buildCourseQualityReport(input: BuildCourseQualityReportInput): CourseQualityReport {
  const lessonIssueGroups = input.lessons.map((lesson) => collectLessonIssues(lesson, input.sourceGroundingConfig));
  const sourceEvidence =
    input.sourceEvidence ?? (input.sourceGroundingConfig ? analyzeSourceEvidence(input.lessons, input.sourceGroundingConfig) : undefined);
  const sourceEvidenceIssue = sourceEvidenceToIssue(sourceEvidence);
  const heuristicIssues = input.lessons.flatMap((lesson) => collectPageHeuristicIssues(lesson, input.authoringContext));
  const issues = sortCourseQualityIssues([
    ...lessonIssueGroups.flatMap((group) => group.issues.map((issue) => toCourseQualityIssue(issue, group.lessonId))),
    ...(sourceEvidenceIssue ? [toCourseQualityIssue(sourceEvidenceIssue)] : []),
    ...heuristicIssues
  ]);
  const issueSummary = summarizeCourseQualityIssues(issues);
  const requiredFixes = issues.filter((issue) => issue.severity === "error").map(formatCourseQualityIssue);
  const optionalImprovements = issues.filter((issue) => issue.severity === "warning").map(formatCourseQualityIssue);
  const checks = {
    sourceEvidence: statusFromSourceEvidence(sourceEvidence),
    chineseFirst: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter((issue) => issue.rule === "chinese-first"))),
    pageStructure: statusFromCourseQualityIssues([
      ...lessonIssueGroups.flatMap((group) => group.issues.filter(isPageStructureIssue).map((issue) => toCourseQualityIssue(issue, group.lessonId))),
      ...heuristicIssues.filter((issue) => issue.category === "dense_page" || issue.category === "generic_page")
    ]),
    interactionQuality: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter(isInteractionIssue))),
    assessmentCoverage: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter(isAssessmentIssue))),
    transferCoverage: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter((issue) => issue.rule === "transfer-challenge")))
  };
  const lessonScores = lessonIssueGroups.map((group, index) => {
    const critic = input.criticReports?.[index];
    const lessonIssues = issues.filter((issue) => issue.lessonId === group.lessonId);
    const required = lessonIssues.filter((issue) => issue.severity === "error").map(formatCourseQualityIssue);
    const optional = lessonIssues.filter((issue) => issue.severity === "warning").map(formatCourseQualityIssue);
    return {
      lessonId: group.lessonId,
      score: critic?.score ?? scoreFromIssues(required.length, optional.length),
      status: statusFromIssues(group.issues),
      requiredFixes: required,
      optionalImprovements: optional
    };
  });
  const status = resolveCourseStatus(checks, requiredFixes, optionalImprovements);
  const score = Math.min(
    scoreFromIssues(requiredFixes.length, optionalImprovements.length),
    lessonScores.length > 0 ? Math.round(lessonScores.reduce((sum, lesson) => sum + lesson.score, 0) / lessonScores.length) : 100
  );

  return {
    status,
    score,
    runId: input.runId,
    coursePackId: input.coursePackId,
    summary: summarizeCourseQuality(status, score, requiredFixes.length, optionalImprovements.length),
    lessonScores,
    checks,
    issues,
    issueSummary,
    requiredFixes,
    optionalImprovements,
    ...(sourceEvidence ? { sourceEvidence } : {})
  };
}

export async function writeCourseQualityReport(
  workspaceRoot: string,
  runId: string,
  report: CourseQualityReport
): Promise<string> {
  const qualityDir = path.join(workspaceRoot, "runs", runId, "quality");
  await mkdir(qualityDir, { recursive: true });
  const reportPath = path.join(qualityDir, "course-quality-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export function toCompactCourseQualityReport(report: CourseQualityReport, reportPath: string): CompactCourseQualityReport {
  return {
    status: report.status,
    score: report.score,
    summary: report.summary,
    reportPath,
    requiredFixCount: report.requiredFixes.length,
    optionalImprovementCount: report.optionalImprovements.length,
    issueSummary: report.issueSummary,
    topIssues: report.issues.slice(0, 5).map((issue) => ({
      issueId: issue.issueId,
      scope: issue.scope,
      severity: issue.severity,
      category: issue.category,
      reason: issue.reason,
      requiredFix: issue.requiredFix,
      ...(issue.lessonId ? { lessonId: issue.lessonId } : {}),
      ...(issue.pageId ? { pageId: issue.pageId } : {})
    })),
    checks: report.checks,
    lessonScores: report.lessonScores.map((lesson) => ({
      lessonId: lesson.lessonId,
      score: lesson.score,
      status: lesson.status
    }))
  };
}

function collectLessonIssues(lesson: unknown, sourceGroundingConfig: RunConfig | undefined): { lessonId: string; issues: QualityIssue[] } {
  return {
    lessonId: lessonIdOf(lesson),
    issues: [
      ...validateLessonQuality(lesson).issues,
      ...validateChineseFirstLesson(lesson).issues,
      ...(sourceGroundingConfig ? validateSourceGrounding(lesson, sourceGroundingConfig).issues : [])
    ]
  };
}

function lessonIdOf(lesson: unknown): string {
  return isRecord(lesson) && typeof lesson.id === "string" && lesson.id.trim().length > 0 ? lesson.id : "unknown-lesson";
}

function statusFromIssues(issues: QualityIssue[]): CourseQualityStatus {
  if (issues.some((issue) => issue.severity === "error")) {
    return "failed";
  }
  if (issues.some((issue) => issue.severity === "warning")) {
    return "warning";
  }
  return "passed";
}

function statusFromCourseQualityIssues(issues: CourseQualityIssue[]): CourseQualityStatus {
  if (issues.some((issue) => issue.severity === "error")) {
    return "failed";
  }
  if (issues.some((issue) => issue.severity === "warning")) {
    return "warning";
  }
  return "passed";
}

function statusFromSourceEvidence(sourceEvidence: SourceEvidenceSummary | undefined): CourseQualityStatus {
  if (!sourceEvidence) {
    return "passed";
  }
  return sourceEvidenceStatusMap[sourceEvidence.status];
}

const sourceEvidenceStatusMap: Record<SourceEvidenceStatus, CourseQualityStatus> = {
  failed: "failed",
  passed: "passed",
  warning: "warning"
};

function sourceEvidenceToIssue(sourceEvidence: SourceEvidenceSummary | undefined): QualityIssue | undefined {
  if (!sourceEvidence || sourceEvidence.status === "passed") {
    return undefined;
  }
  return {
    rule: "source-evidence",
    path: "sourceEvidence",
    message:
      sourceEvidence.status === "failed"
        ? `${sourceEvidence.unsupportedPages} page(s) lack source support`
        : `source support ratio is ${sourceEvidence.supportRatio.toFixed(2)}`,
    severity: sourceEvidence.status === "failed" ? "error" : "warning"
  };
}

function isPageStructureIssue(issue: QualityIssue): boolean {
  return ["page-count", "required-page-type", "visual-count", "objective-coverage", "summary"].includes(issue.rule);
}

function isInteractionIssue(issue: QualityIssue): boolean {
  return issue.rule === "interaction-count" || issue.rule === "interaction-feedback";
}

function isAssessmentIssue(issue: QualityIssue): boolean {
  return issue.rule === "assessment-count" || issue.rule === "assessment-feedback" || issue.path.includes("misconception");
}

function collectPageHeuristicIssues(lesson: unknown, authoringContext: CourseQualityAuthoringContext | undefined): CourseQualityIssue[] {
  if (!isRecord(lesson)) {
    return [];
  }

  const lessonId = lessonIdOf(lesson);
  const pages = Array.isArray(lesson.pages) ? lesson.pages.filter(isRecord) : [];
  const sourceTerms = sourceTermsFromAuthoringContext(authoringContext);
  const issues: CourseQualityIssue[] = [];
  const repetitiveIssue = repetitiveLongNarrativeIssue(lessonId, pages);
  if (repetitiveIssue) {
    issues.push(repetitiveIssue);
  }
  if (requiresAcademicDepth(authoringContext, lesson) && academicMarkerCount(JSON.stringify(lesson)) < 3) {
    issues.push({
      issueId: "quality.lesson.academic-depth-shallow",
      scope: "lesson",
      severity: "warning",
      category: "learner_level_mismatch",
      reason: "graduate or research-level course lacks prerequisites, formal terms, evidence, limitations, critique, or homework-style transfer density",
      requiredFix:
        "Add prerequisites, formal terminology, source reading mapping, assumptions, limitations, critique prompts, and homework-style transfer tasks.",
      rule: "academic-depth",
      path: "lesson.academicDepth",
      lessonId
    });
  }

  return [
    ...issues,
    ...pages.flatMap((page) => {
    const pageId = typeof page.id === "string" && page.id.trim().length > 0 ? page.id : "unknown";
    const issues: CourseQualityIssue[] = [];
    const pageText = textOf(page);
    const hasSourceTerm = sourceTerms.some((term) => includesIgnoreCase(pageText, term));
    const pageSourceAnchorCount = stringArray(page.sourceAnchorIds).length;
    const title = typeof page.title === "string" ? page.title.trim() : "";
    const learningGoal = typeof page.learningGoal === "string" ? page.learningGoal.trim() : "";
    if (title.length > 42) {
      issues.push({
        issueId: "quality.page.title-too-long",
        scope: "page",
        severity: "warning",
        category: "dense_page",
        reason: "page title is too long for a no-scroll learning screen and likely overloads the sidebar/header",
        requiredFix: "Shorten the title to one precise page idea and move secondary concepts into narrative, visual labels, or separate pages.",
        rule: "page-title-length",
        path: `pages.${pageId}.title`,
        lessonId,
        pageId
      });
    }
    if (learningGoal.length > 72) {
      issues.push({
        issueId: "quality.page.learning-goal-too-long",
        scope: "page",
        severity: "warning",
        category: "dense_page",
        reason: "page learningGoal is overloaded with too many moves for a single screen",
        requiredFix: "Rewrite the learningGoal as one mental-model move; split extra moves into later pages.",
        rule: "page-learning-goal-length",
        path: `pages.${pageId}.learningGoal`,
        lessonId,
        pageId
      });
    }
    if (typeof page.narrative === "string" && page.narrative.trim().length > 900) {
      issues.push({
        issueId: "quality.page.dense",
        scope: "page",
        severity: "warning",
        category: "dense_page",
        reason: "page narrative is too dense for a no-scroll learning screen",
        requiredFix: "Split secondary details into visual labels, interaction feedback, or a separate page so one screen carries one learning goal.",
        rule: "dense-page",
        path: `pages.${pageId}.narrative`,
        lessonId,
        pageId
      });
    }
    if (sourceTerms.length > 0 && isGenericPage(pageText) && !hasSourceTerm) {
      issues.push({
        issueId: "quality.page.generic-source-page",
        scope: "page",
        severity: "warning",
        category: "generic_page",
        reason: "page uses generic learning language without source-specific terms or mechanism",
        requiredFix: "Rewrite the page around concrete source terms, mechanism, evidence, limitation, and a learner action.",
        rule: "generic-page",
        path: `pages.${pageId}.narrative`,
        lessonId,
        pageId
      });
    }
    if (pageSourceAnchorCount > 0 && sourceTerms.length > 0 && !hasSourceTerm) {
      issues.push({
        issueId: "quality.page.source-synthesis-weak",
        scope: "page",
        severity: "warning",
        category: "source_evidence",
        reason: "page has source anchors but does not synthesize source-specific terms, evidence, or limitations",
        requiredFix: "Use the source anchor to teach a specific source term, evidence chain, example, assumption, or limitation.",
        rule: "source-synthesis",
        path: `pages.${pageId}.sourceAnchorIds`,
        lessonId,
        pageId
      });
    }
    const interactionSpec = isRecord(page.interactionSpec) ? page.interactionSpec : undefined;
    const cognitivePurpose = typeof interactionSpec?.cognitivePurpose === "string" ? interactionSpec.cognitivePurpose : "";
    if (interactionSpec && isVagueCognitivePurpose(cognitivePurpose)) {
      issues.push({
        issueId: "quality.interaction.cognitive-purpose-vague",
        scope: "page",
        severity: "warning",
        category: "decorative_interaction",
        reason: "interaction cognitivePurpose is vague and does not name the mental-model work",
        requiredFix: "Rewrite the interaction around prediction, decision, comparison, causality, misconception repair, parameter change, or transfer.",
        rule: "interaction-cognitive-purpose",
        path: `pages.${pageId}.interactionSpec.cognitivePurpose`,
        lessonId,
        pageId
      });
    }
    return issues;
    })
  ];
}

function repetitiveLongNarrativeIssue(lessonId: string, pages: Record<string, unknown>[]): CourseQualityIssue | undefined {
  const counts = new Map<string, number>();
  for (const page of pages) {
    if (typeof page.narrative !== "string") {
      continue;
    }
    const normalized = normalizeNarrative(page.narrative);
    if (normalized.length < 60) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const repeatedCount = Math.max(0, ...counts.values());
  if (repeatedCount < 3) {
    return undefined;
  }
  return {
    issueId: "quality.lesson.repetitive-pages",
    scope: "lesson",
    severity: "warning",
    category: "dense_page",
    reason: `lesson repeats substantially identical long narrative across ${repeatedCount} pages`,
    requiredFix: "Rewrite repeated pages so each page performs a distinct mental-model move with different source evidence, visual role, and learner action.",
    rule: "repetitive-page-narrative",
    path: "pages[*].narrative",
    lessonId
  };
}

function normalizeNarrative(value: string): string {
  return value.replace(/\s+/gu, "").slice(0, 600);
}

function sourceTermsFromAuthoringContext(authoringContext: CourseQualityAuthoringContext | undefined): string[] {
  return Array.from(
    new Set(
      (authoringContext?.sourceSemantics?.keyTerms ?? [])
        .map((term) => {
          if (typeof term === "string") {
            return term.trim();
          }
          if (typeof term.term === "string") {
            return term.term.trim();
          }
          if (typeof term.label === "string") {
            return term.label.trim();
          }
          return "";
        })
        .filter((term) => term.length >= 3)
    )
  );
}

function requiresAcademicDepth(authoringContext: CourseQualityAuthoringContext | undefined, lesson: Record<string, unknown>): boolean {
  const difficulty = authoringContext?.difficultyLevel ?? "";
  if (difficulty === "upper_undergraduate_or_graduate" || difficulty === "research") {
    return true;
  }
  const learnerLevelText = [lesson.audience, lesson.title].filter((value): value is string => typeof value === "string").join(" ");
  return /研究生|论文精读|前沿讨论/u.test(learnerLevelText);
}

const academicDepthMarkers = ["先修", "正式术语", "证据", "局限", "假设", "批判", "课堂讨论", "课后作业", "研究问题", "方法边界"];

function academicMarkerCount(text: string): number {
  return academicDepthMarkers.reduce((count, marker) => count + (text.includes(marker) ? 1 : 0), 0);
}

const genericPageMarkers = ["核心概念", "整体内容", "资料大意", "基本概念", "学习重点", "帮助学习者理解", "快速摘要", "本页介绍"];

function isGenericPage(pageText: string): boolean {
  return genericPageMarkers.filter((marker) => pageText.includes(marker)).length >= 2;
}

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

function isVagueCognitivePurpose(cognitivePurpose: string): boolean {
  const trimmed = cognitivePurpose.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (vagueCognitivePurposeMarkers.some((marker) => trimmed.includes(marker))) {
    return true;
  }
  return !cognitivePurposeMarkers.some((marker) => trimmed.includes(marker));
}

function textOf(value: unknown): string {
  return JSON.stringify(value);
}

function includesIgnoreCase(text: string, term: string): boolean {
  return text.toLocaleLowerCase().includes(term.toLocaleLowerCase());
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function toCourseQualityIssue(issue: QualityIssue, lessonId?: string): CourseQualityIssue {
  const pageId = extractPageId(issue.path);
  const category = categoryForIssue(issue);
  const scope = scopeForIssue(issue, pageId);

  return {
    issueId: issueIdForIssue(issue, category, scope),
    scope,
    severity: issue.severity,
    category,
    reason: issue.message,
    requiredFix: requiredFixForIssue(issue, category),
    rule: issue.rule,
    path: issue.path,
    ...(lessonId && scope !== "course" ? { lessonId } : {}),
    ...(pageId ? { pageId } : {})
  };
}

function categoryForIssue(issue: QualityIssue): CourseQualityIssueCategory {
  if (issue.rule === "source-evidence") {
    return "source_evidence";
  }
  if (issue.rule === "source-grounding") {
    return "source_anchor";
  }
  if (issue.rule === "interaction-feedback") {
    return "decorative_interaction";
  }
  if (issue.rule === "assessment-feedback") {
    return "missing_feedback";
  }
  if (issue.rule === "assessment-count" || issue.path.includes("misconception")) {
    return "assessment";
  }
  if (issue.rule === "interaction-count") {
    return "interaction";
  }
  if (issue.rule === "transfer-challenge") {
    return "transfer";
  }
  if (issue.rule === "chinese-first") {
    return "learner_level_mismatch";
  }
  return "page_structure";
}

function scopeForIssue(issue: QualityIssue, pageId: string | undefined): CourseQualityIssueScope {
  if (issue.path === "sourceEvidence" || issue.rule === "source-evidence") {
    return "course";
  }
  if (pageId) {
    return "page";
  }
  return "lesson";
}

function issueIdForIssue(issue: QualityIssue, category: CourseQualityIssueCategory, scope: CourseQualityIssueScope): string {
  if (issue.rule === "source-evidence") {
    return `quality.source-evidence.${issue.severity === "error" ? "failed" : "warning"}`;
  }
  if (issue.rule === "assessment-feedback") {
    return "quality.page.feedback-missing";
  }
  if (issue.rule === "interaction-feedback") {
    return "quality.interaction.feedback-missing";
  }
  if (issue.rule === "source-grounding" && scope === "page") {
    return "quality.page.source-anchor-missing";
  }
  if (issue.rule === "source-grounding") {
    return "quality.lesson.source-anchor-missing";
  }
  return `quality.${scope}.${sanitizeRule(issue.rule || category)}`;
}

function requiredFixForIssue(issue: QualityIssue, category: CourseQualityIssueCategory): string {
  if (category === "source_evidence") {
    return "Add page.sourceAnchorIds for source-backed pages, or mark grounding.kind as inferred/analogy with a clear source rationale.";
  }
  if (category === "source_anchor") {
    return "Attach sourceAnchorIds to the affected lesson/page so claims can be traced back to the source material.";
  }
  if (category === "missing_feedback") {
    return "Add feedbackSpec.correctFeedback and incorrectFeedback with mechanism-level explanations, not only correct/incorrect labels.";
  }
  if (category === "decorative_interaction") {
    return "Define learnerAction, expectedObservation, and cognitivePurpose so the interaction changes the learner's mental model.";
  }
  if (category === "assessment") {
    return "Add or repair mental-model checks: recall, prediction, misconception, and transfer should have explanatory feedback.";
  }
  if (category === "interaction") {
    return "Add at least two meaningful learner actions that expose cause and effect.";
  }
  if (category === "transfer") {
    return "Add a transfer challenge that asks the learner to apply the concept in a new but related context.";
  }
  if (category === "learner_level_mismatch") {
    return "Rewrite learner-facing text in Chinese and match it to the declared audience level.";
  }
  return issue.severity === "error"
    ? "Repair the lesson structure so required page types, objectives, visuals, and summary are complete."
    : "Improve the page structure so each screen focuses on one learning goal.";
}

function extractPageId(pathValue: string): string | undefined {
  const match = /^pages\.([^.]+)/u.exec(pathValue);
  return match?.[1];
}

function sanitizeRule(rule: string): string {
  return rule.replace(/[^a-z0-9-]+/giu, "-").replace(/^-|-$/gu, "");
}

function sortCourseQualityIssues(issues: CourseQualityIssue[]): CourseQualityIssue[] {
  return [...issues].sort((left, right) => {
    const severityDelta = severityPriority(left.severity) - severityPriority(right.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    const scopeDelta = scopePriority(left.scope) - scopePriority(right.scope);
    if (scopeDelta !== 0) {
      return scopeDelta;
    }
    return left.issueId.localeCompare(right.issueId);
  });
}

function severityPriority(severity: QualityIssue["severity"]): number {
  return severity === "error" ? 0 : 1;
}

function scopePriority(scope: CourseQualityIssueScope): number {
  return { course: 0, unit: 1, lesson: 2, page: 3 }[scope];
}

function summarizeCourseQualityIssues(issues: CourseQualityIssue[]): CourseQualityIssueSummary {
  const summary: CourseQualityIssueSummary = {
    course: 0,
    unit: 0,
    lesson: 0,
    page: 0,
    errors: 0,
    warnings: 0,
    byCategory: {}
  };

  for (const issue of issues) {
    summary[issue.scope] += 1;
    if (issue.severity === "error") {
      summary.errors += 1;
    } else {
      summary.warnings += 1;
    }
    summary.byCategory[issue.category] = (summary.byCategory[issue.category] ?? 0) + 1;
  }

  return summary;
}

function resolveCourseStatus(
  checks: CourseQualityReport["checks"],
  requiredFixes: string[],
  optionalImprovements: string[]
): CourseQualityStatus {
  if (requiredFixes.length > 0 || Object.values(checks).includes("failed")) {
    return "failed";
  }
  if (optionalImprovements.length > 0 || Object.values(checks).includes("warning")) {
    return "warning";
  }
  return "passed";
}

function scoreFromIssues(requiredFixCount: number, optionalImprovementCount: number): number {
  return Math.max(0, 100 - requiredFixCount * 15 - optionalImprovementCount * 5);
}

function formatCourseQualityIssue(issue: CourseQualityIssue): string {
  return `${issue.issueId}: ${issue.path}: ${issue.reason} Required fix: ${issue.requiredFix}`;
}

function summarizeCourseQuality(status: CourseQualityStatus, score: number, requiredFixCount: number, optionalImprovementCount: number): string {
  if (status === "failed") {
    return `课程质量未通过，得分 ${score}，需要修复 ${requiredFixCount} 个阻塞问题。`;
  }
  if (status === "warning") {
    return `课程质量有警告，得分 ${score}，建议改进 ${optionalImprovementCount} 项。`;
  }
  return `课程质量通过，得分 ${score}，可以进入学习预览。`;
}
