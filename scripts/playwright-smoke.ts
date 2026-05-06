import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const runId = "playwright-smoke-preview";
const host = "127.0.0.1";
const port = 5173;
const baseUrl = `http://${host}:${port}`;

export async function runPlaywrightSmoke(workspaceRoot: string = process.cwd()): Promise<void> {
  await prepareGeneratedPreview(workspaceRoot);
  const server = startDevServer();
  const consoleErrors: string[] = [];

  try {
    await waitForServer(baseUrl);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));

      await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
      await page.getByText("智能体工作流公开示例：课程包").first().waitFor({ timeout: 10_000 });

      const previewPage = await browser.newPage();
      previewPage.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      previewPage.on("pageerror", (error) => consoleErrors.push(error.message));
      await previewPage.goto(`${baseUrl}/#/preview/${runId}`, { waitUntil: "networkidle" });
      await previewPage.getByText("Playwright公开预览：课程包").first().waitFor({ timeout: 10_000 });
      await previewPage.getByRole("button", { name: "下一页" }).click();
      await previewPage.getByText(/第 2 \//u).first().waitFor({ timeout: 10_000 });

      if (consoleErrors.length > 0) {
        throw new Error(`browser console errors:\n${consoleErrors.join("\n")}`);
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill("SIGTERM");
    await waitForExit(server);
  }

  console.log("[playwright-smoke] passed");
}

async function prepareGeneratedPreview(workspaceRoot: string): Promise<void> {
  const runRoot = path.join(workspaceRoot, "runs", runId);
  const previewRoot = path.join(runRoot, "preview");
  await rm(runRoot, { force: true, recursive: true });
  await mkdir(path.join(previewRoot, "lessons"), { recursive: true });

  const coursePack = {
    id: runId,
    title: "Playwright公开预览：课程包",
    parentRunId: runId,
    sourceKind: "book",
    strategy: "overview_plus_topic",
    audience: "中文学习者",
    language: "zh-CN",
    units: [
      {
        unitId: "unit-overview",
        title: "Playwright公开预览：总览课",
        kind: "overview",
        lessonId: "playwright-smoke-overview",
        targetPageCount: 2,
        sourceAnchorIds: ["source-001:page-1"],
        conceptIds: ["overview"]
      }
    ]
  };
  const lesson = {
    id: "playwright-smoke-overview",
    title: "Playwright公开预览：总览课",
    audience: "中文学习者",
    config: { targetPageCount: 2 },
    prerequisites: ["能阅读中文技术材料"],
    learningObjectives: ["建立预览运行时心智模型"],
    pages: [
      {
        id: "page-01",
        type: "problem_scene",
        title: "为什么要清理预览运行时",
        learningGoal: "理解生成预览不应该污染 src",
        narrative: "预览课程应该从 runs 读取，让公开仓库保持干净。",
        sourceAnchorIds: ["source-001:page-1"],
        visualSpec: {
          kind: "diagram",
          description: "展示 runs 预览目录到浏览器预览路由的关系。",
          keyElements: ["runs", "preview", "manifest", "browser"]
        }
      },
      {
        id: "page-02",
        type: "summary_card",
        title: "记住这条路径",
        learningGoal: "确认预览路由可翻页",
        narrative: "生成预览写入 runs/<run-id>/preview，浏览器通过 #/preview/<run-id> 打开。",
        sourceAnchorIds: ["source-001:page-1"]
      }
    ],
    misconceptions: [{ id: "m1", statement: "预览必须写入 src。", correction: "预览可以通过 JSON manifest 运行。" }],
    transferTasks: [{ id: "t1", prompt: "把同样路径迁移到另一份公开 mock source。", targetMentalModel: "运行时输出和源码 fixtures 分离。" }],
    summary: ["预览输出在 runs。", "源码 fixtures 只由维护者显式生成。"]
  };
  const manifest = {
    schemaVersion: 1,
    status: "preview_ready",
    outputMode: "preview",
    runId,
    coursePackId: runId,
    courseTitle: coursePack.title,
    lessonCount: 1,
    coursePackPath: "course-pack.json",
    lessonPaths: ["lessons/playwright-smoke-overview.json"]
  };

  await writeJson(path.join(previewRoot, "course-pack.json"), coursePack);
  await writeJson(path.join(previewRoot, "lessons", "playwright-smoke-overview.json"), lesson);
  await writeJson(path.join(previewRoot, "manifest.json"), manifest);
}

function startDevServer(): ChildProcess {
  const child = spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"], {
    env: { ...process.env, BROWSER: "none" },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));
  return child;
}

async function waitForServer(url: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(250);
    }
  }
  throw new Error(`dev server did not start: ${url}`);
}

async function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    setTimeout(resolve, 2_000);
  });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runPlaywrightSmoke();
}
