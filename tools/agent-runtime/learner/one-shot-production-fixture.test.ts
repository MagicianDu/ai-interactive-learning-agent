import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { CourseProductionPipelineService } from "./course-production-pipeline-service.js";
import { ImagegenBatchStateService } from "./imagegen-batch-state-service.js";

describe("one-shot course production fixture", () => {
  test("moves from learner request to preview handoff with mocked image assets and layout report", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "one-shot-production-"));
    const runId = "one-shot-fixture";
    const pipeline = new CourseProductionPipelineService(root);

    await pipeline.start({
      runId,
      sourceKind: "book",
      learnerRequest: "中文研究生自学课程，总览 + 1 个核心 topic。",
      targetMode: "student_self_study_textbook",
      defaults: {
        difficulty: "graduate",
        strategy: "overview_plus_topic",
        overviewPages: 2,
        topicPages: 2,
        topicCount: 1,
        reviewRounds: 3,
        minQualityScore: 90
      }
    });

    await writePublishedFixture(root, runId);
    await pipeline.recordEvent({
      runId,
      eventKind: "course_published",
      summary: "Fixture course published.",
      artifactPaths: [`runs/${runId}/preview/course-pack.json`]
    });
    await writePassingReview(root, runId);
    const batch = new ImagegenBatchStateService(root);
    await batch.start({ runId });
    for (const pageId of ["p1", "p2"]) {
      const generated = path.join(root, `${pageId}.png`);
      await writeFile(generated, `png-${pageId}`, "utf8");
      await batch.recordItem({ runId, lessonId: "lesson-a", pageId, status: "succeeded", sourceImagePath: generated });
    }
    await writePassingLayout(root, runId);

    const result = await pipeline.nextAction({ runId });

    expect(result).toMatchObject({
      status: "preview_ready",
      nextAction: {
        kind: "handoff_preview",
        previewUrl: "http://127.0.0.1:5173/#/preview/one-shot-fixture"
      }
    });
  });
});

async function writePublishedFixture(root: string, runId: string): Promise<void> {
  const previewRoot = path.join(root, "runs", runId, "preview");
  await mkdir(path.join(previewRoot, "lessons"), { recursive: true });
  await writeFile(
    path.join(previewRoot, "course-pack.json"),
    JSON.stringify({ id: runId, units: [{ unitId: "unit-overview", lessonId: "lesson-a" }] }, null, 2)
  );
  await writeFile(
    path.join(previewRoot, "lessons", "lesson-a.json"),
    JSON.stringify(
      {
        id: "lesson-a",
        displayMode: "textbook_deck",
        pages: [
          {
            id: "p1",
            title: "第一页",
            visualSpec: { imageAlt: "概念 A 的教学插图" },
            knowledgeBoard: { coreProposition: "概念 A", bottomLine: "理解 A" }
          },
          {
            id: "p2",
            title: "第二页",
            visualSpec: { imageAlt: "概念 B 的教学插图" },
            knowledgeBoard: { coreProposition: "概念 B", bottomLine: "理解 B" }
          }
        ]
      },
      null,
      2
    )
  );
}

async function writePassingReview(root: string, runId: string): Promise<void> {
  const dir = path.join(root, "runs", runId, "quality", "content-review");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "content-review-state.json"),
    JSON.stringify(
      {
        completedRounds: 3,
        latestVerdict: "pass",
        latestScore: 92,
        reports: [
          { round: 1, concreteIssueCount: 4 },
          { round: 2, concreteIssueCount: 3 },
          { round: 3, concreteIssueCount: 2 }
        ]
      },
      null,
      2
    )
  );
}

async function writePassingLayout(root: string, runId: string): Promise<void> {
  const dir = path.join(root, "runs", runId, "quality", "layout-smoke");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "layout-smoke-report.json"), JSON.stringify({ status: "passed", issues: [] }, null, 2));
}
