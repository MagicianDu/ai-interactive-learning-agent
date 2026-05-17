import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ImagegenBatchStateService } from "./imagegen-batch-state-service.js";

describe("ImagegenBatchStateService", () => {
  test("creates pending batch items from existing imagegen manifest", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "imagegen-batch-state-"));
    await writeManifest(root, "image-batch", [
      { lessonId: "lesson-a", pageId: "p1", prompt: "Visualize concept A. No long prose, no tables, no UI text boxes." },
      { lessonId: "lesson-a", pageId: "p2", prompt: "Visualize concept B. No long prose, no tables, no UI text boxes." }
    ]);

    const result = await new ImagegenBatchStateService(root).start({ runId: "image-batch" });

    expect(result).toMatchObject({
      status: "batch_started",
      totalItems: 2,
      pendingItems: [
        { lessonId: "lesson-a", pageId: "p1", status: "pending" },
        { lessonId: "lesson-a", pageId: "p2", status: "pending" }
      ]
    });
  });

  test("records succeeded and failed imagegen items with retry counts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "imagegen-batch-state-"));
    await writeManifest(root, "image-record", [
      { lessonId: "lesson-a", pageId: "p1", prompt: "Visualize concept A. No long prose, no tables, no UI text boxes." }
    ]);
    await writePreviewLesson(root, "image-record");
    const service = new ImagegenBatchStateService(root);
    await service.start({ runId: "image-record" });
    const failed = await service.recordItem({
      runId: "image-record",
      lessonId: "lesson-a",
      pageId: "p1",
      status: "failed",
      failureReason: "image repeated page title"
    });
    expect(failed.pendingItems[0]).toMatchObject({ status: "failed", retryCount: 1 });

    const png = path.join(root, "generated.png");
    await writeFile(png, "png-data", "utf8");
    const succeeded = await service.recordItem({
      runId: "image-record",
      lessonId: "lesson-a",
      pageId: "p1",
      status: "succeeded",
      sourceImagePath: png
    });
    expect(succeeded).toMatchObject({
      status: "batch_complete",
      completedItems: 1,
      failedItems: []
    });
    const lesson = JSON.parse(
      await readFile(path.join(root, "runs", "image-record", "preview", "lessons", "lesson-a.json"), "utf8")
    ) as Record<string, { visualSpec?: Record<string, unknown> }[]>;
    expect(lesson.pages[0]?.visualSpec).toMatchObject({
      imageProvider: "imagegen",
      imageUrl: "/__learning-preview/image-record/images/lesson-a/p1-imagegen-v1.png"
    });
  });
});

async function writeManifest(root: string, runId: string, items: Array<Record<string, string>>): Promise<void> {
  const dir = path.join(root, "runs", runId, "quality", "imagegen");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "imagegen-prompt-manifest.json"),
    JSON.stringify(
      {
        runId,
        createdAt: "2026-05-17T00:00:00.000Z",
        items: items.map((item) => ({
          pageTitle: item.pageId,
          imageAlt: item.pageId,
          status: "missing_asset",
          ...item,
          targetAssetPath: path.join(root, "runs", runId, "preview", "images", item.lessonId, `${item.pageId}-imagegen-v1.png`),
          imageUrl: `/__learning-preview/${runId}/images/${item.lessonId}/${item.pageId}-imagegen-v1.png`
        }))
      },
      null,
      2
    )
  );
}

async function writePreviewLesson(root: string, runId: string): Promise<void> {
  const dir = path.join(root, "runs", runId, "preview", "lessons");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "lesson-a.json"),
    JSON.stringify(
      {
        id: "lesson-a",
        displayMode: "textbook_deck",
        pages: [{ id: "p1", title: "第一页", knowledgeBoard: { coreProposition: "概念 A" } }]
      },
      null,
      2
    )
  );
}
