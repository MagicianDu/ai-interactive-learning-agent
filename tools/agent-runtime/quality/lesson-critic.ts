import type { RunConfig } from "../types.js";
import { validateChineseFirstLesson } from "./chinese-first-validator.js";
import { validateLessonQuality } from "./lesson-quality-validator.js";
import { validateSourceGrounding } from "./source-grounding-validator.js";
import { summarizeSingleLessonSourceEvidence, type PageSourceEvidence, type SourceEvidenceSummary } from "./source-evidence-analyzer.js";
import type { QualityIssue, QualityValidationResult } from "./validation-result.js";

export type LessonCriticReport = {
  status: "passed" | "revision_required";
  score: number;
  checks: Array<{
    name: string;
    ok: boolean;
    issueCount: number;
  }>;
  blockingFixes: QualityIssue[];
  optionalImprovements: QualityIssue[];
  sourceEvidence: SourceEvidenceSummary;
  pageScores: Array<{
    pageId: string;
    sourceSupport: PageSourceEvidence["sourceSupport"];
    sourceSupportScore: number;
  }>;
  summary: string;
};

export function buildLessonCriticReport(lesson: unknown, config: RunConfig): LessonCriticReport {
  const sourceEvidence = summarizeSingleLessonSourceEvidence(lesson, config);
  const checks: Array<{ name: string; result: QualityValidationResult }> = [
    { name: "lesson-quality", result: validateLessonQuality(lesson) },
    { name: "chinese-first", result: validateChineseFirstLesson(lesson) },
    { name: "source-grounding", result: validateSourceGrounding(lesson, config) }
  ];
  const issues = [...checks.flatMap((check) => check.result.issues), ...sourceEvidenceIssues(sourceEvidence)];
  const blockingFixes = issues.filter((issue) => issue.severity === "error");
  const optionalImprovements = issues.filter((issue) => issue.severity === "warning");
  const score = Math.max(0, 100 - blockingFixes.length * 20 - optionalImprovements.length * 5);

  return {
    status: blockingFixes.length > 0 ? "revision_required" : "passed",
    score,
    checks: checks.map((check) => ({
      name: check.name,
      ok: check.result.ok,
      issueCount: check.result.issues.length
    })),
    blockingFixes,
    optionalImprovements,
    sourceEvidence,
    pageScores: sourceEvidence.pageSupport.map((page) => ({
      pageId: page.pageId,
      sourceSupport: page.sourceSupport,
      sourceSupportScore: sourceSupportScore(page.sourceSupport)
    })),
    summary:
      blockingFixes.length > 0
        ? `发现 ${blockingFixes.length} 个阻塞问题，需要修订 lesson 后再发布。`
        : "lesson 已通过自动质量门禁，可以进入人工审查或发布流程。"
  };
}

function sourceEvidenceIssues(sourceEvidence: SourceEvidenceSummary): QualityIssue[] {
  if (sourceEvidence.status === "passed") {
    return [];
  }

  return [
    {
      rule: "source-evidence",
      path: "sourceEvidence.unsupportedPageRefs",
      message:
        sourceEvidence.status === "failed"
          ? `source-backed lesson has ${sourceEvidence.unsupportedPages} unsupported page(s)`
          : "source-backed lesson relies more on inferred or analogy pages than direct source-supported pages",
      severity: sourceEvidence.status === "failed" ? "error" : "warning"
    }
  ];
}

function sourceSupportScore(sourceSupport: PageSourceEvidence["sourceSupport"]): number {
  if (sourceSupport === "supported") {
    return 1;
  }
  if (sourceSupport === "inferred" || sourceSupport === "analogy") {
    return 0.7;
  }
  return 0;
}
