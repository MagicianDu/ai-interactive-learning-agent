import { isNonEmptyString, isRecord, validationResult, type QualityIssue, type QualityValidationResult } from "./validation-result.js";

const cjkPattern = /[\u3400-\u9fff]/u;

export function validateChineseFirstLesson(lesson: unknown): QualityValidationResult {
  const issues: QualityIssue[] = [];
  if (!isRecord(lesson)) {
    return validationResult(issues);
  }

  checkChineseText(lesson.title, "title", issues);
  checkChineseText(lesson.audience, "audience", issues);

  if (Array.isArray(lesson.learningObjectives)) {
    lesson.learningObjectives.forEach((item, index) => checkChineseText(item, `learningObjectives.${index}`, issues));
  }
  if (Array.isArray(lesson.summary)) {
    lesson.summary.forEach((item, index) => checkChineseText(item, `summary.${index}`, issues));
  }

  if (Array.isArray(lesson.pages)) {
    for (const page of lesson.pages) {
      if (!isRecord(page)) {
        continue;
      }
      const pageId = isNonEmptyString(page.id) ? page.id : "unknown";
      checkChineseText(page.title, `pages.${pageId}.title`, issues);
      checkChineseText(page.learningGoal, `pages.${pageId}.learningGoal`, issues);
      checkChineseText(page.narrative, `pages.${pageId}.narrative`, issues);
      if (isRecord(page.interactionSpec)) {
        checkChineseText(page.interactionSpec.learnerAction, `pages.${pageId}.interactionSpec.learnerAction`, issues);
        checkChineseText(page.interactionSpec.expectedObservation, `pages.${pageId}.interactionSpec.expectedObservation`, issues);
        checkChineseText(page.interactionSpec.cognitivePurpose, `pages.${pageId}.interactionSpec.cognitivePurpose`, issues);
      }
      if (isRecord(page.assessmentSpec)) {
        checkChineseText(page.assessmentSpec.prompt, `pages.${pageId}.assessmentSpec.prompt`, issues);
      }
      if (isRecord(page.feedbackSpec)) {
        checkChineseText(page.feedbackSpec.correctFeedback, `pages.${pageId}.feedbackSpec.correctFeedback`, issues);
        checkChineseText(page.feedbackSpec.incorrectFeedback, `pages.${pageId}.feedbackSpec.incorrectFeedback`, issues);
      }
    }
  }

  return validationResult(issues);
}

function checkChineseText(value: unknown, path: string, issues: QualityIssue[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    return;
  }
  if (!cjkPattern.test(value)) {
    issues.push({
      rule: "chinese-first",
      path,
      message: `${path} should be Chinese-first learner-facing text`,
      severity: "error"
    });
  }
}
