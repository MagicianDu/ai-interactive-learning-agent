import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ImagegenAssetBatchService } from "./imagegen-asset-batch-service.js";

describe("ImagegenAssetBatchService", () => {
  test("creates prompt manifest for every preview page", async () => {
    const root = await imageFixtureRoot("image-course");

    const result = await new ImagegenAssetBatchService(root).createManifest({ runId: "image-course" });

    expect(result).toMatchObject({
      status: "manifest_ready",
      runId: "image-course",
      requiredImageCount: 2,
      manifestPath: expect.stringContaining("imagegen-prompt-manifest.json")
    });
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as { items: Array<Record<string, unknown>> };
    expect(manifest.items).toHaveLength(2);
    expect(manifest.items[0]).toMatchObject({
      lessonId: "lesson-a",
      pageId: "page-01",
      status: "missing_asset",
      targetAssetPath: expect.stringContaining("page-01-imagegen-v1.png"),
      imageUrl: "/__learning-preview/image-course/images/lesson-a/page-01-imagegen-v1.png",
      prompt: expect.stringContaining("不要包含长段落文字、表格或 UI 文本框")
    });
    expect(manifest.items[0]?.prompt).not.toContain("测量把几何概念变成可比较的量");
    expect(manifest.items[0]?.prompt).toContain("测量和坐标的关系");
    expect(manifest.items[0]?.prompt).not.toContain("核心知识关系：的教学插图");
    expect(manifest.items[0]?.prompt).toContain("不要重复页面标题");
    expect(manifest.items[0]?.prompt).toContain("不要重复底部总结");
  });

  test("records a generated image and rewrites the preview lesson visualSpec", async () => {
    const root = await imageFixtureRoot("image-course");
    const generated = path.join(root, "generated.png");
    await writeFile(generated, Buffer.from([137, 80, 78, 71]));

    const service = new ImagegenAssetBatchService(root);
    await service.createManifest({ runId: "image-course" });
    const result = await service.recordAsset({
      runId: "image-course",
      lessonId: "lesson-a",
      pageId: "page-01",
      sourceImagePath: generated,
      generator: "imagegen",
      recordedBy: "vitest"
    });

    expect(result).toMatchObject({
      status: "asset_recorded",
      runId: "image-course",
      lessonId: "lesson-a",
      pageId: "page-01",
      imageUrl: "/__learning-preview/image-course/images/lesson-a/page-01-imagegen-v1.png"
    });
    const lesson = JSON.parse(await readFile(path.join(root, "runs", "image-course", "preview", "lessons", "lesson-a.json"), "utf8")) as {
      pages: Array<{ visualSpec?: Record<string, unknown> }>;
    };
    expect(lesson.pages[0]?.visualSpec).toMatchObject({
      imageProvider: "imagegen",
      imageUrl: "/__learning-preview/image-course/images/lesson-a/page-01-imagegen-v1.png",
      imagePrompt: expect.stringContaining("不要包含长段落文字、表格或 UI 文本框"),
      assetProvenance: {
        generator: "imagegen",
        recordedBy: "vitest"
      }
    });
    const manifest = JSON.parse(
      await readFile(path.join(root, "runs", "image-course", "quality", "imagegen", "imagegen-prompt-manifest.json"), "utf8")
    ) as { items: Array<Record<string, unknown>> };
    expect(manifest.items[0]).toMatchObject({ status: "ready" });
  });

  test("validate reports missing image files and svg references", async () => {
    const root = await imageFixtureRoot("image-course");

    const result = await new ImagegenAssetBatchService(root).validateAssets({ runId: "image-course" });

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issueId: "imagegen.asset.file-missing", pageId: "page-01" }),
        expect.objectContaining({ issueId: "imagegen.asset.svg-reference", pageId: "page-02" })
      ])
    );
  });

  test("validate reports missing provenance for a preview image file", async () => {
    const root = await imageFixtureRoot("missing-provenance");
    await mkdir(path.join(root, "runs", "missing-provenance", "preview", "images", "lesson-a"), { recursive: true });
    await writeFile(path.join(root, "runs", "missing-provenance", "preview", "images", "lesson-a", "page-01-imagegen-v1.png"), "png", "utf8");

    const result = await new ImagegenAssetBatchService(root).validateAssets({ runId: "missing-provenance" });

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ issueId: "imagegen.asset.provenance-missing", pageId: "page-01" })])
    );
  });

  test("validate rejects placeholder assets even when a png file exists", async () => {
    const root = await imageFixtureRoot("placeholder-asset");
    const generated = path.join(root, "placeholder.png");
    await writeFile(generated, Buffer.from([137, 80, 78, 71]));
    const service = new ImagegenAssetBatchService(root);
    await service.createManifest({ runId: "placeholder-asset" });
    await service.recordAsset({
      runId: "placeholder-asset",
      lessonId: "lesson-a",
      pageId: "page-01",
      sourceImagePath: generated,
      generator: "placeholder",
      recordedBy: "placeholder-script"
    });

    const result = await service.validateAssets({ runId: "placeholder-asset" });

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ issueId: "imagegen.asset.generator-not-imagegen", pageId: "page-01" })])
    );
  });

  test("validate blocks unsafe or under-specified image prompts", async () => {
    const root = await imageFixtureRoot("unsafe-prompts");
    const lessonPath = path.join(root, "runs", "unsafe-prompts", "preview", "lessons", "lesson-a.json");
    const lesson = JSON.parse(await readFile(lessonPath, "utf8")) as { pages: Array<Record<string, unknown>> };
    lesson.pages[0] = {
      ...lesson.pages[0],
      visualSpec: {
        imageUrl: "/__learning-preview/unsafe-prompts/images/lesson-a/page-01-imagegen-v1.png",
        imageProvider: "imagegen",
        imagePrompt: "生成一张中文教学插图，可以包含表格、UI 文本框和大段文字解释。",
        imageAlt: "错误图片"
      }
    };
    lesson.pages[1] = {
      ...lesson.pages[1],
      visualSpec: {
        imageUrl: "/__learning-preview/unsafe-prompts/images/lesson-a/page-02-imagegen-v1.png",
        imageProvider: "imagegen",
        imagePrompt: "生成一张中文教学插图，画出测量过程中的几何对象、坐标轴和量化关系，可以使用短标签帮助理解。",
        imageAlt: "缺少约束的图片"
      }
    };
    await writeFile(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`, "utf8");
    await mkdir(path.join(root, "runs", "unsafe-prompts", "preview", "images", "lesson-a"), { recursive: true });
    await writeFile(path.join(root, "runs", "unsafe-prompts", "preview", "images", "lesson-a", "page-01-imagegen-v1.png"), "png", "utf8");
    await writeFile(path.join(root, "runs", "unsafe-prompts", "preview", "images", "lesson-a", "page-02-imagegen-v1.png"), "png-2", "utf8");

    const result = await new ImagegenAssetBatchService(root).validateAssets({ runId: "unsafe-prompts" });

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issueId: "imagegen.asset.prompt-unsafe", pageId: "page-01" }),
        expect.objectContaining({ issueId: "imagegen.asset.prompt-guard-missing", pageId: "page-02" })
      ])
    );
  });

  test("validate blocks prompts that duplicate learner-facing page titles", async () => {
    const root = await imageFixtureRoot("duplicated-title");
    const lessonPath = path.join(root, "runs", "duplicated-title", "preview", "lessons", "lesson-a.json");
    const lesson = JSON.parse(await readFile(lessonPath, "utf8")) as { pages: Array<Record<string, unknown>> };
    lesson.pages[0] = {
      ...lesson.pages[0],
      visualSpec: {
        imageUrl: "/__learning-preview/duplicated-title/images/lesson-a/page-01-imagegen-v1.png",
        imageProvider: "imagegen",
        imagePrompt:
          "生成一张中文教学插图，画面大字写出：测量把几何概念变成可比较的量。不要包含长段落文字、表格或 UI 文本框；不要重复页面标题、底部总结或页面卡片原文。",
        imageAlt: "错误重复标题的图片"
      }
    };
    await writeFile(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`, "utf8");
    await mkdir(path.join(root, "runs", "duplicated-title", "preview", "images", "lesson-a"), { recursive: true });
    await writeFile(path.join(root, "runs", "duplicated-title", "preview", "images", "lesson-a", "page-01-imagegen-v1.png"), "png", "utf8");

    const result = await new ImagegenAssetBatchService(root).validateAssets({ runId: "duplicated-title" });

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ issueId: "imagegen.asset.prompt-duplicates-page-text", pageId: "page-01" })])
    );
  });

  test("validate blocks generic image prompt intent", async () => {
    const root = await imageFixtureRoot("generic-prompt");
    const lessonPath = path.join(root, "runs", "generic-prompt", "preview", "lessons", "lesson-a.json");
    const lesson = JSON.parse(await readFile(lessonPath, "utf8")) as { pages: Array<Record<string, unknown>> };
    lesson.pages[0] = {
      ...lesson.pages[0],
      visualSpec: {
        imageUrl: "/__learning-preview/generic-prompt/images/lesson-a/page-01-imagegen-v1.png",
        imageProvider: "imagegen",
        imagePrompt:
          "生成一张中文 Web Deck 教学插图，画出这一页的核心知识关系：的教学插图。可以使用短标签、方向词或局部标注帮助理解；不要包含长段落文字、表格或 UI 文本框；不要重复页面标题；不要重复底部总结；不要重复页面卡片原文。",
        imageAlt: "教学插图"
      }
    };
    await writeFile(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`, "utf8");
    await mkdir(path.join(root, "runs", "generic-prompt", "preview", "images", "lesson-a"), { recursive: true });
    await writeFile(path.join(root, "runs", "generic-prompt", "preview", "images", "lesson-a", "page-01-imagegen-v1.png"), "png", "utf8");

    const result = await new ImagegenAssetBatchService(root).validateAssets({ runId: "generic-prompt" });

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ issueId: "imagegen.asset.prompt-generic-intent", pageId: "page-01" })])
    );
  });

  test("validate blocks duplicated prompt intent across pages", async () => {
    const root = await imageFixtureRoot("duplicate-prompt-intent");
    const lessonPath = path.join(root, "runs", "duplicate-prompt-intent", "preview", "lessons", "lesson-a.json");
    const lesson = JSON.parse(await readFile(lessonPath, "utf8")) as { pages: Array<Record<string, unknown>> };
    const duplicatedPrompt =
      "生成一张中文 Web Deck 教学插图，画出这一页独有的视觉结构：画成证据筛选路径，突出来源主张、中间机制和适用边界之间的判断顺序。可以使用短标签、方向词或局部标注帮助理解；构图、主体关系和视觉隐喻必须明显区别于同课程其他页面；不要包含长段落文字、表格或 UI 文本框；不要重复页面标题；不要重复底部总结；不要重复页面卡片原文。";
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      visualSpec: {
        imageUrl: `/__learning-preview/duplicate-prompt-intent/images/lesson-a/page-0${index + 1}-imagegen-v1.png`,
        imageProvider: "imagegen",
        imagePrompt: duplicatedPrompt,
        imageAlt: `证据筛选路径 ${index + 1}`
      }
    }));
    await writeFile(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`, "utf8");
    await mkdir(path.join(root, "runs", "duplicate-prompt-intent", "preview", "images", "lesson-a"), { recursive: true });
    await writeFile(path.join(root, "runs", "duplicate-prompt-intent", "preview", "images", "lesson-a", "page-01-imagegen-v1.png"), "png-1", "utf8");
    await writeFile(path.join(root, "runs", "duplicate-prompt-intent", "preview", "images", "lesson-a", "page-02-imagegen-v1.png"), "png-2", "utf8");

    const result = await new ImagegenAssetBatchService(root).validateAssets({ runId: "duplicate-prompt-intent" });

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ issueId: "imagegen.asset.duplicate-prompt-intent", pageId: "page-02" })])
    );
  });

  test("validate blocks reusing the same generated image content across different pages", async () => {
    const root = await imageFixtureRoot("duplicate-image-content");
    const lessonPath = path.join(root, "runs", "duplicate-image-content", "preview", "lessons", "lesson-a.json");
    const lesson = JSON.parse(await readFile(lessonPath, "utf8")) as { pages: Array<Record<string, unknown>> };
    lesson.pages[1] = {
      ...lesson.pages[1],
      visualSpec: {
        imageUrl: "/__learning-preview/duplicate-image-content/images/lesson-a/page-02-imagegen-v1.png",
        imageProvider: "imagegen",
        imagePrompt:
          "生成一张中文教学插图，只表达张量在坐标变化下保持物理关系；可以使用短标签帮助理解；不要包含页面标题、底部总结、页面卡片原文、长段落文字、表格或 UI 文本框。",
        imageAlt: "张量和坐标变化"
      }
    };
    await writeFile(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`, "utf8");
    await mkdir(path.join(root, "runs", "duplicate-image-content", "preview", "images", "lesson-a"), { recursive: true });
    const sameImageBytes = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]);
    await writeFile(
      path.join(root, "runs", "duplicate-image-content", "preview", "images", "lesson-a", "page-01-imagegen-v1.png"),
      sameImageBytes
    );
    await writeFile(
      path.join(root, "runs", "duplicate-image-content", "preview", "images", "lesson-a", "page-02-imagegen-v1.png"),
      sameImageBytes
    );

    const result = await new ImagegenAssetBatchService(root).validateAssets({ runId: "duplicate-image-content" });

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ issueId: "imagegen.asset.duplicate-image-content", pageId: "page-02" })])
    );
  });
});

async function imageFixtureRoot(runId: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "imagegen-batch-"));
  const previewRoot = path.join(root, "runs", runId, "preview");
  await mkdir(path.join(previewRoot, "lessons"), { recursive: true });
  await writeFile(
    path.join(previewRoot, "course-pack.json"),
    `${JSON.stringify(
      {
        id: runId,
        title: "图片批处理课程",
        units: [{ unitId: "unit-overview", lessonId: "lesson-a", title: "总览", targetPageCount: 2 }]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(previewRoot, "lessons", "lesson-a.json"),
    `${JSON.stringify(
      {
        id: "lesson-a",
        title: "总览课",
        displayMode: "textbook_deck",
        pages: [
          {
            id: "page-01",
            title: "测量把几何概念变成可比较的量",
            narrative: "中文说明。",
            visualSpec: {
              kind: "diagram",
              description: "测量和坐标的关系",
              keyElements: ["测量", "坐标"],
              imageUrl: `/__learning-preview/${runId}/images/lesson-a/page-01-imagegen-v1.png`,
              imageAlt: "测量、坐标和几何量之间的关系",
              imageProvider: "imagegen",
              imagePrompt:
                "生成一张中文教学插图，只表达测量和坐标的关系；可以使用短标签帮助理解；不要包含页面标题、底部总结、页面卡片原文、长段落文字、表格或 UI 文本框。"
            },
            knowledgeBoard: {
              coreProposition: "测量让几何量可比较。",
              bottomLine: "坐标不是实体，测量关系才是判断对象。"
            }
          },
          {
            id: "page-02",
            title: "张量语言保留坐标变化下的不变量",
            narrative: "中文说明。",
            visualSpec: {
              imageUrl: `/__learning-preview/${runId}/images/lesson-a/page-02.svg`,
              imageAlt: "张量和坐标变化",
              imageProvider: "imagegen",
              imagePrompt:
                "生成一张中文教学插图，只表达张量在坐标变化下保持物理关系；可以使用短标签帮助理解；不要包含页面标题、底部总结、页面卡片原文、长段落文字、表格或 UI 文本框。"
            },
            knowledgeBoard: {
              coreProposition: "张量表达不依赖坐标选择的关系。",
              bottomLine: "换坐标时，关系不应跟着改变。"
            }
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return root;
}
