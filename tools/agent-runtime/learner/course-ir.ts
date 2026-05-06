import type { SourceEvidenceSummary } from "../quality/source-evidence-analyzer.js";
import type { CourseQualityStatus } from "../quality/course-quality-report.js";
import { isRecord } from "../quality/validation-result.js";

export type CourseIRVersion = "course-ir/v1";

export type CourseIRUnitStatus = "ready" | "pending" | "failed" | "revised";

export type CourseIR = {
  schemaVersion: 1;
  irVersion: CourseIRVersion;
  runId: string;
  coursePackId: string;
  title: string;
  language: string;
  sourceKind?: string;
  strategy?: string;
  units: CourseIRUnit[];
  lessons: CourseIRLesson[];
  sourceEvidence?: Pick<
    SourceEvidenceSummary,
    "status" | "totalLessons" | "totalPages" | "supportedPages" | "inferredPages" | "unsupportedPages" | "supportRatio" | "unsupportedPageRefs"
  >;
  quality?: {
    status: CourseQualityStatus;
    score: number;
    summary?: string;
  };
  migration: {
    from: "course-pack+lessons";
    note: string;
  };
};

export type CourseIRUnit = {
  unitId: string;
  title: string;
  kind: string;
  status: CourseIRUnitStatus;
  lessonId?: string;
  pageCount: number;
  targetPageCount: number;
  sourceAnchorIds: string[];
  sourceNodeIds: string[];
  chapterRefs: string[];
  conceptIds: string[];
  revisionId?: string;
  failureReason?: string;
};

export type CourseIRLesson = {
  lessonId: string;
  unitId?: string;
  title: string;
  audience?: string;
  pageCount: number;
  targetPageCount?: number;
  sourceAnchorIds: string[];
  pages: CourseIRPage[];
  revisionId?: string;
};

export type CourseIRPage = {
  pageId: string;
  type: string;
  title: string;
  learningGoal?: string;
  sourceAnchorIds: string[];
  sourceSupport: "source" | "inferred" | "analogy" | "missing";
  hasVisual: boolean;
  hasInteraction: boolean;
  hasAssessment: boolean;
  hasFeedback: boolean;
  narrativeLength: number;
};

export type BuildCourseIRInput = {
  runId: string;
  coursePack: unknown;
  lessons: unknown[];
  sourceEvidence?: SourceEvidenceSummary;
  qualityReport?: {
    status: CourseQualityStatus;
    score: number;
    summary?: string;
  };
};

export function buildCourseIR(input: BuildCourseIRInput): CourseIR {
  const coursePack = normalizeCoursePack(input.coursePack, input.runId);
  const lessons = input.lessons.map(normalizeLesson);
  const lessonsById = new Map(lessons.map((lesson) => [lesson.lessonId, lesson]));
  const units = coursePack.units.map((unit) => {
    const lessonId = stringOrUndefined(unit.lessonId);
    const lesson = lessonId ? lessonsById.get(lessonId) : undefined;
    return normalizeUnit(unit, lesson);
  });

  return {
    schemaVersion: 1,
    irVersion: "course-ir/v1",
    runId: input.runId,
    coursePackId: coursePack.id,
    title: coursePack.title,
    language: coursePack.language ?? "zh-CN",
    ...(coursePack.sourceKind ? { sourceKind: coursePack.sourceKind } : {}),
    ...(coursePack.strategy ? { strategy: coursePack.strategy } : {}),
    units,
    lessons,
    ...(input.sourceEvidence ? { sourceEvidence: compactSourceEvidence(input.sourceEvidence) } : {}),
    ...(input.qualityReport ? { quality: input.qualityReport } : {}),
    migration: {
      from: "course-pack+lessons",
      note: "Course IR v1 normalizes course pack units and lesson pages without replacing the renderer schemas."
    }
  };
}

function normalizeCoursePack(value: unknown, runId: string): {
  id: string;
  title: string;
  language?: string;
  sourceKind?: string;
  strategy?: string;
  units: Array<Record<string, unknown>>;
} {
  const record = isRecord(value) ? value : {};
  return {
    id: stringOr(record.id, runId),
    title: stringOr(record.title, "Untitled course"),
    language: stringOrUndefined(record.language),
    sourceKind: stringOrUndefined(record.sourceKind),
    strategy: stringOrUndefined(record.strategy),
    units: Array.isArray(record.units) ? record.units.filter(isRecord) : []
  };
}

function normalizeLesson(value: unknown): CourseIRLesson {
  const record = isRecord(value) ? value : {};
  const sourceContext = isRecord(record.sourceContext) ? record.sourceContext : {};
  const pages = Array.isArray(record.pages) ? record.pages.map(normalizePage) : [];
  const revision = isRecord(record.revision) ? record.revision : undefined;

  return {
    lessonId: stringOr(record.id, "unknown-lesson"),
    unitId: stringOrUndefined(sourceContext.unitId),
    title: stringOr(record.title, "Untitled lesson"),
    audience: stringOrUndefined(record.audience),
    pageCount: pages.length,
    targetPageCount: isRecord(record.config) && typeof record.config.targetPageCount === "number" ? record.config.targetPageCount : undefined,
    sourceAnchorIds: stringArrayOrEmpty(sourceContext.sourceAnchorIds),
    pages,
    ...(typeof revision?.revisionId === "string" ? { revisionId: revision.revisionId } : {})
  };
}

function normalizeUnit(unit: Record<string, unknown>, lesson: CourseIRLesson | undefined): CourseIRUnit {
  const explicitStatus = stringOrUndefined(unit.status);
  const failureReason = stringOrUndefined(unit.failureReason);
  const status = normalizeUnitStatus(explicitStatus, lesson, failureReason);
  return {
    unitId: stringOr(unit.unitId, "unknown-unit"),
    title: stringOr(unit.title, "Untitled unit"),
    kind: stringOr(unit.kind, "topic"),
    status,
    lessonId: stringOrUndefined(unit.lessonId),
    pageCount: lesson?.pageCount ?? 0,
    targetPageCount: typeof unit.targetPageCount === "number" ? unit.targetPageCount : 0,
    sourceAnchorIds: stringArrayOrEmpty(unit.sourceAnchorIds),
    sourceNodeIds: stringArrayOrEmpty(unit.sourceNodeIds),
    chapterRefs: stringArrayOrEmpty(unit.chapterRefs),
    conceptIds: stringArrayOrEmpty(unit.conceptIds),
    ...(lesson?.revisionId ? { revisionId: lesson.revisionId } : {}),
    ...(failureReason ? { failureReason } : {})
  };
}

function normalizeUnitStatus(
  status: string | undefined,
  lesson: CourseIRLesson | undefined,
  failureReason: string | undefined
): CourseIRUnitStatus {
  if (status === "failed" || failureReason) {
    return "failed";
  }
  if (status === "revised" || lesson?.revisionId) {
    return "revised";
  }
  if (status === "pending" || !lesson) {
    return "pending";
  }
  return "ready";
}

function normalizePage(value: unknown): CourseIRPage {
  const page = isRecord(value) ? value : {};
  const grounding = isRecord(page.grounding) ? page.grounding : undefined;
  const sourceAnchorIds = stringArrayOrEmpty(page.sourceAnchorIds);
  return {
    pageId: stringOr(page.id, "unknown-page"),
    type: stringOr(page.type, "unknown"),
    title: stringOr(page.title, "Untitled page"),
    learningGoal: stringOrUndefined(page.learningGoal),
    sourceAnchorIds,
    sourceSupport: sourceSupportKind(sourceAnchorIds, grounding),
    hasVisual: isRecord(page.visualSpec),
    hasInteraction: isRecord(page.interactionSpec),
    hasAssessment: isRecord(page.assessmentSpec),
    hasFeedback: isRecord(page.feedbackSpec),
    narrativeLength: typeof page.narrative === "string" ? page.narrative.length : 0
  };
}

function sourceSupportKind(sourceAnchorIds: string[], grounding: Record<string, unknown> | undefined): CourseIRPage["sourceSupport"] {
  if (sourceAnchorIds.length > 0) {
    return "source";
  }
  if (grounding?.kind === "inferred" || grounding?.kind === "analogy") {
    return grounding.kind;
  }
  return "missing";
}

function compactSourceEvidence(
  sourceEvidence: SourceEvidenceSummary
): NonNullable<CourseIR["sourceEvidence"]> {
  return {
    status: sourceEvidence.status,
    totalLessons: sourceEvidence.totalLessons,
    totalPages: sourceEvidence.totalPages,
    supportedPages: sourceEvidence.supportedPages,
    inferredPages: sourceEvidence.inferredPages,
    unsupportedPages: sourceEvidence.unsupportedPages,
    supportRatio: sourceEvidence.supportRatio,
    unsupportedPageRefs: sourceEvidence.unsupportedPageRefs
  };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function stringArrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}
