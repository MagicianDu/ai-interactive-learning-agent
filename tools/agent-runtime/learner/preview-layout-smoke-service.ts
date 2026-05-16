import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";

export type PreviewLayoutViewport = {
  name: string;
  width: number;
  height: number;
};

export type PreviewLayoutSmokeTarget = {
  route: string;
  unitId: string;
  lessonId: string;
  pageId: string;
  pageNumber: number;
};

export type PreviewLayoutOverflowElement = {
  selector: string;
  scrollHeight: number;
  clientHeight: number;
  scrollWidth?: number;
  clientWidth?: number;
};

export type PreviewLayoutMeasurement = PreviewLayoutSmokeTarget & {
  viewportName: string;
  viewportWidth: number;
  viewportHeight: number;
  bodyScrollHeight: number;
  bodyClientHeight: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
  imageCount: number;
  loadedImageCount: number;
  consoleErrors: string[];
  overflowingElements: PreviewLayoutOverflowElement[];
};

export type PreviewLayoutSmokeIssue = {
  issueId:
    | "layout.page.not-measured"
    | "layout.page.vertical-scroll"
    | "layout.page.horizontal-scroll"
    | "layout.image.not-loaded"
    | "layout.console-error"
    | "layout.element-overflow";
  route: string;
  unitId?: string;
  lessonId?: string;
  pageId?: string;
  pageNumber?: number;
  viewportName?: string;
  reason: string;
  requiredFix: string;
};

export type PreviewLayoutSmokeReport = {
  status: "passed" | "failed";
  runId: string;
  checkedPageCount: number;
  checkedViewportCount: number;
  issues: PreviewLayoutSmokeIssue[];
  targets?: PreviewLayoutSmokeTarget[];
  measurements?: PreviewLayoutMeasurement[];
  reportPath?: string;
};

type BrowserLayoutMetrics = Pick<
  PreviewLayoutMeasurement,
  | "bodyScrollHeight"
  | "bodyClientHeight"
  | "bodyScrollWidth"
  | "bodyClientWidth"
  | "imageCount"
  | "loadedImageCount"
  | "overflowingElements"
>;

export type RunPreviewLayoutSmokeInput = {
  runId: string;
  baseUrl?: string;
  viewports?: PreviewLayoutViewport[];
};

export type RunPreviewLayoutSmokeWithMeasurementsInput = {
  runId: string;
  measurements: PreviewLayoutMeasurement[];
};

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const DEFAULT_BASE_URL = "http://127.0.0.1:5173";
const DEFAULT_VIEWPORTS: PreviewLayoutViewport[] = [{ name: "desktop", width: 1280, height: 720 }];
const OVERFLOW_TOLERANCE_PX = 16;

export class PreviewLayoutSmokeService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async run(input: RunPreviewLayoutSmokeInput): Promise<PreviewLayoutSmokeReport> {
    assertSafeRunId(input.runId);
    const targets = await this.readTargets(input.runId);
    const viewports = input.viewports?.length ? input.viewports : DEFAULT_VIEWPORTS;
    const measurements = await collectBrowserMeasurements(input.baseUrl ?? DEFAULT_BASE_URL, targets, viewports);
    return this.writeReport(input.runId, targets, measurements);
  }

  async runWithMeasurements(input: RunPreviewLayoutSmokeWithMeasurementsInput): Promise<PreviewLayoutSmokeReport> {
    assertSafeRunId(input.runId);
    const targets = await this.readTargets(input.runId);
    return this.writeReport(input.runId, targets, input.measurements);
  }

  private async writeReport(
    runId: string,
    targets: PreviewLayoutSmokeTarget[],
    measurements: PreviewLayoutMeasurement[]
  ): Promise<PreviewLayoutSmokeReport> {
    const measuredRoutes = new Set(measurements.map((measurement) => measurement.route));
    const missingMeasurementIssues = targets
      .filter((target) => !measuredRoutes.has(target.route))
      .map<PreviewLayoutSmokeIssue>((target) => ({
        issueId: "layout.page.not-measured",
        route: target.route,
        unitId: target.unitId,
        lessonId: target.lessonId,
        pageId: target.pageId,
        pageNumber: target.pageNumber,
        reason: "This preview page was not visited by the layout smoke check.",
        requiredFix: "Run the layout smoke against every unit/page route before considering the preview ready."
      }));
    const summary = summarizePreviewLayoutMeasurements(runId, measurements);
    const report: PreviewLayoutSmokeReport = {
      ...summary,
      status: summary.issues.length + missingMeasurementIssues.length > 0 ? "failed" : "passed",
      issues: [...summary.issues, ...missingMeasurementIssues],
      targets,
      measurements
    };
    const reportPath = path.join(this.workspaceRoot, "runs", runId, "quality", "layout-smoke", "layout-smoke-report.json");
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify({ ...report, reportPath }, null, 2)}\n`, "utf8");
    return { ...report, reportPath };
  }

  private async readTargets(runId: string): Promise<PreviewLayoutSmokeTarget[]> {
    const previewRoot = path.join(this.workspaceRoot, "runs", runId, "preview");
    const coursePack = JSON.parse(await readFile(path.join(previewRoot, "course-pack.json"), "utf8")) as unknown;
    if (!isRecord(coursePack) || !Array.isArray(coursePack.units)) {
      throw new AgentRuntimeError("preview course-pack.json must include units", "INVALID_LESSON");
    }
    const targets: PreviewLayoutSmokeTarget[] = [];
    for (const unit of coursePack.units) {
      if (!isRecord(unit)) {
        continue;
      }
      const unitId = stringValue(unit.unitId);
      const lessonId = stringValue(unit.lessonId);
      if (!unitId || !lessonId) {
        continue;
      }
      const lesson = JSON.parse(await readFile(path.join(previewRoot, "lessons", `${lessonId}.json`), "utf8")) as unknown;
      if (!isRecord(lesson) || !Array.isArray(lesson.pages)) {
        throw new AgentRuntimeError(`preview lesson must include pages: ${lessonId}`, "INVALID_LESSON");
      }
      lesson.pages.forEach((page, index) => {
        if (!isRecord(page)) {
          return;
        }
        const pageNumber = index + 1;
        targets.push({
          route: `#/preview/${runId}/unit/${unitId}/page/${pageNumber}`,
          unitId,
          lessonId,
          pageId: stringValue(page.id) ?? `page-${String(pageNumber).padStart(2, "0")}`,
          pageNumber
        });
      });
    }
    return targets;
  }
}

export function summarizePreviewLayoutMeasurements(
  runId: string,
  measurements: PreviewLayoutMeasurement[]
): PreviewLayoutSmokeReport {
  const issues: PreviewLayoutSmokeIssue[] = [];
  for (const measurement of measurements) {
    const base = {
      route: measurement.route,
      unitId: measurement.unitId,
      lessonId: measurement.lessonId,
      pageId: measurement.pageId,
      pageNumber: measurement.pageNumber,
      viewportName: measurement.viewportName
    };
    if (measurement.bodyScrollHeight > measurement.bodyClientHeight + OVERFLOW_TOLERANCE_PX) {
      issues.push({
        ...base,
        issueId: "layout.page.vertical-scroll",
        reason: `Page content is taller than the viewport (${measurement.bodyScrollHeight}px > ${measurement.bodyClientHeight}px).`,
        requiredFix: "Reduce per-page content, adjust the image/text split, or improve responsive sizing so learners do not scroll during a page."
      });
    }
    if (measurement.bodyScrollWidth > measurement.bodyClientWidth + OVERFLOW_TOLERANCE_PX) {
      issues.push({
        ...base,
        issueId: "layout.page.horizontal-scroll",
        reason: `Page content is wider than the viewport (${measurement.bodyScrollWidth}px > ${measurement.bodyClientWidth}px).`,
        requiredFix: "Fix fixed-width elements or long unwrapped text so the deck does not horizontally scroll."
      });
    }
    if (measurement.imageCount === 0 || measurement.loadedImageCount < measurement.imageCount) {
      issues.push({
        ...base,
        issueId: "layout.image.not-loaded",
        reason: `Loaded ${measurement.loadedImageCount}/${measurement.imageCount} images in this page viewport.`,
        requiredFix: "Ensure each page references a preview-served PNG/WebP image and that it loads before publishing."
      });
    }
    for (const consoleError of measurement.consoleErrors) {
      issues.push({
        ...base,
        issueId: "layout.console-error",
        reason: consoleError,
        requiredFix: "Fix the runtime error or missing asset before marking the preview ready."
      });
    }
    for (const element of measurement.overflowingElements) {
      const verticalOverflow = element.scrollHeight > element.clientHeight + OVERFLOW_TOLERANCE_PX;
      const horizontalOverflow =
        element.scrollWidth !== undefined &&
        element.clientWidth !== undefined &&
        element.scrollWidth > element.clientWidth + OVERFLOW_TOLERANCE_PX;
      if (!verticalOverflow && !horizontalOverflow) {
        continue;
      }
      issues.push({
        ...base,
        issueId: "layout.element-overflow",
        reason: `${element.selector} content overflows its box.`,
        requiredFix: "Let the text rail fill available space without clipping, or reduce the page payload for this viewport."
      });
    }
  }
  return {
    status: issues.length > 0 ? "failed" : "passed",
    runId,
    checkedPageCount: new Set(measurements.map((measurement) => measurement.route)).size,
    checkedViewportCount: measurements.length,
    issues
  };
}

async function collectBrowserMeasurements(
  baseUrl: string,
  targets: PreviewLayoutSmokeTarget[],
  viewports: PreviewLayoutViewport[]
): Promise<PreviewLayoutMeasurement[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const measurements: PreviewLayoutMeasurement[] = [];
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        for (const target of targets) {
          measurements.push(await measureTargetPage(page, baseUrl, target, viewport));
        }
      } finally {
        await page.close();
      }
    }
    return measurements;
  } finally {
    await closeBrowser(browser);
  }
}

async function measureTargetPage(
  page: Page,
  baseUrl: string,
  target: PreviewLayoutSmokeTarget,
  viewport: PreviewLayoutViewport
): Promise<PreviewLayoutMeasurement> {
  const consoleErrors: string[] = [];
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(`${baseUrl}/${target.route}`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    `(() => {
      const text = (document.querySelector("main") && document.querySelector("main").innerText) || "";
      return text.includes("第 ${target.pageNumber} /") || text.includes("第 ${target.pageNumber}/");
    })()`,
    undefined,
    { timeout: 10_000 }
  );
  await page
    .waitForFunction(
      `(() => {
        const images = Array.from(document.images);
        return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      })()`,
      undefined,
      { timeout: 5_000 }
    )
    .catch(() => undefined);
  const metrics = (await page.evaluate(`(() => {
    const root = document.scrollingElement || document.documentElement;
    const images = Array.from(document.images);
    const loadedImages = images.filter((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    const observedElements = Array.from(document.querySelectorAll("[data-testid='knowledge-board'], main, [aria-label='知识板书正文区']"));
    return {
      bodyScrollHeight: root.scrollHeight,
      bodyClientHeight: root.clientHeight,
      bodyScrollWidth: root.scrollWidth,
      bodyClientWidth: root.clientWidth,
      imageCount: images.length,
      loadedImageCount: loadedImages.length,
      overflowingElements: observedElements.map((element) => ({
        selector: element.getAttribute("data-testid")
          ? "[data-testid=" + element.getAttribute("data-testid") + "]"
          : element.getAttribute("aria-label")
            ? "[aria-label=" + element.getAttribute("aria-label") + "]"
            : element.tagName.toLowerCase(),
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }))
    };
  })()`)) as BrowserLayoutMetrics;
  return {
    ...target,
    viewportName: viewport.name,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    ...metrics,
    consoleErrors
  };
}

async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}
