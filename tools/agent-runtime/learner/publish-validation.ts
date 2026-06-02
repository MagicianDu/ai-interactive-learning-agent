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
    lesson.pages.flatMap((page) =>
      validatePage({
        page,
        lessonId: lesson.lessonId,
        lessonDisplayMode: lesson.displayMode,
        coursePackId: courseIR.coursePackId,
        sourceBacked
      })
    )
  );
}

function validatePage(input: {
  page: CourseIRPage;
  lessonId: string;
  lessonDisplayMode?: string;
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

  if (requiresImagegenImage(input.lessonDisplayMode) && !input.page.hasVisual) {
    issues.push({
      issueId: "publish.page.imagegen-image-missing",
      scope: "page",
      severity: "error",
      coursePackId: input.coursePackId,
      lessonId: input.lessonId,
      pageId: input.page.pageId,
      reason: "Every textbook deck page must include a learner-facing imagegen teaching illustration.",
      requiredFix:
        "Add page.visualSpec with visualSpec.imageUrl, imageAlt, imageProvider: \"imagegen\", and an imagePrompt that focuses on the knowledge point."
    });
  }

  if (input.page.hasVisual) {
    issues.push(
      ...validateImagegenTeachingAsset({
        page: input.page,
        coursePackId: input.coursePackId,
        lessonId: input.lessonId,
        runId: input.coursePackId
      })
    );
  }

  return issues;
}

function requiresImagegenImage(lessonDisplayMode: string | undefined): boolean {
  return lessonDisplayMode === "textbook_deck";
}

function validateImagegenTeachingAsset(input: {
  page: CourseIRPage;
  coursePackId: string;
  lessonId: string;
  runId: string;
}): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const imageUrl = input.page.visualImageUrl?.trim() ?? "";
  const imagePrompt = input.page.visualImagePrompt?.trim() ?? "";
  const hasImagegenAsset =
    imageUrl.length > 0 &&
    !imageUrl.toLowerCase().endsWith(".svg") &&
    input.page.visualImageProvider === "imagegen" &&
    imagePrompt.length > 0;

  if (!hasImagegenAsset) {
    issues.push({
      issueId: "publish.page.imagegen-asset-missing",
      scope: "page",
      severity: "error",
      coursePackId: input.coursePackId,
      lessonId: input.lessonId,
      pageId: input.page.pageId,
      reason: "Every visual page must use a Codex-designed, imagegen-generated teaching illustration before publishing.",
      requiredFix:
        "Generate a teaching image with imagegen, save it as a preview-consumable PNG/WebP asset, and set visualSpec.imageUrl, imageAlt, imageProvider: \"imagegen\", and imagePrompt. Do not rely on SVG placeholders."
    });
    return issues;
  }

  if (!isPreviewImageUrl(imageUrl)) {
    issues.push({
      issueId: "publish.page.imagegen-url-not-preview",
      scope: "page",
      severity: "error",
      coursePackId: input.coursePackId,
      lessonId: input.lessonId,
      pageId: input.page.pageId,
      reason: "The imagegen teaching image must point to the run preview asset directory, not a fake or external placeholder URL.",
      requiredFix:
        "Set visualSpec.imageUrl to /__learning-preview/<runId>/images/<lessonId>/<pageId>-imagegen-v1.png and record the local PNG/WebP asset through the imagegen batch tools."
    });
  }

  const promptIssue = validateImagePromptSafety(imagePrompt);
  if (promptIssue) {
    issues.push({
      issueId: promptIssue.issueId,
      scope: "page",
      severity: "error",
      coursePackId: input.coursePackId,
      lessonId: input.lessonId,
      pageId: input.page.pageId,
      reason: promptIssue.reason,
      requiredFix: promptIssue.requiredFix
    });
  }

  return issues;
}

type ImagePromptSafetyIssue = {
  issueId: "publish.page.imagegen-prompt-unsafe" | "publish.page.imagegen-prompt-guard-missing";
  reason: string;
  requiredFix: string;
};

const negationPattern = /(不要|不能|不得|禁止|避免|不包含|不要包含|不使用|不得包含|无)\s*/iu;
const unsafeAllowPattern =
  /(可以|允许|可包含|包含|使用|加入|呈现|展示|生成|渲染)[^。；;,.，、]{0,18}(大段文字|长段落|长篇文字|段落解释|表格|table|UI\s*文本框|UI\s*面板|用户界面|文本框|text\s*panel|text\s*box|bullet\s*list|项目符号)/iu;

const requiredImagePromptGuards: Array<{ label: string; pattern: RegExp }> = [
  { label: "长段落或大段文字", pattern: /(长段落|大段文字|长篇文字|long\s*prose|paragraph)/iu },
  { label: "表格", pattern: /(表格|table)/iu },
  { label: "UI 文本框或面板", pattern: /(UI\s*文本框|UI\s*面板|用户界面|文本框|text\s*panel|text\s*box)/iu }
];

function validateImagePromptSafety(prompt: string): ImagePromptSafetyIssue | undefined {
  if (allowsUnsafeImageArtifact(prompt)) {
    return {
      issueId: "publish.page.imagegen-prompt-unsafe",
      reason: "The imagegen prompt permits text-heavy artifacts such as long prose, tables, or UI text panels.",
      requiredFix:
        "Revise visualSpec.imagePrompt so it explains the knowledge point with imagery and short labels only; do not allow long prose, tables, UI panels, page-title duplication, or card-text duplication."
    };
  }

  const missingGuards = requiredImagePromptGuards
    .filter((guard) => !hasNegatedPromptGuard(prompt, guard.pattern))
    .map((guard) => guard.label);

  if (missingGuards.length > 0) {
    return {
      issueId: "publish.page.imagegen-prompt-guard-missing",
      reason: `The imagegen prompt does not explicitly guard against: ${missingGuards.join("、")}.`,
      requiredFix:
        "在 visualSpec.imagePrompt 中明确写入：不要包含长段落文字、表格或 UI 文本框；图片应以知识点讲解为主，只保留必要短标签。"
    };
  }

  return undefined;
}

function isPreviewImageUrl(imageUrl: string): boolean {
  if (imageUrl.length === 0) {
    return false;
  }
  return imageUrl.startsWith("/__learning-preview/") && imageUrl.includes("/images/") && !imageUrl.includes("..");
}

function hasNegatedPromptGuard(prompt: string, topicPattern: RegExp): boolean {
  return prompt
    .split(/[。；;.!！?？\n]/u)
    .some((clause) => negationPattern.test(clause) && topicPattern.test(clause));
}

function allowsUnsafeImageArtifact(prompt: string): boolean {
  return prompt
    .split(/[。；;.!！?？\n]/u)
    .some((clause) => unsafeAllowPattern.test(clause) && !negationPattern.test(clause));
}
