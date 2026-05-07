import { describe, expect, test } from "vitest";

import type { RealSourceRegressionResult } from "./real-source-regression.js";
import {
  buildRealSourceQualityBenchmarkReport,
  realSourceBenchmarkQualityDimensions,
  realSourceBenchmarkSourceKinds
} from "./real-source-quality-benchmark.js";

describe("real source quality benchmark report", () => {
  test("summarizes automated and tracked-only source-kind coverage", () => {
    const regression: RealSourceRegressionResult = {
      summary: {
        total: 2,
        ready: 2,
        groundedReady: 2,
        missingLocalSources: 0
      },
      samples: [
        {
          id: "book-smoke",
          runId: "regression-book-smoke",
          title: "Book Smoke",
          sourceKind: "book",
          sourceType: "file",
          sourcePath: "/tmp/book.md",
          sourceAvailable: true,
          status: "project_ready",
          groundedCourseStatus: "preview_ready",
          sourceAnchorCount: 12,
          sourceIngestWarningCount: 0,
          strategy: "chapter_guided",
          selectedChapters: ["第 1 章"],
          unitPages: 8,
          acceptanceChecks: ["chapter mapping", "anchors retained", "overview first"],
          qualityFocus: [
            "source_semantics",
            "source_synthesis",
            "academic_depth",
            "learner_action",
            "feedback_mechanism",
            "visual_purpose",
            "transfer"
          ],
          generatedUnitCount: 3,
          semanticStatus: "passed",
          sourceEvidenceStatus: "passed",
          sourceGraphStatus: "passed",
          missingConceptLabels: [],
          semanticExpectations: {
            expectedConceptLabels: ["全局地图"],
            matchedConceptLabels: ["全局地图"],
            missingConceptLabels: []
          }
        },
        {
          id: "blog-smoke",
          runId: "regression-blog-smoke",
          title: "Blog Smoke",
          sourceKind: "blog",
          sourceType: "url",
          sourcePath: "https://example.com/blog",
          sourceAvailable: true,
          status: "project_ready",
          groundedCourseStatus: "preview_ready",
          sourceAnchorCount: 6,
          sourceIngestWarningCount: 1,
          strategy: "task_guided",
          unitPages: 8,
          acceptanceChecks: ["task flow", "anchors retained", "caveats"],
          qualityFocus: ["source_semantics", "source_synthesis", "learner_action", "feedback_mechanism", "transfer"],
          generatedUnitCount: 3,
          semanticStatus: "warning",
          sourceEvidenceStatus: "passed",
          sourceGraphStatus: "passed",
          missingConceptLabels: [],
          semanticExpectations: {
            expectedConceptLabels: ["实践问题"],
            matchedConceptLabels: ["实践问题"],
            missingConceptLabels: []
          }
        }
      ]
    };

    const report = buildRealSourceQualityBenchmarkReport(regression);

    expect(realSourceBenchmarkSourceKinds).toEqual(["book", "paper", "patent", "blog", "documentation", "notes", "topic-only"]);
    expect(realSourceBenchmarkQualityDimensions).toEqual([
      "source semantics",
      "source synthesis",
      "academic depth",
      "learner action",
      "feedback mechanism",
      "visual purpose",
      "transfer"
    ]);
    expect(report.status).toBe("warning");
    expect(report.summary).toMatchObject({
      sourceKindTotal: 7,
      automatedSourceKindCount: 2,
      trackedOnlySourceKindCount: 5,
      totalSamples: 2,
      readySamples: 2,
      groundedReadySamples: 2,
      warningSampleCount: 1,
      failedSampleCount: 0
    });
    expect(report.sourceKinds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: "book",
          coverage: "automated",
          status: "passed",
          sampleIds: ["book-smoke"],
          missingDimensions: []
        }),
        expect.objectContaining({
          sourceKind: "blog",
          coverage: "automated",
          status: "warning",
          sampleIds: ["blog-smoke"],
          missingDimensions: ["academic depth", "visual purpose"]
        }),
        expect.objectContaining({
          sourceKind: "documentation",
          coverage: "tracked_only",
          status: "tracked",
          sampleIds: []
        })
      ])
    );
    expect(report.nextActions).toEqual(
      expect.arrayContaining([
        "Add automated regression samples for paper, patent, documentation, notes, topic-only.",
        "Raise blog benchmark coverage for: academic depth, visual purpose."
      ])
    );
  });

  test("fails when an automated source sample has failed semantic or grounding status", () => {
    const regression: RealSourceRegressionResult = {
      summary: {
        total: 1,
        ready: 1,
        groundedReady: 0,
        missingLocalSources: 0
      },
      samples: [
        {
          id: "paper-bad",
          runId: "regression-paper-bad",
          title: "Paper Bad",
          sourceKind: "paper",
          sourceType: "file",
          sourcePath: "/tmp/paper.md",
          sourceAvailable: true,
          status: "project_ready",
          groundedCourseStatus: "revision_required",
          strategy: "topic_guided",
          unitPages: 8,
          acceptanceChecks: ["method boundary", "evidence"],
          qualityFocus: ["source_semantics", "source_synthesis", "academic_depth"],
          generatedUnitCount: 1,
          semanticStatus: "failed",
          sourceEvidenceStatus: "failed",
          sourceGraphStatus: "warning",
          missingConceptLabels: ["方法结构"],
          semanticExpectations: {
            expectedConceptLabels: ["研究问题", "方法结构"],
            matchedConceptLabels: ["研究问题"],
            missingConceptLabels: ["方法结构"]
          }
        }
      ]
    };

    const report = buildRealSourceQualityBenchmarkReport(regression);

    expect(report.status).toBe("failed");
    expect(report.summary.failedSampleCount).toBe(1);
    expect(report.sourceKinds.find((sourceKind) => sourceKind.sourceKind === "paper")).toMatchObject({
      status: "failed",
      failingSampleIds: ["paper-bad"]
    });
    expect(report.nextActions).toEqual(expect.arrayContaining(["Fix failed benchmark samples: paper-bad."]));
  });
});
