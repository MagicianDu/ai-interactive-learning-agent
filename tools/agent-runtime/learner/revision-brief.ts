import type { LearningPreviewResult } from "./learning-preview-service.js";
import type { RevisionTargetV2 } from "./revision-targeting.js";

type ReadyLearningPreview = Extract<LearningPreviewResult, { status: "preview_ready" }>["preview"];

export type RevisionBriefV2 = {
  schemaVersion: 2;
  runId: string;
  revisionId: string;
  feedback: string;
  focus?: string;
  target: RevisionTargetV2;
  currentPreview?: ReadyLearningPreview;
  currentCoursePackPath?: string;
  currentLessonPaths: string[];
  courseIRPath?: string;
  qualityReportPath?: string;
  sourceConstraints: {
    preserveSourceAnchors: boolean;
    allowInferredGrounding: boolean;
    sourceBacked: boolean;
  };
  revisionInstructions: string[];
  expectedQualityChecks: string[];
  previousFeedbackCount: number;
  createdAt: string;
};

export type BuildRevisionBriefV2Input = {
  runId: string;
  revisionId: string;
  feedback: string;
  focus?: string;
  target: RevisionTargetV2;
  currentPreview?: ReadyLearningPreview;
  currentCoursePackPath?: string;
  currentLessonPaths?: string[];
  courseIRPath?: string;
  qualityReportPath?: string;
  sourceBacked?: boolean;
  previousFeedbackCount: number;
  now?: Date;
};

export function buildRevisionBriefV2(input: BuildRevisionBriefV2Input): RevisionBriefV2 {
  const sourceBacked = input.sourceBacked ?? false;
  return compactObject({
    schemaVersion: 2,
    runId: input.runId,
    revisionId: input.revisionId,
    feedback: input.feedback,
    focus: input.focus,
    target: input.target,
    currentPreview: input.currentPreview,
    currentCoursePackPath: input.currentCoursePackPath,
    currentLessonPaths: input.currentLessonPaths ?? [],
    courseIRPath: input.courseIRPath,
    qualityReportPath: input.qualityReportPath,
    sourceConstraints: {
      preserveSourceAnchors: true,
      allowInferredGrounding: true,
      sourceBacked
    },
    revisionInstructions: revisionInstructionsForTarget(input.target, sourceBacked),
    expectedQualityChecks: expectedQualityChecksForTarget(input.target, sourceBacked),
    previousFeedbackCount: input.previousFeedbackCount,
    createdAt: (input.now ?? new Date()).toISOString()
  }) as RevisionBriefV2;
}

function revisionInstructionsForTarget(target: RevisionTargetV2, sourceBacked: boolean): string[] {
  const instructions = [
    "Keep learner-facing content Chinese-first.",
    "Preserve the existing coursePack structure unless the target scope is course.",
    "Do not expose internal artifacts to the learner; publish a refreshed preview."
  ];

  if (target.scope === "page") {
    instructions.unshift("Revise only the targeted page unless the quality report shows a prerequisite issue.");
  }
  if (target.categories.includes("interaction_weak")) {
    instructions.push("Improve learner action, expected observation, and cognitive purpose together.");
  }
  if (target.categories.includes("feedback_unhelpful")) {
    instructions.push("Rewrite feedback to explain the causal mechanism, not only correct or incorrect status.");
  }
  if (sourceBacked) {
    instructions.push("Preserve existing sourceAnchorIds and grounding on source-backed pages.");
  }

  return instructions;
}

function expectedQualityChecksForTarget(target: RevisionTargetV2, sourceBacked: boolean): string[] {
  const checks = ["Chinese-first", "publish validation", "quality report"];
  if (sourceBacked || target.categories.includes("source_unclear") || target.categories.includes("suspicious_claim")) {
    checks.unshift("source grounding");
  }
  if (target.categories.includes("interaction_weak")) {
    checks.push("interaction quality");
  }
  if (target.categories.includes("feedback_unhelpful") || target.scope === "assessment") {
    checks.push("assessment feedback");
  }
  return Array.from(new Set(checks));
}

function compactObject<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
