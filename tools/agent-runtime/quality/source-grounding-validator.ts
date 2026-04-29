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
  if (isStringArray(sourceAnchorIds) && sourceAnchorIds.length > 0) {
    return validationResult(issues);
  }

  const pages = Array.isArray(lesson.pages) ? lesson.pages.filter(isRecord) : [];
  const groundedPages = pages.filter(isGroundedPage);
  if (pages.length > 0 && groundedPages.length === pages.length) {
    return validationResult(issues);
  }

  if (groundedPages.length > 0) {
    for (const page of pages) {
      if (!isGroundedPage(page)) {
        const pageId = typeof page.id === "string" && page.id.trim() ? page.id : "unknown";
        issues.push({
          rule: "source-grounding",
          path: `pages.${pageId}.sourceAnchorIds`,
          message: "source-backed page must include sourceAnchorIds or mark grounding.kind as inferred or analogy",
          severity: "error"
        });
      }
    }
  } else {
    issues.push({
      rule: "source-grounding",
      path: "sourceContext.sourceAnchorIds",
      message: "source-backed lessons must include sourceContext.sourceAnchorIds or explicit source anchors",
      severity: "error"
    });
  }

  return validationResult(issues);
}

function isGroundedPage(page: Record<string, unknown>): boolean {
  if (isStringArray(page.sourceAnchorIds) && page.sourceAnchorIds.length > 0) {
    return true;
  }

  const grounding = page.grounding;
  if (!isRecord(grounding)) {
    return false;
  }

  return grounding.kind === "inferred" || grounding.kind === "analogy";
}
