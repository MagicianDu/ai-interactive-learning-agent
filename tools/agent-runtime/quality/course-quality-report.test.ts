import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { publishableLessonFixture } from "./test-fixtures.js";
import { buildCourseQualityReport, toCompactCourseQualityReport, writeCourseQualityReport } from "./course-quality-report.js";

describe("course-quality-report", () => {
  test("builds a passed compact quality report for a complete Chinese course", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "course-quality-"));
    const report = buildCourseQualityReport({
      runId: "quality-run",
      coursePackId: "quality-run",
      lessons: [publishableLessonFixture({ id: "quality-overview", targetPageCount: 8 })]
    });
    const reportPath = await writeCourseQualityReport(root, "quality-run", report);
    const compact = toCompactCourseQualityReport(report, reportPath);

    expect(report).toMatchObject({
      status: "passed",
      score: 100,
      checks: {
        chineseFirst: "passed",
        pageStructure: "passed",
        interactionQuality: "passed",
        assessmentCoverage: "passed",
        transferCoverage: "passed"
      }
    });
    expect(compact).toMatchObject({
      status: "passed",
      score: 100,
      requiredFixCount: 0,
      reportPath
    });
    await expect(readFile(reportPath, "utf8")).resolves.toContain("\"coursePackId\": \"quality-run\"");
  });

  test("fails when source evidence is missing from a source-backed course", () => {
    const report = buildCourseQualityReport({
      runId: "quality-source",
      coursePackId: "quality-source",
      lessons: [publishableLessonFixture({ id: "quality-source-overview", targetPageCount: 8 })],
      sourceEvidence: {
        status: "failed",
        totalLessons: 1,
        totalPages: 8,
        supportedPages: 0,
        inferredPages: 0,
        unsupportedPages: 8,
        supportRatio: 0,
        unsupportedPageRefs: ["quality-source-overview:p1"],
        pageSupport: []
      }
    });

    expect(report.status).toBe("failed");
    expect(report.checks.sourceEvidence).toBe("failed");
    expect(report.requiredFixes.some((fix) => fix.includes("source-evidence"))).toBe(true);
  });
});
