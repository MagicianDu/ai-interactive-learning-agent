import { describe, expect, test } from "vitest";

import { buildSourceRegressionSeedSummary, assertNoSemanticRegressionFailures } from "./beta-seed-check.js";

describe("beta seed check source regression summary", () => {
  test("summarizes semantic source regression states for the final seed report", () => {
    const summary = buildSourceRegressionSeedSummary({
      summary: {
        total: 4,
        ready: 4,
        groundedReady: 4,
        missingLocalSources: 0
      },
      samples: [
        semanticSample("book", "passed"),
        semanticSample("paper", "passed"),
        semanticSample("patent", "warning"),
        semanticSample("blog", "failed")
      ]
    });

    expect(summary).toEqual({
      total: 4,
      passed: 2,
      warnings: 1,
      failed: 1
    });
  });

  test("fails the seed check when any source regression item is semantic failed", () => {
    expect(() =>
      assertNoSemanticRegressionFailures({
        total: 2,
        passed: 1,
        warnings: 0,
        failed: 1
      })
    ).toThrow("source regression semantic checks failed");
  });
});

function semanticSample(
  id: string,
  semanticStatus: "passed" | "warning" | "failed"
) {
  return {
    id,
    runId: `regression-${id}`,
    title: id,
    sourceKind: id === "blog" ? ("blog" as const) : ("book" as const),
    sourceType: "file" as const,
    sourcePath: "/tmp/source.pdf",
    sourceAvailable: true,
    status: "project_ready" as const,
    groundedCourseStatus: "preview_ready" as const,
    generatedUnitCount: semanticStatus === "failed" ? 1 : 3,
    semanticStatus,
    missingConceptLabels: semanticStatus === "failed" ? ["核心机制"] : [],
    sourceAnchorCount: 3,
    sourceIngestWarningCount: 0,
    strategy: "overview_plus_topic",
    unitPages: 8,
    acceptanceChecks: [],
    semanticExpectations: {
      expectedConceptLabels: ["核心机制"],
      matchedConceptLabels: semanticStatus === "failed" ? [] : ["核心机制"],
      missingConceptLabels: semanticStatus === "failed" ? ["核心机制"] : []
    }
  };
}
