import type { RunConfig } from "../types.js";
import { isRecord, isStringArray } from "./validation-result.js";

export type SourceEvidenceStatus = "passed" | "warning" | "failed";
export type PageSourceSupport = "supported" | "inferred" | "analogy" | "unsupported";

export type PageSourceEvidence = {
  lessonId: string;
  pageId: string;
  sourceSupport: PageSourceSupport;
  sourceAnchorIds: string[];
};

export type SourceEvidenceSummary = {
  status: SourceEvidenceStatus;
  totalLessons: number;
  totalPages: number;
  supportedPages: number;
  inferredPages: number;
  unsupportedPages: number;
  supportRatio: number;
  unsupportedPageRefs: string[];
  pageSupport: PageSourceEvidence[];
};

export function analyzeSourceEvidence(lessons: unknown[], config: RunConfig): SourceEvidenceSummary {
  const sourceBacked = config.sources.some((source) => source.type !== "topic") || config.selectedUnit !== undefined;
  const pageSupport = lessons.flatMap((lesson, lessonIndex) => analyzeLessonPages(lesson, lessonIndex));
  const supportedPages = pageSupport.filter((page) => page.sourceSupport === "supported").length;
  const inferredPages = pageSupport.filter((page) => page.sourceSupport === "inferred" || page.sourceSupport === "analogy").length;
  const unsupportedPageRefs = pageSupport
    .filter((page) => page.sourceSupport === "unsupported")
    .map((page) => `${page.lessonId}:${page.pageId}`);
  const totalPages = pageSupport.length;

  return {
    status: resolveSourceEvidenceStatus({
      sourceBacked,
      totalPages,
      supportedPages,
      inferredPages,
      unsupportedPages: unsupportedPageRefs.length
    }),
    totalLessons: lessons.length,
    totalPages,
    supportedPages,
    inferredPages,
    unsupportedPages: unsupportedPageRefs.length,
    supportRatio: totalPages > 0 ? supportedPages / totalPages : 1,
    unsupportedPageRefs,
    pageSupport
  };
}

export function summarizeSingleLessonSourceEvidence(lesson: unknown, config: RunConfig): SourceEvidenceSummary {
  return analyzeSourceEvidence([lesson], config);
}

function analyzeLessonPages(lesson: unknown, lessonIndex: number): PageSourceEvidence[] {
  if (!isRecord(lesson)) {
    return [];
  }

  const lessonId = typeof lesson.id === "string" && lesson.id.trim() ? lesson.id : `lesson-${lessonIndex + 1}`;
  const pages = Array.isArray(lesson.pages) ? lesson.pages.filter(isRecord) : [];
  return pages.map((page, pageIndex) => {
    const pageId = typeof page.id === "string" && page.id.trim() ? page.id : `page-${pageIndex + 1}`;
    const sourceAnchorIds = isStringArray(page.sourceAnchorIds) ? page.sourceAnchorIds : [];

    return {
      lessonId,
      pageId,
      sourceAnchorIds,
      sourceSupport: classifyPageSourceSupport(page, sourceAnchorIds)
    };
  });
}

function classifyPageSourceSupport(page: Record<string, unknown>, sourceAnchorIds: string[]): PageSourceSupport {
  if (sourceAnchorIds.length > 0) {
    return "supported";
  }

  const grounding = page.grounding;
  if (!isRecord(grounding)) {
    return "unsupported";
  }

  if (grounding.kind === "inferred") {
    return "inferred";
  }

  if (grounding.kind === "analogy") {
    return "analogy";
  }

  return "unsupported";
}

function resolveSourceEvidenceStatus(input: {
  sourceBacked: boolean;
  totalPages: number;
  supportedPages: number;
  inferredPages: number;
  unsupportedPages: number;
}): SourceEvidenceStatus {
  if (!input.sourceBacked) {
    return "passed";
  }

  if (input.totalPages === 0 || input.unsupportedPages > 0 || input.supportedPages === 0) {
    return "failed";
  }

  if (input.inferredPages > input.supportedPages) {
    return "warning";
  }

  return "passed";
}
