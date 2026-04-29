import type { RunConfig } from "../types.js";
import { validateChineseFirstLesson } from "./chinese-first-validator.js";
import { validateLessonQuality } from "./lesson-quality-validator.js";
import { validateSourceGrounding } from "./source-grounding-validator.js";
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
  summary: string;
};

export function buildLessonCriticReport(lesson: unknown, config: RunConfig): LessonCriticReport {
  const checks: Array<{ name: string; result: QualityValidationResult }> = [
    { name: "lesson-quality", result: validateLessonQuality(lesson) },
    { name: "chinese-first", result: validateChineseFirstLesson(lesson) },
    { name: "source-grounding", result: validateSourceGrounding(lesson, config) }
  ];
  const issues = checks.flatMap((check) => check.result.issues);
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
    summary:
      blockingFixes.length > 0
        ? `发现 ${blockingFixes.length} 个阻塞问题，需要修订 lesson 后再发布。`
        : "lesson 已通过自动质量门禁，可以进入人工审查或发布流程。"
  };
}
