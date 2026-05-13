import type { CourseIR, CourseIRLesson, CourseIRPage, CourseIRUnit } from "./course-ir.js";
import type { ContentBlueprint, PageContentBlueprint, UnitContentBlueprint } from "./content-quality-blueprint.js";
import { defaultCourseIntent, normalizeCourseIntent } from "./course-intent.js";
import type { PublishValidationIssue } from "./publish-validation.js";
import { isRecord, isStringArray } from "../quality/validation-result.js";

export type ValidateContentBlueprintComplianceInput = {
  courseIR: CourseIR;
  contentBlueprint: ContentBlueprint;
};

type ContentBlueprintCandidate = Omit<ContentBlueprint, "courseIntent"> & {
  courseIntent?: unknown;
};

const visualRequiredPageTypes = new Set(["problem_scene", "intuition_visual", "structure_diagram", "process_animation", "summary_card"]);
const interactionRequiredPageTypes = new Set(["interactive_model"]);
const assessmentRequiredPageTypes = new Set(["quiz", "misconception_check", "transfer_challenge"]);

export function validateContentBlueprintCompliance(input: ValidateContentBlueprintComplianceInput): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const unitsById = new Map(input.courseIR.units.map((unit) => [unit.unitId, unit]));
  const lessonsById = new Map(input.courseIR.lessons.map((lesson) => [lesson.lessonId, lesson]));

  for (const unitBlueprint of input.contentBlueprint.units) {
    const unit = unitsById.get(unitBlueprint.unitId);
    if (!unit) {
      issues.push(unitMissingIssue(input.courseIR.coursePackId, unitBlueprint));
      continue;
    }

    if (unit.lessonId && unit.lessonId !== unitBlueprint.lessonId) {
      issues.push(lessonIdMismatchIssue(input.courseIR.coursePackId, unit, unitBlueprint));
    }

    const lesson = lessonsById.get(unitBlueprint.lessonId);
    if (!lesson) {
      issues.push(lessonMissingIssue(input.courseIR.coursePackId, unitBlueprint));
      continue;
    }

    issues.push(...validateUnitPages(input.courseIR.coursePackId, unitBlueprint, lesson, input.contentBlueprint.courseIntent));
  }

  return issues;
}

export function extractContentBlueprint(value: unknown): ContentBlueprint | undefined {
  const candidate = isRecord(value) && "contentBlueprint" in value ? value.contentBlueprint : value;
  if (!isContentBlueprint(candidate)) {
    return undefined;
  }
  const blueprint = candidate;
  if ("courseIntent" in blueprint) {
    const courseIntent = normalizeCourseIntent(blueprint.courseIntent);
    return courseIntent ? { ...blueprint, courseIntent } : undefined;
  }
  return { ...blueprint, courseIntent: defaultCourseIntent };
}

function validateUnitPages(
  coursePackId: string,
  unitBlueprint: UnitContentBlueprint,
  lesson: CourseIRLesson,
  courseIntent: ContentBlueprint["courseIntent"]
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const sortedBlueprints = [...unitBlueprint.pageBlueprints].sort((first, second) => first.pageNumber - second.pageNumber);
  const selfStudyTextbook = courseIntent === "student_self_study_textbook";

  for (const pageBlueprint of sortedBlueprints) {
    const page = lesson.pages[pageBlueprint.pageNumber - 1];
    if (!page) {
      issues.push(pageMissingIssue(coursePackId, unitBlueprint, lesson.lessonId, pageBlueprint));
      continue;
    }

    if (page.type !== pageBlueprint.pageType) {
      issues.push(pageTypeMismatchIssue(coursePackId, unitBlueprint, lesson.lessonId, page, pageBlueprint));
    }

    if (requiresSourceSupport(unitBlueprint, pageBlueprint) && page.sourceSupport === "missing") {
      issues.push(sourceSupportMissingIssue(coursePackId, unitBlueprint, lesson.lessonId, page));
    }

    if (!selfStudyTextbook && visualRequiredPageTypes.has(pageBlueprint.pageType) && !page.hasVisual) {
      issues.push(visualMissingIssue(coursePackId, unitBlueprint, lesson.lessonId, page, pageBlueprint));
    }

    if (!selfStudyTextbook && interactionRequiredPageTypes.has(pageBlueprint.pageType) && !page.hasInteraction) {
      issues.push(learnerActionMissingIssue(coursePackId, unitBlueprint, lesson.lessonId, page, pageBlueprint, "interactionSpec"));
    }

    if (!selfStudyTextbook && assessmentRequiredPageTypes.has(pageBlueprint.pageType)) {
      if (!page.hasAssessment) {
        issues.push(learnerActionMissingIssue(coursePackId, unitBlueprint, lesson.lessonId, page, pageBlueprint, "assessmentSpec"));
      } else if (!page.hasFeedback) {
        issues.push(feedbackMissingIssue(coursePackId, unitBlueprint, lesson.lessonId, page, pageBlueprint));
      }
    }
  }

  return issues;
}

function requiresSourceSupport(unitBlueprint: UnitContentBlueprint, pageBlueprint: PageContentBlueprint): boolean {
  return (
    unitBlueprint.sourceRequirement.includes("source-backed") ||
    pageBlueprint.sourceRequirement.includes("source-backed") ||
    unitBlueprint.sourceAnchorIds.length > 0
  );
}

function isContentBlueprint(value: unknown): value is ContentBlueprintCandidate {
  return (
    isRecord(value) &&
    value.version === "content-blueprint/v1" &&
    isStringArray(value.globalRules) &&
    Array.isArray(value.units) &&
    value.units.every(isUnitContentBlueprint)
  );
}

function isUnitContentBlueprint(value: unknown): value is UnitContentBlueprint {
  return (
    isRecord(value) &&
    isNonEmptyString(value.unitId) &&
    isNonEmptyString(value.lessonId) &&
    isNonEmptyString(value.title) &&
    typeof value.targetPageCount === "number" &&
    isNonEmptyString(value.unitKind) &&
    isStringArray(value.focusConcepts) &&
    isStringArray(value.sourceAnchorIds) &&
    isNonEmptyString(value.sourceRequirement) &&
    Array.isArray(value.pageBlueprints) &&
    value.pageBlueprints.every(isPageContentBlueprint)
  );
}

function isPageContentBlueprint(value: unknown): value is PageContentBlueprint {
  return (
    isRecord(value) &&
    typeof value.pageNumber === "number" &&
    isNonEmptyString(value.pageType) &&
    isNonEmptyString(value.teachingMove) &&
    isNonEmptyString(value.learnerAction) &&
    isNonEmptyString(value.visualRequirement) &&
    isNonEmptyString(value.feedbackRequirement) &&
    isNonEmptyString(value.sourceRequirement) &&
    isStringArray(value.mustInclude)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unitMissingIssue(coursePackId: string, unitBlueprint: UnitContentBlueprint): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.unit-missing",
    scope: "unit",
    severity: "error",
    coursePackId,
    unitId: unitBlueprint.unitId,
    reason: `contentBlueprint references unit ${unitBlueprint.unitId}, but the course pack does not include it.`,
    requiredFix: "Align coursePack.units with contentBlueprint.units before publishing."
  };
}

function lessonIdMismatchIssue(coursePackId: string, unit: CourseIRUnit, unitBlueprint: UnitContentBlueprint): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.lesson-id-mismatch",
    scope: "unit",
    severity: "error",
    coursePackId,
    unitId: unit.unitId,
    lessonId: unit.lessonId,
    reason: `Unit ${unit.unitId} points to lesson ${unit.lessonId}, but contentBlueprint expects ${unitBlueprint.lessonId}.`,
    requiredFix: "Use the lessonId from contentBlueprint for this unit, or regenerate authoring context for the revised course structure."
  };
}

function lessonMissingIssue(coursePackId: string, unitBlueprint: UnitContentBlueprint): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.lesson-missing",
    scope: "lesson",
    severity: "error",
    coursePackId,
    unitId: unitBlueprint.unitId,
    lessonId: unitBlueprint.lessonId,
    reason: `contentBlueprint expects lesson ${unitBlueprint.lessonId}, but the publish bundle does not include it.`,
    requiredFix: "Add the lesson required by contentBlueprint.units[*].lessonId, or regenerate authoring context for the new lesson ids."
  };
}

function pageMissingIssue(
  coursePackId: string,
  unitBlueprint: UnitContentBlueprint,
  lessonId: string,
  pageBlueprint: PageContentBlueprint
): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.page-missing",
    scope: "page",
    severity: "error",
    coursePackId,
    unitId: unitBlueprint.unitId,
    lessonId,
    reason: `contentBlueprint expects page ${pageBlueprint.pageNumber} (${pageBlueprint.pageType}), but the lesson has no page there.`,
    requiredFix: "Add the missing page or adjust the course plan before publishing."
  };
}

function pageTypeMismatchIssue(
  coursePackId: string,
  unitBlueprint: UnitContentBlueprint,
  lessonId: string,
  page: CourseIRPage,
  pageBlueprint: PageContentBlueprint
): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.page-type-mismatch",
    scope: "page",
    severity: "error",
    coursePackId,
    unitId: unitBlueprint.unitId,
    lessonId,
    pageId: page.pageId,
    reason: `Page ${pageBlueprint.pageNumber} is ${page.type}, but contentBlueprint expects ${pageBlueprint.pageType}.`,
    requiredFix: `Rewrite page ${pageBlueprint.pageNumber} to follow contentBlueprint.units[*].pageBlueprints[${pageBlueprint.pageNumber - 1}].pageType.`
  };
}

function sourceSupportMissingIssue(
  coursePackId: string,
  unitBlueprint: UnitContentBlueprint,
  lessonId: string,
  page: CourseIRPage
): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.source-support-missing",
    scope: "page",
    severity: "error",
    coursePackId,
    unitId: unitBlueprint.unitId,
    lessonId,
    pageId: page.pageId,
    reason: "A source-backed contentBlueprint page has no source anchors and no inferred/analogy grounding.",
    requiredFix: "Add page.sourceAnchorIds from the source, or set page.grounding.kind to inferred or analogy with an explicit note."
  };
}

function visualMissingIssue(
  coursePackId: string,
  unitBlueprint: UnitContentBlueprint,
  lessonId: string,
  page: CourseIRPage,
  pageBlueprint: PageContentBlueprint
): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.visual-missing",
    scope: "page",
    severity: "error",
    coursePackId,
    unitId: unitBlueprint.unitId,
    lessonId,
    pageId: page.pageId,
    reason: `Page ${pageBlueprint.pageNumber} (${pageBlueprint.pageType}) must carry the visual structure requested by contentBlueprint.`,
    requiredFix: "Add page.visualSpec with labeled teaching elements rather than relying on prose only."
  };
}

function learnerActionMissingIssue(
  coursePackId: string,
  unitBlueprint: UnitContentBlueprint,
  lessonId: string,
  page: CourseIRPage,
  pageBlueprint: PageContentBlueprint,
  requiredField: "interactionSpec" | "assessmentSpec"
): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.learner-action-missing",
    scope: "page",
    severity: "error",
    coursePackId,
    unitId: unitBlueprint.unitId,
    lessonId,
    pageId: page.pageId,
    reason: `Page ${pageBlueprint.pageNumber} requires a learner action from contentBlueprint but has no ${requiredField}.`,
    requiredFix: `Add ${requiredField} so the learner must predict, choose, manipulate, or transfer instead of only reading.`
  };
}

function feedbackMissingIssue(
  coursePackId: string,
  unitBlueprint: UnitContentBlueprint,
  lessonId: string,
  page: CourseIRPage,
  pageBlueprint: PageContentBlueprint
): PublishValidationIssue {
  return {
    issueId: "publish.blueprint.feedback-missing",
    scope: "page",
    severity: "error",
    coursePackId,
    unitId: unitBlueprint.unitId,
    lessonId,
    pageId: page.pageId,
    reason: `Page ${pageBlueprint.pageNumber} requires explanatory feedback from contentBlueprint.`,
    requiredFix: "Add feedbackSpec.correctFeedback and feedbackSpec.incorrectFeedback with mechanism-level explanations."
  };
}
