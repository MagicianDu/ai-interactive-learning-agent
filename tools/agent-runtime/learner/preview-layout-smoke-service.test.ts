import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  PreviewLayoutSmokeService,
  summarizePreviewLayoutMeasurements,
  type PreviewLayoutMeasurement
} from "./preview-layout-smoke-service.js";

describe("PreviewLayoutSmokeService", () => {
  test("summarizes full-page layout failures from browser measurements", () => {
    const report = summarizePreviewLayoutMeasurements("layout-run", [
      measurement({
        route: "#/preview/layout-run/unit/unit-overview/page/1",
        bodyScrollHeight: 820,
        bodyClientHeight: 720
      }),
      measurement({
        route: "#/preview/layout-run/unit/unit-overview/page/2",
        loadedImageCount: 0,
        consoleErrors: ["Failed to load image"],
        overflowingElements: [{ selector: "[data-testid=knowledge-board]", scrollHeight: 760, clientHeight: 620 }]
      })
    ]);

    expect(report).toMatchObject({
      status: "failed",
      runId: "layout-run",
      checkedPageCount: 2,
      checkedViewportCount: 2,
      issues: expect.arrayContaining([
        expect.objectContaining({ issueId: "layout.page.vertical-scroll", pageNumber: 1 }),
        expect.objectContaining({ issueId: "layout.image.not-loaded", pageNumber: 2 }),
        expect.objectContaining({ issueId: "layout.console-error", pageNumber: 2 }),
        expect.objectContaining({ issueId: "layout.element-overflow", pageNumber: 2 })
      ])
    });
  });

  test("writes a smoke report for every preview page when measurements pass", async () => {
    const root = await layoutFixtureRoot("layout-pass");
    const result = await new PreviewLayoutSmokeService(root).runWithMeasurements({
      runId: "layout-pass",
      measurements: [
        measurement({ route: "#/preview/layout-pass/unit/unit-overview/page/1" }),
        measurement({ route: "#/preview/layout-pass/unit/unit-overview/page/2" })
      ]
    });

    expect(result).toMatchObject({
      status: "passed",
      runId: "layout-pass",
      checkedPageCount: 2,
      checkedViewportCount: 2,
      issues: []
    });
    if (!result.reportPath) {
      throw new Error("expected reportPath");
    }
    const report = JSON.parse(await readFile(result.reportPath, "utf8")) as Record<string, unknown>;
    expect(report).toMatchObject({
      status: "passed",
      targets: [
        { unitId: "unit-overview", lessonId: "lesson-a", pageNumber: 1 },
        { unitId: "unit-overview", lessonId: "lesson-a", pageNumber: 2 }
      ]
    });
  });
});

function measurement(input: Partial<PreviewLayoutMeasurement>): PreviewLayoutMeasurement {
  return {
    route: input.route ?? "#/preview/layout-run/unit/unit-overview/page/1",
    unitId: input.unitId ?? "unit-overview",
    lessonId: input.lessonId ?? "lesson-a",
    pageId: input.pageId ?? `page-${String(input.pageNumber ?? 1).padStart(2, "0")}`,
    pageNumber: input.pageNumber ?? Number(/page\/(?<page>[0-9]+)/u.exec(input.route ?? "")?.groups?.page ?? 1),
    viewportName: input.viewportName ?? "desktop",
    viewportWidth: input.viewportWidth ?? 1280,
    viewportHeight: input.viewportHeight ?? 720,
    bodyScrollHeight: input.bodyScrollHeight ?? 700,
    bodyClientHeight: input.bodyClientHeight ?? 720,
    bodyScrollWidth: input.bodyScrollWidth ?? 1280,
    bodyClientWidth: input.bodyClientWidth ?? 1280,
    imageCount: input.imageCount ?? 1,
    loadedImageCount: input.loadedImageCount ?? 1,
    consoleErrors: input.consoleErrors ?? [],
    overflowingElements: input.overflowingElements ?? []
  };
}

async function layoutFixtureRoot(runId: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "preview-layout-smoke-"));
  const previewRoot = path.join(root, "runs", runId, "preview");
  await mkdir(path.join(previewRoot, "lessons"), { recursive: true });
  await writeFile(
    path.join(previewRoot, "course-pack.json"),
    `${JSON.stringify(
      {
        id: runId,
        title: "布局验收课程",
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
        title: "布局验收总览",
        pages: [
          { id: "page-01", title: "第一页" },
          { id: "page-02", title: "第二页" }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return root;
}
