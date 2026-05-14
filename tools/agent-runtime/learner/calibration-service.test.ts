import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { CalibrationService, type CalibrationResult } from "./calibration-service.js";

describe("CalibrationService", () => {
  test("returns calibration_complete when a preview already meets stop criteria", async () => {
    const root = await fixtureRoot("complete-course", qualityReport({ status: "passed", score: 94, issues: [] }));

    const result = await new CalibrationService(root).calibrate({ runId: "complete-course" });

    expect(result).toMatchObject({
      status: "calibration_complete",
      runId: "complete-course",
      round: 0,
      maxRounds: 3,
      stopReason: "quality already meets calibration stop criteria",
      previewUrl: "http://127.0.0.1:5173/#/preview/complete-course"
    });
  });

  test("creates a source calibration brief from source synthesis warnings", async () => {
    const root = await fixtureRoot(
      "weak-source-course",
      qualityReport({
        status: "warning",
        score: 85,
        issues: [
          {
            issueId: "quality.page.source-synthesis-weak",
            scope: "page",
            severity: "warning",
            category: "source_evidence",
            lessonId: "lesson-a",
            pageId: "page-03",
            reason: "page has source anchors but does not synthesize source-specific terms",
            requiredFix: "Use the source anchor to teach a specific source term."
          }
        ]
      })
    );

    const result = await new CalibrationService(root).calibrate({ runId: "weak-source-course" });

    const revision = expectRevisionRequired(result);
    expect(revision.round).toBe(1);
    expect(revision.calibrationKind).toBe("source");
    expect(revision.revisionBriefPath).toContain("round-001-source.json");
    expect(revision.codexInstruction).toContain("本轮目标：source calibration");
    expect(revision.codexInstruction).toContain("lesson-a/page-03");
  });

  test("creates a structure calibration brief for repeated page-title issues", async () => {
    const root = await fixtureRoot(
      "structure-course",
      qualityReport({
        status: "warning",
        score: 88,
        issues: [
          {
            issueId: "quality.page.repeated-title",
            scope: "page",
            severity: "warning",
            category: "page_structure",
            lessonId: "lesson-a",
            pageId: "page-02",
            reason: "page title repeats a page role",
            requiredFix: "Use learner-facing proposition titles."
          }
        ]
      })
    );

    const result = await new CalibrationService(root).calibrate({ runId: "structure-course" });

    const revision = expectRevisionRequired(result);
    expect(revision.calibrationKind).toBe("structure");
    expect(revision.codexInstruction).toContain("本轮目标：structure calibration");
  });

  test("stops when maxRounds is reached", async () => {
    const root = await fixtureRoot("stopped-course", qualityReport({ status: "warning", score: 80, issues: [] }));

    const result = await new CalibrationService(root).calibrate({ runId: "stopped-course", maxRounds: 0 });

    expect(result).toMatchObject({
      status: "calibration_stopped",
      runId: "stopped-course",
      stopReason: "maxRounds reached before another calibration round"
    });
  });
});

async function fixtureRoot(runId: string, report: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), `calibration-${runId}-`));
  const runDir = path.join(root, "runs", runId);
  await mkdir(path.join(runDir, "quality"), { recursive: true });
  await mkdir(path.join(runDir, "preview", "lessons"), { recursive: true });
  await writeFile(path.join(runDir, "quality", "course-quality-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(runDir, "learning-preview.json"),
    `${JSON.stringify(
      {
        preview: { localUrl: `http://127.0.0.1:5173/#/preview/${runId}` },
        coursePackPath: "preview/course-pack.json",
        lessonPaths: ["preview/lessons/lesson-a.json"]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return root;
}

function qualityReport(input: { status: string; score: number; issues: Record<string, unknown>[] }): Record<string, unknown> {
  return {
    status: input.status,
    score: input.score,
    summary: "fixture quality report",
    requiredFixCount: input.issues.filter((issue) => issue.severity === "error").length,
    optionalImprovementCount: input.issues.filter((issue) => issue.severity !== "error").length,
    issueSummary: {
      errors: input.issues.filter((issue) => issue.severity === "error").length,
      warnings: input.issues.filter((issue) => issue.severity !== "error").length
    },
    issues: input.issues,
    topIssues: input.issues
  };
}

function expectRevisionRequired(result: CalibrationResult): Extract<CalibrationResult, { status: "revision_required" }> {
  expect(result.status).toBe("revision_required");
  if (result.status !== "revision_required") {
    throw new Error(`expected revision_required, got ${result.status}`);
  }
  return result;
}
