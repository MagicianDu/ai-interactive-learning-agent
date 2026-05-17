import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { CourseProductionBenchmarkService } from "./course-production-benchmark-service.js";

describe("CourseProductionBenchmarkService", () => {
  test("passes when a source has two production runs above the quality gate", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-benchmark-"));
    await writeRunEvidence(root, "agentic-run-a", { score: 92 });
    await writeRunEvidence(root, "agentic-run-b", { score: 94 });

    const report = await new CourseProductionBenchmarkService(root).evaluate({
      targets: [{ sourceId: "agentic-design-patterns", runIds: ["agentic-run-a", "agentic-run-b"] }]
    });

    expect(report).toMatchObject({
      status: "passed",
      summary: {
        targetCount: 1,
        runCount: 2,
        passedRunCount: 2,
        failedRunCount: 0,
        warningTargetCount: 0
      },
      targets: [
        {
          sourceId: "agentic-design-patterns",
          status: "passed",
          repeatCount: 2,
          minScore: 90,
          minReviewRounds: 3,
          blockingReasons: []
        }
      ]
    });
  });

  test("fails when a run is below the 90 plus quality target", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-benchmark-"));
    await writeRunEvidence(root, "weak-run-a", { score: 88 });
    await writeRunEvidence(root, "weak-run-b", { score: 91 });

    const report = await new CourseProductionBenchmarkService(root).evaluate({
      targets: [{ sourceId: "weak-source", runIds: ["weak-run-a", "weak-run-b"] }]
    });

    expect(report.status).toBe("failed");
    expect(report.targets[0]).toMatchObject({
      status: "failed",
      blockingReasons: [expect.stringContaining("weak-run-a quality score 88 is below 90")]
    });
  });

  test("warns when a source has only one production repeat", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-benchmark-"));
    await writeRunEvidence(root, "single-run", { score: 93 });

    const report = await new CourseProductionBenchmarkService(root).evaluate({
      targets: [{ sourceId: "single-source", runIds: ["single-run"] }]
    });

    expect(report).toMatchObject({
      status: "warning",
      summary: {
        warningTargetCount: 1
      },
      targets: [
        {
          sourceId: "single-source",
          status: "warning",
          repeatCount: 1,
          warnings: [expect.stringContaining("needs at least 2 production repeats")]
        }
      ]
    });
  });
});

type RunEvidenceOptions = {
  score: number;
  reviewRounds?: number;
  reviewVerdict?: string;
  imagegenComplete?: boolean;
  layoutStatus?: string;
};

async function writeRunEvidence(root: string, runId: string, options: RunEvidenceOptions): Promise<void> {
  const runRoot = path.join(root, "runs", runId);
  await mkdir(path.join(runRoot, "quality", "content-review"), { recursive: true });
  await mkdir(path.join(runRoot, "quality", "imagegen"), { recursive: true });
  await mkdir(path.join(runRoot, "quality", "layout-smoke"), { recursive: true });
  await writeJson(path.join(runRoot, "quality", "course-quality-report.json"), {
    status: options.score >= 90 ? "passed" : "warning",
    score: options.score
  });
  const reviewRounds = options.reviewRounds ?? 3;
  await writeJson(path.join(runRoot, "quality", "content-review", "content-review-state.json"), {
    completedRounds: reviewRounds,
    latestVerdict: options.reviewVerdict ?? "pass",
    latestScore: options.score,
    reports: Array.from({ length: reviewRounds }, (_, index) => ({
      round: index + 1,
      concreteIssueCount: Math.max(1, 4 - index)
    }))
  });
  await writeJson(path.join(runRoot, "quality", "imagegen", "imagegen-batch-state.json"), {
    runId,
    totalItems: 2,
    items: [
      { lessonId: "lesson-a", pageId: "p1", status: options.imagegenComplete === false ? "pending" : "succeeded" },
      { lessonId: "lesson-a", pageId: "p2", status: "succeeded" }
    ]
  });
  await writeJson(path.join(runRoot, "quality", "layout-smoke", "layout-smoke-report.json"), {
    status: options.layoutStatus ?? "passed",
    issues: []
  });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
