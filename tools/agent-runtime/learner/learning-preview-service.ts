import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CompactCourseQualityReport } from "../quality/course-quality-report.js";
import type { PublishedRevisionHistoryItem } from "./learning-course-publisher.js";

export type LearningPreviewResult =
  | {
      status: "preview_ready";
      runId: string;
      preview: {
        devCommand: "npm run dev";
        localUrl: string;
        coursePackId: string;
        courseTitle: string;
        lessonCount: number;
        previewManifestPath: string;
        qualityReport?: CompactCourseQualityReport;
        revisionHistory?: PublishedRevisionHistoryItem[];
      };
    }
  | {
      status: "not_published";
      runId: string;
    };

export class LearningPreviewService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async getPreview(runId: string): Promise<LearningPreviewResult> {
    const manifestPath = path.join(this.workspaceRoot, "runs", runId, "learning-preview.json");
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
    } catch (error) {
      if (isFileNotFound(error)) {
        return { status: "not_published", runId };
      }
      throw error;
    }

    if (!isRecord(manifest) || !isRecord(manifest.preview)) {
      return { status: "not_published", runId };
    }
    const nestedPreview = manifest.preview;

    return {
      status: "preview_ready",
      runId,
      preview: {
        devCommand: "npm run dev",
        localUrl: stringOr(nestedPreview.localUrl, `http://127.0.0.1:5173/#/preview/${runId}`),
        coursePackId: stringOr(manifest.coursePackId, runId),
        courseTitle: stringOr(manifest.courseTitle, "未命名课程包"),
        lessonCount: numberOr(manifest.lessonCount, 0),
        previewManifestPath: stringOr(manifest.previewManifestPath, path.join(this.workspaceRoot, "runs", runId, "preview", "manifest.json")),
        ...(isCompactQualityReport(manifest.qualityReport) ? { qualityReport: manifest.qualityReport } : {}),
        revisionHistory: Array.isArray(manifest.revisionHistory) ? manifest.revisionHistory.filter(isPublishedRevisionHistoryItem) : []
      }
    };
  }
}

function isCompactQualityReport(value: unknown): value is CompactCourseQualityReport {
  return isRecord(value) && typeof value.status === "string" && typeof value.score === "number" && typeof value.summary === "string";
}

function isPublishedRevisionHistoryItem(value: unknown): value is PublishedRevisionHistoryItem {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    typeof value.revisionId === "string" &&
    isRevisionScope(value.scope) &&
    typeof value.summary === "string" &&
    isStringArray(value.changedLessonIds) &&
    Array.isArray(value.changedPages) &&
    value.changedPages.every(isRevisionChangedPage) &&
    isQualityStatus(value.qualityStatus) &&
    typeof value.createdAt === "string"
  );
}

function isRevisionChangedPage(value: unknown): value is PublishedRevisionHistoryItem["changedPages"][number] {
  return (
    isRecord(value) &&
    typeof value.lessonId === "string" &&
    typeof value.pageId === "string" &&
    typeof value.pageNumber === "number"
  );
}

function isRevisionScope(value: unknown): value is PublishedRevisionHistoryItem["scope"] {
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

function isQualityStatus(value: unknown): value is PublishedRevisionHistoryItem["qualityStatus"] {
  return value === "passed" || value === "warning" || value === "failed";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
