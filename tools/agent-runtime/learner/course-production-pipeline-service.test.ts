import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { CourseProductionPipelineService } from "./course-production-pipeline-service.js";

describe("CourseProductionPipelineService", () => {
  test("starts a learner-safe production pipeline and asks Codex to author the bundle", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-"));
    const service = new CourseProductionPipelineService(root);

    const result = await service.start({
      runId: "pipeline-course",
      sourceKind: "book",
      learnerRequest: "生成中文研究生自学 Web Deck，总览 + 4 个核心 topic。",
      targetMode: "student_self_study_textbook",
      defaults: {
        difficulty: "graduate",
        strategy: "overview_plus_topic",
        overviewPages: 10,
        topicPages: 8,
        topicCount: 4,
        reviewRounds: 3,
        minQualityScore: 90
      }
    });

    expect(result).toMatchObject({
      status: "production_started",
      runId: "pipeline-course",
      nextAction: {
        kind: "author_course_bundle"
      }
    });
    if (result.nextAction.kind !== "author_course_bundle") {
      throw new Error("expected author action");
    }
    expect(result.nextAction.audienceFacingMessage).not.toContain("artifact");
    expect(result.nextAction.codexInstruction).toContain("Do not show internal artifacts");

    const state = JSON.parse(
      await readFile(path.join(root, "runs", "pipeline-course", "quality", "production-pipeline", "pipeline-state.json"), "utf8")
    ) as Record<string, unknown>;
    expect(state).toMatchObject({
      runId: "pipeline-course",
      stage: "needs_authoring",
      defaults: { reviewRounds: 3, minQualityScore: 90 }
    });
  });

  test("blocks preview handoff until course is published", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-"));
    const service = new CourseProductionPipelineService(root);
    await service.start({
      runId: "pipeline-blocked",
      sourceKind: "book",
      learnerRequest: "做一版自学课程。",
      targetMode: "student_self_study_textbook",
      defaults: {
        difficulty: "graduate",
        strategy: "overview_plus_topic",
        overviewPages: 10,
        topicPages: 8,
        topicCount: 4,
        reviewRounds: 3,
        minQualityScore: 90
      }
    });

    const next = await service.nextAction({ runId: "pipeline-blocked" });
    expect(next.nextAction.kind).toBe("author_course_bundle");
    expect(next.status).toBe("action_required");
  });

  test("asks for content review after the initial course is published", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-"));
    const service = new CourseProductionPipelineService(root);
    await service.start(courseProductionInput("pipeline-review"));
    await service.recordEvent({
      runId: "pipeline-review",
      eventKind: "course_published",
      summary: "Initial course bundle published.",
      artifactPaths: ["runs/pipeline-review/preview/course-pack.json"]
    });

    const next = await service.nextAction({ runId: "pipeline-review" });

    expect(next).toMatchObject({
      status: "action_required",
      stage: "content_review",
      nextAction: {
        kind: "run_content_review",
        reviewRound: 1
      }
    });
  });

  test("blocks imagegen when content review reports are not concrete", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-"));
    const service = new CourseProductionPipelineService(root);
    await service.start(courseProductionInput("pipeline-vague-review"));
    await service.recordEvent({
      runId: "pipeline-vague-review",
      eventKind: "course_published",
      summary: "Initial course bundle published.",
      artifactPaths: ["runs/pipeline-vague-review/preview/course-pack.json"]
    });
    await writeReviewState(root, "pipeline-vague-review", {
      completedRounds: 3,
      latestVerdict: "pass",
      latestScore: 92,
      reports: [
        { round: 1, concreteIssueCount: 0 },
        { round: 2, concreteIssueCount: 0 },
        { round: 3, concreteIssueCount: 0 }
      ]
    });

    const next = await service.nextAction({ runId: "pipeline-vague-review" });

    expect(next).toMatchObject({
      status: "action_required",
      stage: "needs_content_revision",
      nextAction: {
        kind: "revise_from_content_review",
        requiredFixes: ["review_reports_not_concrete"]
      }
    });
  });
});

function courseProductionInput(runId: string) {
  return {
    runId,
    sourceKind: "book" as const,
    learnerRequest: "做一版自学课程。",
    targetMode: "student_self_study_textbook" as const,
    defaults: {
      difficulty: "graduate" as const,
      strategy: "overview_plus_topic" as const,
      overviewPages: 10,
      topicPages: 8,
      topicCount: 4,
      reviewRounds: 3,
      minQualityScore: 90
    }
  };
}

async function writeReviewState(root: string, runId: string, state: Record<string, unknown>): Promise<void> {
  const dir = path.join(root, "runs", runId, "quality", "content-review");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "content-review-state.json"), JSON.stringify(state, null, 2));
}
