import type { RunConfig } from "../types.js";
import { isRecord, isStringArray, validationResult, type QualityIssue, type QualityValidationResult } from "./validation-result.js";

export function validateSourceGrounding(lesson: unknown, config: RunConfig): QualityValidationResult {
  const issues: QualityIssue[] = [];
  const sourceBacked = config.sources.some((source) => source.type !== "topic") || config.selectedUnit !== undefined;
  if (!sourceBacked) {
    return validationResult(issues);
  }

  if (!isRecord(lesson)) {
    return validationResult([
      {
        rule: "source-grounding",
        path: "$",
        message: "source-backed lesson must be an object",
        severity: "error"
      }
    ]);
  }

  const sourceContext = lesson.sourceContext;
  const sourceAnchorIds = isRecord(sourceContext) ? sourceContext.sourceAnchorIds : undefined;
  if (!isStringArray(sourceAnchorIds) || sourceAnchorIds.length === 0) {
    issues.push({
      rule: "source-grounding",
      path: "sourceContext.sourceAnchorIds",
      message: "source-backed lessons must include sourceContext.sourceAnchorIds or explicit source anchors",
      severity: "error"
    });
  }

  return validationResult(issues);
}
