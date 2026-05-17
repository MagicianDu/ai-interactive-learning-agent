import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ContentReviewLoopService } from "./content-review-loop-service.js";

describe("ContentReviewLoopService", () => {
  test("requires content review before imagegen when no review state exists", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "content-review-loop-"));
    await writePublishedCourse(root, "review-loop");

    const result = await new ContentReviewLoopService(root).evaluate({
      runId: "review-loop",
      maxRounds: 3,
      minQualityScore: 90
    });

    expect(result).toMatchObject({
      status: "review_required",
      nextReviewRound: 1
    });
    if (result.status !== "review_required") {
      throw new Error("expected review_required");
    }
    expect(result.codexInstruction).toContain("content-review-agent");
  });

  test("blocks imagegen when round reports are vague even after three rounds", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "content-review-loop-"));
    await writePublishedCourse(root, "review-vague");
    await writeReviewState(root, "review-vague", {
      completedRounds: 3,
      latestVerdict: "pass",
      latestScore: 92,
      reports: [
        { round: 1, concreteIssueCount: 0 },
        { round: 2, concreteIssueCount: 0 },
        { round: 3, concreteIssueCount: 0 }
      ]
    });

    const result = await new ContentReviewLoopService(root).evaluate({
      runId: "review-vague",
      maxRounds: 3,
      minQualityScore: 90
    });

    expect(result).toMatchObject({
      status: "revision_required",
      blockingReason: "review_reports_not_concrete"
    });
  });

  test("allows imagegen after three concrete rounds and passing quality score", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "content-review-loop-"));
    await writePublishedCourse(root, "review-pass");
    await writeReviewState(root, "review-pass", {
      completedRounds: 3,
      latestVerdict: "pass",
      latestScore: 93,
      reports: [
        { round: 1, concreteIssueCount: 4 },
        { round: 2, concreteIssueCount: 3 },
        { round: 3, concreteIssueCount: 2 }
      ]
    });

    const result = await new ContentReviewLoopService(root).evaluate({
      runId: "review-pass",
      maxRounds: 3,
      minQualityScore: 90
    });

    expect(result).toMatchObject({
      status: "ready_for_imagegen"
    });
  });
});

async function writePublishedCourse(root: string, runId: string): Promise<void> {
  const previewRoot = path.join(root, "runs", runId, "preview");
  await mkdir(path.join(previewRoot, "lessons"), { recursive: true });
  await writeFile(
    path.join(previewRoot, "course-pack.json"),
    JSON.stringify({ id: runId, title: "课程", units: [{ unitId: "unit-overview", lessonId: "lesson-a" }] }, null, 2)
  );
  await writeFile(
    path.join(previewRoot, "lessons", "lesson-a.json"),
    JSON.stringify({ id: "lesson-a", title: "总览", pages: [{ id: "p1", title: "第一页" }] }, null, 2)
  );
  await mkdir(path.join(root, "runs", runId, "quality"), { recursive: true });
  await writeFile(
    path.join(root, "runs", runId, "quality", "course-quality-report.json"),
    JSON.stringify({ status: "passed", score: 93, issues: [] }, null, 2)
  );
}

async function writeReviewState(root: string, runId: string, state: Record<string, unknown>): Promise<void> {
  const dir = path.join(root, "runs", runId, "quality", "content-review");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "content-review-state.json"), JSON.stringify(state, null, 2));
}
