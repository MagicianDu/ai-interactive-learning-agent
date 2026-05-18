import type { CoursePackRegistryEntry } from "../course-packs/registry";
import type { LessonRegistryEntry } from "../lessons/registry";
import type { CoursePack } from "../schemas/course-pack.schema";
import type { Lesson } from "../schemas/lesson.schema";
import type { RevisionHistoryItem } from "./learning-progress";

type PreviewManifest = {
  schemaVersion: number;
  runId: string;
  coursePackId: string;
  courseTitle: string;
  coursePackPath: string;
  lessonPaths: string[];
  publishNotes?: unknown;
  qualityReport?: unknown;
  revisionHistory?: unknown;
};

export type GeneratedPreviewQualityReport = {
  status: "passed" | "warning" | "failed";
  score: number;
  summary: string;
  [key: string]: unknown;
};

export type GeneratedPreviewLoadResult = {
  previewRunId: string;
  coursePackEntry: CoursePackRegistryEntry;
  lessonEntries: LessonRegistryEntry[];
  publishNotes?: string;
  qualityReport?: GeneratedPreviewQualityReport;
  revisionHistory: RevisionHistoryItem[];
};

type PreviewIndex = {
  previews?: Array<{
    runId?: unknown;
    courseTitle?: unknown;
    updatedAt?: unknown;
  }>;
};

export async function fetchGeneratedPreview(runId: string): Promise<GeneratedPreviewLoadResult> {
  const manifest = await fetchJson<PreviewManifest>(previewAssetUrl(runId, "manifest.json"));
  const coursePack = await fetchJson<CoursePack>(previewAssetUrl(runId, manifest.coursePackPath));
  const lessons = await Promise.all(manifest.lessonPaths.map((lessonPath) => fetchJson<Lesson>(previewAssetUrl(runId, lessonPath))));
  const publishNotes = optionalString(manifest.publishNotes);

  return {
    previewRunId: manifest.runId,
    coursePackEntry: {
      id: coursePack.id,
      label: coursePack.title,
      coursePack,
      modulePath: `runs/${runId}/preview/${manifest.coursePackPath}`,
      projectStatus: "preview-ready",
      sourceKind: coursePack.sourceKind,
      strategy: coursePack.strategy,
      unitCount: coursePack.units.length
    },
    lessonEntries: lessons.map((lesson, index) => ({
      id: lesson.id,
      label: lesson.title,
      lesson,
      modulePath: `runs/${runId}/preview/${manifest.lessonPaths[index] ?? lesson.id}`
    })),
    ...(publishNotes ? { publishNotes } : {}),
    ...(isPreviewQualityReport(manifest.qualityReport) ? { qualityReport: manifest.qualityReport } : {}),
    revisionHistory: Array.isArray(manifest.revisionHistory) ? manifest.revisionHistory.filter(isRevisionHistoryItem) : []
  };
}

export async function fetchLatestGeneratedPreviewRunId(): Promise<string | undefined> {
  try {
    const index = await fetchJson<PreviewIndex>("/__learning-preview/index.json");
    return index.previews?.map((preview) => preview.runId).find(isPreviewRunId);
  } catch {
    return undefined;
  }
}

function previewAssetUrl(runId: string, relativePath: string): string {
  if (!isPreviewRunId(runId)) {
    throw new Error("preview runId is invalid");
  }
  const normalizedPath = normalizePreviewPath(relativePath);
  return `/__learning-preview/${runId}/${normalizedPath}`;
}

function normalizePreviewPath(relativePath: string): string {
  if (
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.includes("..") ||
    relativePath.includes("\\") ||
    !relativePath.endsWith(".json")
  ) {
    throw new Error(`preview path is invalid: ${relativePath}`);
  }
  return relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to load generated preview: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
}

function isPreviewQualityReport(value: unknown): value is GeneratedPreviewQualityReport {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    isPreviewQualityStatus((value as Record<string, unknown>).status) &&
    typeof (value as Record<string, unknown>).score === "number" &&
    typeof (value as Record<string, unknown>).summary === "string"
  );
}

function isPreviewQualityStatus(value: unknown): value is GeneratedPreviewQualityReport["status"] {
  return value === "passed" || value === "warning" || value === "failed";
}

function isPreviewRunId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,63}$/u.test(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRevisionHistoryItem(value: unknown): value is RevisionHistoryItem {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    typeof value.revisionId === "string" &&
    isRevisionScope(value.scope) &&
    typeof value.summary === "string" &&
    Array.isArray(value.changedLessonIds) &&
    value.changedLessonIds.every((item) => typeof item === "string") &&
    Array.isArray(value.changedPages) &&
    value.changedPages.every(isRevisionChangedPage) &&
    isQualityStatus(value.qualityStatus) &&
    typeof value.createdAt === "string"
  );
}

function isRevisionChangedPage(value: unknown): value is RevisionHistoryItem["changedPages"][number] {
  return (
    isRecord(value) &&
    typeof value.lessonId === "string" &&
    typeof value.pageId === "string" &&
    typeof value.pageNumber === "number"
  );
}

function isRevisionScope(value: unknown): value is RevisionHistoryItem["scope"] {
  return (
    value === "course" ||
    value === "unit" ||
    value === "page" ||
    value === "interaction" ||
    value === "assessment" ||
    value === "source" ||
    value === "style"
  );
}

function isQualityStatus(value: unknown): value is RevisionHistoryItem["qualityStatus"] {
  return value === "passed" || value === "warning" || value === "failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
