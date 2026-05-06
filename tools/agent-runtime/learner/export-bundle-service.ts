import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import type { CompactCourseQualityReport } from "../quality/course-quality-report.js";

export type ExportBundleInput = {
  runId: string;
  expertOverrideReason?: string;
};

export type ExportBundleResult = {
  status: "export_ready";
  runId: string;
  exportDir: string;
  manifestPath: string;
  qualityReport?: CompactCourseQualityReport;
};

export class ExportBundleService {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  async exportRun(input: ExportBundleInput): Promise<ExportBundleResult> {
    const previewPath = path.join(this.workspaceRoot, "runs", input.runId, "learning-preview.json");
    const preview = JSON.parse(await readFile(previewPath, "utf8").catch((error: unknown) => {
      if (isFileNotFound(error)) {
        throw new AgentRuntimeError("Cannot export before a learning preview is ready", "MISSING_ARTIFACT");
      }
      throw error;
    })) as {
      coursePackId: string;
      courseTitle: string;
      lessonCount: number;
      coursePackPath?: string;
      lessonPaths?: string[];
      publishNotes?: string;
      qualityReport?: CompactCourseQualityReport;
    };

    if (preview.qualityReport?.status === "failed" && !hasExpertOverrideReason(input.expertOverrideReason)) {
      throw new AgentRuntimeError(
        "Cannot export because the course quality report failed. Provide expertOverrideReason only for maintainer/debug exports.",
        "INVALID_LESSON"
      );
    }

    const exportDir = path.join(this.workspaceRoot, "runs", input.runId, "exports", "static-course");
    await mkdir(exportDir, { recursive: true });
    const manifest = {
      schemaVersion: 1,
      runId: input.runId,
      coursePackId: preview.coursePackId,
      courseTitle: preview.courseTitle,
      lessonCount: preview.lessonCount,
      coursePackPath: preview.coursePackPath,
      lessonPaths: preview.lessonPaths ?? [],
      qualityReport: preview.qualityReport,
      publishNotes: preview.publishNotes,
      ...(hasExpertOverrideReason(input.expertOverrideReason) ? { expertOverrideReason: input.expertOverrideReason.trim() } : {}),
      artifactVersions: [],
      exportedAt: new Date().toISOString(),
      instructions: ["在项目根目录运行 npm run build。", "用 npm run preview 或静态服务器打开 dist。"]
    };
    const manifestPath = path.join(exportDir, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return {
      status: "export_ready",
      runId: input.runId,
      exportDir,
      manifestPath,
      ...(preview.qualityReport ? { qualityReport: preview.qualityReport } : {})
    };
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function hasExpertOverrideReason(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
