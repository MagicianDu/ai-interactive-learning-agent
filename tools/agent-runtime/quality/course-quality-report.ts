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
};

export function buildCourseQualityReport(input: BuildCourseQualityReportInput): CourseQualityReport {
  const lessonIssueGroups = input.lessons.map((lesson) => collectLessonIssues(lesson, input.sourceGroundingConfig));
  const sourceEvidence =
    input.sourceEvidence ?? (input.sourceGroundingConfig ? analyzeSourceEvidence(input.lessons, input.sourceGroundingConfig) : undefined);
  const sourceEvidenceIssue = sourceEvidenceToIssue(sourceEvidence);
  const allIssues = [...lessonIssueGroups.flatMap((group) => group.issues), ...(sourceEvidenceIssue ? [sourceEvidenceIssue] : [])];
  const requiredFixes = allIssues.filter((issue) => issue.severity === "error").map(formatIssue);
  const optionalImprovements = allIssues.filter((issue) => issue.severity === "warning").map(formatIssue);
  const checks = {
    sourceEvidence: statusFromSourceEvidence(sourceEvidence),
    chineseFirst: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter((issue) => issue.rule === "chinese-first"))),
    pageStructure: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter(isPageStructureIssue))),
    interactionQuality: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter(isInteractionIssue))),
    assessmentCoverage: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter(isAssessmentIssue))),
    transferCoverage: statusFromIssues(lessonIssueGroups.flatMap((group) => group.issues.filter((issue) => issue.rule === "transfer-challenge")))
  };
  const lessonScores = lessonIssueGroups.map((group, index) => {
    const critic = input.criticReports?.[index];
    const required = group.issues.filter((issue) => issue.severity === "error").map(formatIssue);
    const optional = group.issues.filter((issue) => issue.severity === "warning").map(formatIssue);
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

function formatIssue(issue: QualityIssue): string {
  return `${issue.rule}: ${issue.path}: ${issue.message}`;
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
