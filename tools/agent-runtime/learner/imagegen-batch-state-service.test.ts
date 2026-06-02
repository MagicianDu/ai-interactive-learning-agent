import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ImagegenBatchStateService } from "./imagegen-batch-state-service.js";
import { ImagegenAssetBatchService } from "./imagegen-asset-batch-service.js";

describe("ImagegenBatchStateService", () => {
  test("creates pending batch items from existing imagegen manifest", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "imagegen-batch-state-"));
    const promptA =
      "Visualize concept A. 不要包含长段落文字、表格或 UI 文本框；不要生成右侧 UI 面板；不要重复页面标题；不要重复底部总结；不要重复页面卡片原文。";
    const promptB =
      "Visualize concept B. 不要包含长段落文字、表格或 UI 文本框；不要生成右侧 UI 面板；不要重复页面标题；不要重复底部总结；不要重复页面卡片原文。";
    await writeManifest(root, "image-batch", [
      { lessonId: "lesson-a", pageId: "p1", prompt: promptA },
      { lessonId: "lesson-a", pageId: "p2", prompt: promptB }
    ]);

    const result = await new ImagegenBatchStateService(root).start({ runId: "image-batch" });

    expect(result).toMatchObject({
      status: "batch_started",
      totalItems: 2,
      nextItem: {
        lessonId: "lesson-a",
        pageId: "p1",
        imagePrompt: promptA
      },
      executionChecklist: expect.arrayContaining([
        expect.stringContaining("Call imagegen"),
        expect.stringContaining("$CODEX_HOME/generated_images"),
        expect.stringContaining("generator=imagegen")
      ]),
      retrySummary: {
        failedCount: 0,
        reasons: []
      },
      evidencePaths: [
        "runs/image-batch/quality/imagegen/imagegen-prompt-manifest.json",
        "runs/image-batch/quality/imagegen/imagegen-batch-state.json"
      ],
      pendingItems: [
        { lessonId: "lesson-a", pageId: "p1", status: "pending" },
        { lessonId: "lesson-a", pageId: "p2", status: "pending" }
      ]
    });
  });

  test("does not reset manifest-ready items when starting a batch", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "imagegen-batch-state-"));
    await writeManifest(root, "image-partial", [
      {
        lessonId: "lesson-a",
        pageId: "p1",
        prompt:
          "Visualize completed concept. 不要包含长段落文字、表格或 UI 文本框；不要生成右侧 UI 面板；不要重复页面标题；不要重复底部总结；不要重复页面卡片原文。",
        status: "ready"
      },
      {
        lessonId: "lesson-a",
        pageId: "p2",
        prompt:
          "Visualize pending concept. 不要包含长段落文字、表格或 UI 文本框；不要生成右侧 UI 面板；不要重复页面标题；不要重复底部总结；不要重复页面卡片原文。",
        status: "missing_asset"
      }
    ]);

    const result = await new ImagegenBatchStateService(root).start({ runId: "image-partial" });

    expect(result).toMatchObject({
      status: "batch_started",
      totalItems: 2,
      completedItems: 1,
      nextItem: {
        lessonId: "lesson-a",
        pageId: "p2",
        status: "pending"
      },
      pendingItems: [{ lessonId: "lesson-a", pageId: "p2", status: "pending" }]
    });
  });

  test("records succeeded and failed imagegen items with retry counts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "imagegen-batch-state-"));
    await writeManifest(root, "image-record", [
      {
        lessonId: "lesson-a",
        pageId: "p1",
        prompt:
          "Visualize concept A. 不要包含长段落文字、表格或 UI 文本框；不要生成右侧 UI 面板；不要重复页面标题；不要重复底部总结；不要重复页面卡片原文。"
      }
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
    expect(failed).toMatchObject({
      nextItem: {
        lessonId: "lesson-a",
        pageId: "p1",
        status: "failed",
        retryCount: 1,
        failureReason: "image repeated page title"
      },
      retrySummary: {
        failedCount: 1,
        reasons: ["lesson-a/p1: image repeated page title"]
      }
    });

    const png = path.join(root, "generated.png");
    await writeFile(png, "png-data", "utf8");
    const succeeded = await service.recordItem({
      runId: "image-record",
      lessonId: "lesson-a",
      pageId: "p1",
      status: "succeeded",
      sourceImagePath: png,
      recordedBy: "batch-state-test"
    });
    expect(succeeded).toMatchObject({
      status: "batch_complete",
      completedItems: 1,
      failedItems: [],
      nextItem: undefined,
      retrySummary: {
        failedCount: 0,
        reasons: []
      }
    });
    const lesson = JSON.parse(
      await readFile(path.join(root, "runs", "image-record", "preview", "lessons", "lesson-a.json"), "utf8")
    ) as Record<string, { visualSpec?: Record<string, unknown> }[]>;
    expect(lesson.pages[0]?.visualSpec).toMatchObject({
      imageProvider: "imagegen",
      imageUrl: "/__learning-preview/image-record/images/lesson-a/p1-imagegen-v1.png",
      assetProvenance: {
        generator: "imagegen",
        recordedBy: "batch-state-test"
      }
    });
    await expect(new ImagegenAssetBatchService(root).validateAssets({ runId: "image-record" })).resolves.toMatchObject({
      status: "passed",
      checkedPageCount: 1,
      issues: []
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
          status: item.status ?? "missing_asset",
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
