import { isNonEmptyString, isRecord, validationResult, type QualityIssue, type QualityValidationResult } from "./validation-result.js";

const requiredPageTypes = ["problem_scene", "interactive_model", "misconception_check"];

export function validateLessonQuality(lesson: unknown): QualityValidationResult {
  const issues: QualityIssue[] = [];

  if (!isRecord(lesson)) {
    return validationResult([
      {
        rule: "lesson-object",
        path: "$",
        message: "lesson must be an object",
        severity: "error"
      }
    ]);
  }

  const pages = Array.isArray(lesson.pages) ? lesson.pages.filter(isRecord) : [];
  const targetPageCount = isRecord(lesson.config) ? lesson.config.targetPageCount : undefined;
  if (typeof targetPageCount === "number" && pages.length !== targetPageCount) {
    issues.push({
      rule: "page-count",
      path: "pages",
      message: `pages length ${pages.length} does not match targetPageCount ${targetPageCount}`,
      severity: "error"
    });
  }

  const pageTypes = new Set(pages.map((page) => String(page.type)));
  for (const pageType of requiredPageTypes) {
    if (!pageTypes.has(pageType)) {
      issues.push({
        rule: "required-page-type",
        path: "pages",
        message: `lesson must include page type ${pageType}`,
        severity: "error"
      });
    }
  }

  const visualCount = pages.filter((page) => page.visualSpec !== undefined).length;
  if (visualCount < 3) {
    issues.push({
      rule: "visual-count",
      path: "pages",
      message: "lesson must include at least 3 visual explanations",
      severity: "error"
    });
  }

  const interactionPages = pages.filter((page) => page.interactionSpec !== undefined);
  if (interactionPages.length < 2) {
    issues.push({
      rule: "interaction-count",
      path: "pages",
      message: "lesson must include at least 2 meaningful interactions",
      severity: "error"
    });
  }

  const assessmentPages = pages.filter((page) => page.assessmentSpec !== undefined);
  if (assessmentPages.length < 2) {
    issues.push({
      rule: "assessment-count",
      path: "pages",
      message: "lesson must include at least 2 assessment or checkpoint pages",
      severity: "error"
    });
  }

  if (!Array.isArray(lesson.misconceptions) || lesson.misconceptions.length < 1) {
    issues.push({
      rule: "misconception-list",
      path: "misconceptions",
      message: "lesson must include at least one misconception",
      severity: "error"
    });
  }

  const hasTransferChallenge = pageTypes.has("transfer_challenge") || (Array.isArray(lesson.transferTasks) && lesson.transferTasks.length > 0);
  if (!hasTransferChallenge) {
    issues.push({
      rule: "transfer-challenge",
      path: "transferTasks",
      message: "lesson must include a transfer_challenge page or at least one transfer task",
      severity: "error"
    });
  }

  const hasSummaryCard = pageTypes.has("summary_card") || (Array.isArray(lesson.summary) && lesson.summary.length > 0);
  if (!hasSummaryCard) {
    issues.push({
      rule: "summary",
      path: "summary",
      message: "lesson must include a summary_card page or summary payload",
      severity: "error"
    });
  }

  for (const page of pages) {
    validateInteractionFeedback(page, issues);
    validateAssessmentFeedback(page, issues);
  }

  return validationResult(issues);
}

function validateInteractionFeedback(page: Record<string, unknown>, issues: QualityIssue[]): void {
  if (!isRecord(page.interactionSpec)) {
    return;
  }
  const pageId = isNonEmptyString(page.id) ? page.id : "unknown";
  const spec = page.interactionSpec;
  for (const field of ["learnerAction", "expectedObservation", "cognitivePurpose"]) {
    if (!isNonEmptyString(spec[field])) {
      issues.push({
        rule: "interaction-feedback",
        path: `pages.${pageId}.interactionSpec.${field}`,
        message: `interactionSpec.${field} must explain the learner action and learning purpose`,
        severity: "error"
      });
    }
  }
  if (Array.isArray(spec.options)) {
    for (const [index, option] of spec.options.entries()) {
      if (!isRecord(option) || !isNonEmptyString(option.explanation)) {
        issues.push({
          rule: "interaction-feedback",
          path: `pages.${pageId}.interactionSpec.options.${index}.explanation`,
          message: "interaction options must include explanatory feedback",
          severity: "error"
        });
      }
    }
  }
}

function validateAssessmentFeedback(page: Record<string, unknown>, issues: QualityIssue[]): void {
  if (!isRecord(page.assessmentSpec)) {
    return;
  }
  const pageId = isNonEmptyString(page.id) ? page.id : "unknown";
  if (!isRecord(page.feedbackSpec)) {
    issues.push({
      rule: "assessment-feedback",
      path: `pages.${pageId}.feedbackSpec`,
      message: "assessment pages must include explanatory feedbackSpec",
      severity: "error"
    });
    return;
  }
  if (!isNonEmptyString(page.feedbackSpec.correctFeedback) || !isNonEmptyString(page.feedbackSpec.incorrectFeedback)) {
    issues.push({
      rule: "assessment-feedback",
      path: `pages.${pageId}.feedbackSpec`,
      message: "feedbackSpec must include correctFeedback and incorrectFeedback",
      severity: "error"
    });
  }
}
