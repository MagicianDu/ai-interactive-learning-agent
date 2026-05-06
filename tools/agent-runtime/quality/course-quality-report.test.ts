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

  test("returns structured issue objects that support targeted revision", () => {
    const lesson = publishableLessonFixture({ id: "quality-issues-overview", targetPageCount: 8 });
    lesson.pages[0] = {
      ...lesson.pages[0],
      narrative: "哈希表查询过程需要同时理解数组桶、哈希函数、冲突链、负载因子、扩容阈值和查询路径。".repeat(80)
    };
    lesson.pages[5] = {
      ...lesson.pages[5],
      feedbackSpec: undefined
    };

    const report = buildCourseQualityReport({
      runId: "quality-issues",
      coursePackId: "quality-issues",
      lessons: [lesson],
      sourceEvidence: {
        status: "failed",
        totalLessons: 1,
        totalPages: 8,
        supportedPages: 0,
        inferredPages: 0,
        unsupportedPages: 8,
        supportRatio: 0,
        unsupportedPageRefs: ["quality-issues-overview:p1"],
        pageSupport: []
      }
    });
    const compact = toCompactCourseQualityReport(report, "/tmp/course-quality-report.json");

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "quality.source-evidence.failed",
          scope: "course",
          severity: "error",
          category: "source_evidence",
          requiredFix: expect.stringContaining("source")
        }),
        expect.objectContaining({
          issueId: "quality.page.dense",
          scope: "page",
          lessonId: "quality-issues-overview",
          pageId: "p1",
          category: "dense_page"
        }),
        expect.objectContaining({
          issueId: "quality.page.feedback-missing",
          scope: "page",
          lessonId: "quality-issues-overview",
          pageId: "p6",
          category: "missing_feedback"
        })
      ])
    );
    expect(report.issueSummary).toMatchObject({
      course: 1,
      page: 2,
      errors: 2,
      warnings: 1
    });
    expect(compact.issueSummary).toMatchObject({ course: 1, page: 2 });
    expect(compact.topIssues[0]).toMatchObject({
      issueId: "quality.source-evidence.failed",
      requiredFix: expect.stringContaining("source")
    });
  });
});
