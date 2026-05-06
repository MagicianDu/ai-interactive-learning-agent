import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CompactCourseQualityReport } from "../quality/course-quality-report.js";

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
        ...(isCompactQualityReport(manifest.qualityReport) ? { qualityReport: manifest.qualityReport } : {})
      }
    };
  }
}

function isCompactQualityReport(value: unknown): value is CompactCourseQualityReport {
  return isRecord(value) && typeof value.status === "string" && typeof value.score === "number" && typeof value.summary === "string";
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
