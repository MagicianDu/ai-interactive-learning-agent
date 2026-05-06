import type { CourseIR, CourseIRPage, CourseIRUnit } from "./course-ir.js";
import type { ContentBlueprint } from "./content-quality-blueprint.js";
import { validateContentBlueprintCompliance } from "./content-blueprint-compliance.js";

export type PublishValidationStatus = "passed" | "failed";

export type PublishValidationIssueSeverity = "error" | "warning";

export type PublishValidationIssue = {
  issueId: string;
  scope: "course" | "unit" | "lesson" | "page";
  severity: PublishValidationIssueSeverity;
  reason: string;
  requiredFix: string;
  coursePackId?: string;
  unitId?: string;
  lessonId?: string;
  pageId?: string;
};

export type PublishValidationResult = {
  status: PublishValidationStatus;
  blockingIssueCount: number;
  issues: PublishValidationIssue[];
};

export type ValidatePublishBundleInput = {
  courseIR: CourseIR;
  sourceBacked?: boolean;
  contentBlueprint?: ContentBlueprint;
};

export function validatePublishBundle(input: ValidatePublishBundleInput): PublishValidationResult {
  const issues = [
    ...validateUnits(input.courseIR),
    ...validateLessons(input.courseIR, input.sourceBacked ?? false),
    ...(input.contentBlueprint
      ? validateContentBlueprintCompliance({
          courseIR: input.courseIR,
          contentBlueprint: input.contentBlueprint
        })
      : [])
  ];
  const blockingIssueCount = issues.filter((issue) => issue.severity === "error").length;

  return {
    status: blockingIssueCount > 0 ? "failed" : "passed",
    blockingIssueCount,
    issues
  };
}

function validateUnits(courseIR: CourseIR): PublishValidationIssue[] {
  const lessonIds = new Set(courseIR.lessons.map((lesson) => lesson.lessonId));
  return courseIR.units.flatMap((unit) => validateUnit(unit, lessonIds, courseIR.coursePackId));
}

function validateUnit(unit: CourseIRUnit, lessonIds: Set<string>, coursePackId: string): PublishValidationIssue[] {
  if (unit.lessonId && !lessonIds.has(unit.lessonId)) {
    return [
      {
        issueId: "publish.unit.lesson-missing",
        scope: "unit",
        severity: "error",
        coursePackId,
        unitId: unit.unitId,
        lessonId: unit.lessonId,
        reason: `Unit ${unit.unitId} references lesson ${unit.lessonId}, but that lesson is not included in the bundle.`,
        requiredFix: "Add the referenced lesson to lessons[] or remove the unit.lessonId before publishing."
      }
    ];
  }
  return [];
}

function validateLessons(courseIR: CourseIR, sourceBacked: boolean): PublishValidationIssue[] {
  return courseIR.lessons.flatMap((lesson) =>
    lesson.pages.flatMap((page) => validatePage({ page, lessonId: lesson.lessonId, coursePackId: courseIR.coursePackId, sourceBacked }))
  );
}

function validatePage(input: {
  page: CourseIRPage;
  lessonId: string;
  coursePackId: string;
  sourceBacked: boolean;
}): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  if (!input.page.learningGoal || input.page.learningGoal.trim().length === 0) {
    issues.push({
      issueId: "publish.page.learning-goal-missing",
      scope: "page",
      severity: "error",
      coursePackId: input.coursePackId,
      lessonId: input.lessonId,
      pageId: input.page.pageId,
      reason: "A publishable learning page must have one explicit learning goal.",
      requiredFix: "Set page.learningGoal to a learner-facing objective for this page."
    });
  }

  if (input.sourceBacked && input.page.sourceSupport === "missing") {
    issues.push({
      issueId: "publish.page.source-support-missing",
      scope: "page",
      severity: "error",
      coursePackId: input.coursePackId,
      lessonId: input.lessonId,
      pageId: input.page.pageId,
      reason: "A source-backed page must cite source anchors or declare inferred/analogy grounding.",
      requiredFix: "Add page.sourceAnchorIds or set page.grounding.kind to inferred or analogy with a note."
    });
  }

  if (input.page.hasAssessment && !input.page.hasFeedback) {
    issues.push({
      issueId: "publish.page.assessment-feedback-missing",
      scope: "page",
      severity: "error",
      coursePackId: input.coursePackId,
      lessonId: input.lessonId,
      pageId: input.page.pageId,
      reason: "An assessment page must include explanatory feedback so learners know why an answer works or fails.",
      requiredFix: "Add page.feedbackSpec.correctFeedback and incorrectFeedback with mechanism-level explanations."
    });
  }

  return issues;
}
