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

  test("returns imagegen batch action after content review passes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-"));
    const service = new CourseProductionPipelineService(root);
    await service.start(courseProductionInput("pipeline-imagegen"));
    await writePublishedCourse(root, "pipeline-imagegen");
    await service.recordEvent({
      runId: "pipeline-imagegen",
      eventKind: "course_published",
      summary: "Initial course bundle published.",
      artifactPaths: ["runs/pipeline-imagegen/preview/course-pack.json"]
    });
    await writeReviewState(root, "pipeline-imagegen", passingReviewState());

    const next = await service.nextAction({ runId: "pipeline-imagegen" });

    expect(next).toMatchObject({
      status: "action_required",
      stage: "imagegen_batch",
      nextAction: {
        kind: "generate_imagegen_assets",
        codexInstruction: expect.stringContaining("Call imagegen with the imagePrompt for lesson-a/p1"),
        pendingItems: [
          { lessonId: "lesson-a", pageId: "p1" },
          { lessonId: "lesson-a", pageId: "p2" }
        ]
      }
    });
  });

  test("does not hand off preview when layout smoke report failed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-"));
    const service = new CourseProductionPipelineService(root);
    await service.start(courseProductionInput("layout-blocked"));
    await writePipelineReadyExceptLayout(root, "layout-blocked", "failed");
    await service.recordEvent({
      runId: "layout-blocked",
      eventKind: "course_published",
      summary: "Initial course bundle published.",
      artifactPaths: ["runs/layout-blocked/preview/course-pack.json"]
    });

    const next = await service.nextAction({ runId: "layout-blocked" });

    expect(next).toMatchObject({
      status: "action_required",
      stage: "needs_layout_fix",
      nextAction: { kind: "fix_layout" }
    });
  });

  test("does not hand off preview until imagegen asset validation has passed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-"));
    const service = new CourseProductionPipelineService(root);
    await service.start(courseProductionInput("imagegen-validation-missing"));
    await writePipelineReadyExceptLayout(root, "imagegen-validation-missing", "passed", { assetValidation: false });
    await service.recordEvent({
      runId: "imagegen-validation-missing",
      eventKind: "course_published",
      summary: "Initial course bundle published.",
      artifactPaths: ["runs/imagegen-validation-missing/preview/course-pack.json"]
    });

    const next = await service.nextAction({ runId: "imagegen-validation-missing" });

    expect(next).toMatchObject({
      status: "action_required",
      stage: "needs_imagegen_retry",
      nextAction: {
        kind: "fix_imagegen_assets",
        codexInstruction: expect.stringContaining("validate_imagegen_assets")
      }
    });
  });

  test("hands off preview when content review, imagegen, and layout smoke all pass", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-production-"));
    const service = new CourseProductionPipelineService(root);
    await service.start(courseProductionInput("layout-pass"));
    await writePipelineReadyExceptLayout(root, "layout-pass", "passed");
    await service.recordEvent({
      runId: "layout-pass",
      eventKind: "course_published",
      summary: "Initial course bundle published.",
      artifactPaths: ["runs/layout-pass/preview/course-pack.json"]
    });

    const next = await service.nextAction({ runId: "layout-pass" });

    expect(next).toMatchObject({
      status: "preview_ready",
      stage: "preview_ready",
      nextAction: {
        kind: "handoff_preview",
        previewUrl: "http://127.0.0.1:5173/#/preview/layout-pass"
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

function passingReviewState(): Record<string, unknown> {
  return {
    completedRounds: 3,
    latestVerdict: "pass",
    latestScore: 93,
    reports: [
      { round: 1, concreteIssueCount: 4 },
      { round: 2, concreteIssueCount: 3 },
      { round: 3, concreteIssueCount: 2 }
    ]
  };
}

async function writePublishedCourse(root: string, runId: string): Promise<void> {
  const previewRoot = path.join(root, "runs", runId, "preview");
  await mkdir(path.join(previewRoot, "lessons"), { recursive: true });
  await writeFile(
    path.join(previewRoot, "course-pack.json"),
    JSON.stringify({ id: runId, title: "课程", units: [{ unitId: "unit-overview", lessonId: "lesson-a" }] }, null, 2)
  );
  await writeFile(
    path.join(previewRoot, "lessons", "lesson-a.json"),
    JSON.stringify(
      {
        id: "lesson-a",
        displayMode: "textbook_deck",
        pages: [
          { id: "p1", title: "第一页", knowledgeBoard: { coreProposition: "概念 A", bottomLine: "理解 A" } },
          { id: "p2", title: "第二页", knowledgeBoard: { coreProposition: "概念 B", bottomLine: "理解 B" } }
        ]
      },
      null,
      2
    )
  );
}

async function writePipelineReadyExceptLayout(
  root: string,
  runId: string,
  layoutStatus: "passed" | "failed",
  options: { assetValidation?: boolean } = {}
): Promise<void> {
  await writePublishedCourse(root, runId);
  await writeReviewState(root, runId, passingReviewState());
  await mkdir(path.join(root, "runs", runId, "quality", "imagegen"), { recursive: true });
  await writeFile(
    path.join(root, "runs", runId, "quality", "imagegen", "imagegen-batch-state.json"),
    JSON.stringify(
      {
        runId,
        totalItems: 2,
        items: ["p1", "p2"].map((pageId) => ({
          lessonId: "lesson-a",
          pageId,
          imagePrompt: `Visualize ${pageId}. No long prose, no tables, no UI text boxes.`,
          imageUrl: `/__learning-preview/${runId}/images/lesson-a/${pageId}-imagegen-v1.png`,
          targetAssetPath: path.join(root, "runs", runId, "preview", "images", "lesson-a", `${pageId}-imagegen-v1.png`),
          status: "succeeded",
          retryCount: 0
        }))
      },
      null,
      2
    )
  );
  if (options.assetValidation !== false) {
    await writeFile(
      path.join(root, "runs", runId, "quality", "imagegen", "imagegen-asset-validation.json"),
      JSON.stringify(
        {
          status: "passed",
          runId,
          checkedPageCount: 2,
          issues: []
        },
        null,
        2
      )
    );
  }
  await mkdir(path.join(root, "runs", runId, "quality", "layout-smoke"), { recursive: true });
  await writeFile(
    path.join(root, "runs", runId, "quality", "layout-smoke", "layout-smoke-report.json"),
    JSON.stringify(
      {
        status: layoutStatus,
        issues: layoutStatus === "passed" ? [] : [{ issueId: "layout.page.vertical-scroll" }]
      },
      null,
      2
    )
  );
}
