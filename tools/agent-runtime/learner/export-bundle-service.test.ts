import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ExportBundleService } from "./export-bundle-service.js";

describe("ExportBundleService", () => {
  it("writes export manifest for a preview-ready course", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-export-"));
    const runDir = path.join(root, "runs", "agentic");
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify(
        {
          status: "preview_ready",
          runId: "agentic",
          coursePackId: "agentic",
          courseTitle: "Agentic 课程",
          lessonCount: 3,
          coursePackPath: path.join(root, "src/course-packs/agentic/coursePack.ts"),
          lessonPaths: [path.join(root, "src/lessons/agentic-overview/lesson.ts")],
          qualityReport: {
            status: "passed",
            score: 96,
            summary: "课程质量通过",
            reportPath: path.join(root, "runs", "agentic", "quality", "course-quality-report.json"),
            requiredFixCount: 0,
            optionalImprovementCount: 1,
            checks: {
              sourceEvidence: "passed",
              chineseFirst: "passed",
              pageStructure: "passed",
              interactionQuality: "passed",
              assessmentCoverage: "passed",
              transferCoverage: "passed"
            },
            lessonScores: []
          },
          publishNotes: "Generated."
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await new ExportBundleService(root).exportRun({ runId: "agentic" });

    expect(result.status).toBe("export_ready");
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as {
      courseTitle: string;
      artifactVersions: string[];
      qualityReport?: { status: string; score: number };
    };
    expect(manifest.courseTitle).toBe("Agentic 课程");
    expect(manifest.artifactVersions).toEqual([]);
    expect(result.qualityReport).toMatchObject({ status: "passed", score: 96 });
    expect(manifest.qualityReport).toMatchObject({ status: "passed", score: 96 });
  });

  it("blocks export when course quality failed unless an expert override reason is provided", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-export-failed-"));
    const runDir = path.join(root, "runs", "agentic-failed");
    await mkdir(runDir, { recursive: true });
    await writePreviewFile(runDir, root, {
      runId: "agentic-failed",
      qualityReport: {
        status: "failed",
        score: 55,
        summary: "课程质量未通过",
        reportPath: path.join(root, "runs", "agentic-failed", "quality", "course-quality-report.json"),
        requiredFixCount: 2,
        optionalImprovementCount: 1,
        issueSummary: {
          course: 1,
          unit: 0,
          lesson: 0,
          page: 1,
          errors: 2,
          warnings: 1,
          byCategory: { source_evidence: 1, missing_feedback: 1 }
        },
        topIssues: [
          {
            issueId: "quality.source-evidence.failed",
            scope: "course",
            severity: "error",
            category: "source_evidence",
            reason: "source support is missing",
            requiredFix: "Add source anchors."
          }
        ],
        checks: {
          sourceEvidence: "failed",
          chineseFirst: "passed",
          pageStructure: "passed",
          interactionQuality: "passed",
          assessmentCoverage: "failed",
          transferCoverage: "passed"
        },
        lessonScores: []
      }
    });

    const service = new ExportBundleService(root);

    await expect(service.exportRun({ runId: "agentic-failed" })).rejects.toThrow(/quality report failed/i);

    const result = await service.exportRun({
      runId: "agentic-failed",
      expertOverrideReason: "Maintainer export for debugging failed quality artifacts."
    });
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as {
      expertOverrideReason?: string;
    };

    expect(result.status).toBe("export_ready");
    expect(manifest.expertOverrideReason).toBe("Maintainer export for debugging failed quality artifacts.");
  });
});

async function writePreviewFile(
  runDir: string,
  root: string,
  input: {
    runId: string;
    qualityReport: Record<string, unknown>;
  }
): Promise<void> {
  await writeFile(
    path.join(runDir, "learning-preview.json"),
    JSON.stringify(
      {
        status: "preview_ready",
        runId: input.runId,
        coursePackId: input.runId,
        courseTitle: "Agentic 课程",
        lessonCount: 3,
        coursePackPath: path.join(root, `src/course-packs/${input.runId}/coursePack.ts`),
        lessonPaths: [path.join(root, `src/lessons/${input.runId}-overview/lesson.ts`)],
        qualityReport: input.qualityReport,
        publishNotes: "Generated."
      },
      null,
      2
    ),
    "utf8"
  );
}
