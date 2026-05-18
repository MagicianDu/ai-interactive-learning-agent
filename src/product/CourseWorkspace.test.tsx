import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { CourseWorkspace } from "./CourseWorkspace";
import { learningProgressStorageKey } from "./learning-progress";

describe("CourseWorkspace", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "#/");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new MemoryStorage()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState(null, "", "#/");
  });

  test("opens the learner project library by default instead of a developer demo route", () => {
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.getByText("选择要继续学习的课程")).toBeInTheDocument();
    expect(screen.queryByText("当前学习单元")).not.toBeInTheDocument();
    expect(screen.queryByText("视图：项目库")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "课程结构" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "来源依据" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目库" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "下一页" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("生成进度")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("分享和导出")).not.toBeInTheDocument();
    expect(screen.queryByText("把技术资料变成可交互的中文学习体验")).not.toBeInTheDocument();
    expect(screen.queryByText("讨论")).not.toBeInTheDocument();
    expect(screen.queryByText("设置")).not.toBeInTheDocument();
  });

  test("opens the latest generated preview by default when the local preview index is available", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockGeneratedPreviewFetch({
      "fresh-preview": {
        courseTitle: "最新生成课程包",
        lessonTitle: "最新生成总览课",
        pageTitle: "最新生成第一页",
        imageUrl: "/__learning-preview/fresh-preview/images/fresh-preview-overview/page-01-imagegen-v1.png"
      }
    }, { latestRunId: "fresh-preview" }));

    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect((await screen.findAllByText("最新生成第一页")).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "最新生成插图" })).toBeInTheDocument();
    expect(screen.queryByText("选择要继续学习的课程")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/preview/fresh-preview/unit/unit-overview/page/1");
  });

  test("upgrades legacy sample course routes to the latest generated preview when available", async () => {
    window.history.replaceState(null, "", "#/course/demo-course-pack/unit/unit-overview/page/1");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockGeneratedPreviewFetch({
      "fresh-preview": {
        courseTitle: "最新生成课程包",
        lessonTitle: "最新生成总览课",
        pageTitle: "最新生成第一页",
        imageUrl: "/__learning-preview/fresh-preview/images/fresh-preview-overview/page-01-imagegen-v1.png"
      }
    }, { latestRunId: "fresh-preview" }));

    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect((await screen.findAllByText("最新生成第一页")).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "最新生成插图" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#/preview/fresh-preview/unit/unit-overview/page/1");
  });

  test("uses a fixed learning viewport without body vertical scroll", () => {
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.getByTestId("learning-main-viewport")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("desktop-learning-sidebar")).toHaveClass("hidden", "lg:block");
    expect(screen.getByTestId("learning-view-viewport")).toHaveClass("h-full", "overflow-hidden");
    expect(screen.queryByTestId("workspace-status-strip")).not.toBeInTheDocument();
    expect(getComputedStyle(document.body).overflow).toBe("hidden");
    expect(document.body.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
  });

  test("opens the course, unit, and page from a stable hash route", () => {
    const routedCourse = coursePackRegistry.find((entry) => entry.coursePack.units.some((unit) => unit.lessonId));
    const routedUnit = routedCourse?.coursePack.units.find((unit) => unit.lessonId);
    if (!routedCourse || !routedUnit) {
      throw new Error("expected at least one routable course pack");
    }
    window.history.replaceState(null, "", `#/course/${routedCourse.id}/unit/${routedUnit.unitId}/page/2`);

    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.getAllByText(/第 2 \//).length).toBeGreaterThan(0);
    expect(window.location.hash).toBe(`#/course/${routedCourse.id}/unit/${routedUnit.unitId}/page/2`);
  });

  test("opens a clean generated preview route without registered source modules", async () => {
    window.history.replaceState(null, "", "#/preview/public-smoke/unit/unit-overview/page/2");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/__learning-preview/public-smoke/manifest.json") {
        return jsonResponse({
          schemaVersion: 1,
          runId: "public-smoke",
          coursePackId: "public-smoke",
          courseTitle: "公开示例：课程包",
          coursePackPath: "course-pack.json",
          lessonPaths: ["lessons/public-smoke-overview.json"],
          publishNotes: "revision-002: 补充来源依据和学习反馈。",
          qualityReport: {
            status: "passed",
            score: 96,
            summary: "课程质量检查通过。"
          },
          revisionHistory: [
            {
              runId: "public-smoke",
              revisionId: "revision-002",
              scope: "page",
              summary: "第 2 页补充来源依据。",
              changedLessonIds: ["public-smoke-overview"],
              changedPages: [{ lessonId: "public-smoke-overview", pageId: "page-02", pageNumber: 2 }],
              qualityStatus: "passed",
              createdAt: "2026-05-06T00:00:00.000Z"
            }
          ]
        });
      }
      if (url === "/__learning-preview/public-smoke/course-pack.json") {
        return jsonResponse({
          id: "public-smoke",
          title: "公开示例：课程包",
          parentRunId: "public-smoke",
          sourceKind: "blog",
          strategy: "overview_plus_topic",
          units: [
            {
              unitId: "unit-overview",
              title: "公开示例：总览课",
              kind: "overview",
              lessonId: "public-smoke-overview",
              targetPageCount: 2,
              sourceAnchorIds: ["source-001:page-1"],
              conceptIds: ["overview"]
            }
          ]
        });
      }
      if (url === "/__learning-preview/public-smoke/lessons/public-smoke-overview.json") {
        return jsonResponse({
          id: "public-smoke-overview",
          title: "公开示例：总览课",
          audience: "中文学习者",
          config: { targetPageCount: 2 },
          prerequisites: ["能阅读中文技术材料"],
          learningObjectives: ["建立总览心智模型"],
          pages: [
            {
              id: "page-01",
              type: "problem_scene",
              title: "第一页",
              learningGoal: "看到问题",
              narrative: "用问题进入学习。"
            },
            {
              id: "page-02",
              type: "summary_card",
              title: "第二页",
              learningGoal: "压缩模型",
              narrative: "用中文总结结构。"
            }
          ],
          misconceptions: [],
          transferTasks: [],
          summary: ["问题、结构、迁移"]
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect((await screen.findAllByText("公开示例：课程包")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/第 2 \//).length).toBeGreaterThan(0);
    expect(screen.queryByText("质量：passed · 96")).not.toBeInTheDocument();
    expect(screen.queryByText("发布：revision-002: 补充来源依据和学习反馈。")).not.toBeInTheDocument();
    expect(screen.queryByText("修订历史")).not.toBeInTheDocument();
    expect(screen.queryByText("revision-002")).not.toBeInTheDocument();
    expect(screen.queryByText("第 2 页补充来源依据。")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/preview/public-smoke/unit/unit-overview/page/2");
  });

  test("reloads generated preview content when the hash changes to another preview run", async () => {
    window.history.replaceState(null, "", "#/preview/public-smoke/unit/unit-overview/page/1");
    vi.spyOn(globalThis, "fetch").mockImplementation(mockGeneratedPreviewFetch({
      "public-smoke": {
        courseTitle: "公开示例：课程包",
        lessonTitle: "公开示例：总览课",
        pageTitle: "第一页"
      },
      "second-smoke": {
        courseTitle: "第二示例：课程包",
        lessonTitle: "第二示例：总览课",
        pageTitle: "第二示例第一页"
      }
    }));

    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(await screen.findByText("第一页")).toBeInTheDocument();

    window.location.hash = "#/preview/second-smoke/unit/unit-overview/page/1";
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    await waitFor(() => {
      expect(screen.getByText("第二示例第一页")).toBeInTheDocument();
    });
    expect(screen.queryByText("第一页")).not.toBeInTheDocument();
  });

  test("updates the stable hash route when the learner changes page", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", defaultLearningRoute());
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(window.location.hash).toMatch(/^#\/course\/[a-z0-9-]+\/unit\/[a-z0-9-]+\/page\/2$/u);
  });

  test("opens the learner project library without replacing the default learning flow", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", defaultLearningRoute());
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.queryByText("选择要继续学习的课程")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "项目库" }));

    expect(screen.getByText("选择要继续学习的课程")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /打开 /u }).length).toBeGreaterThan(0);
  });

  test("default sidebar shows the learner core views and hides future modes", () => {
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.getByRole("button", { name: "学习" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "来源依据" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目库" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "知识地图" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "教师" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "实验" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导师" })).not.toBeInTheDocument();
  });

  test("opens source grounding as a course-aware learner page", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", defaultLearningRoute());
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    await user.click(screen.getByRole("button", { name: "来源依据" }));

    expect(screen.getByRole("heading", { name: "来源依据" })).toBeInTheDocument();
    expect(screen.getByText("当前页来源锚点")).toBeInTheDocument();
    expect(screen.getByText("课程来源覆盖")).toBeInTheDocument();
    expect(screen.getByText("单元来源映射")).toBeInTheDocument();
  });

  test("hides sidebar learning telemetry while preserving local page visits", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", defaultLearningRoute());
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.queryByText("完成进度")).not.toBeInTheDocument();
    expect(screen.queryByText(/答题记录/u)).not.toBeInTheDocument();
    expect(screen.queryByText("本页反馈")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "太抽象" })).not.toBeInTheDocument();
    expect(screen.queryByText(/来源锚点 \d+/u)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一页" }));

    const progress = JSON.parse(window.localStorage.getItem(learningProgressStorageKey) ?? "{}") as {
      completedPages?: string[];
    };

    expect(progress.completedPages?.length).toBeGreaterThanOrEqual(2);
  });

  test("keeps revision history out of the learner sidebar", () => {
    window.localStorage.setItem(
      learningProgressStorageKey,
      JSON.stringify({
        completedPages: [],
        quizAttempts: [],
        feedbackBriefs: [],
        revisionHistory: [
          {
            runId: "demo-agentic-design-grounded",
            revisionId: "revision-001",
            scope: "page",
            summary: "第 3 页增加了工程例子。",
            changedLessonIds: ["demo-agentic-design-grounded-overview"],
            changedPages: [{ lessonId: "demo-agentic-design-grounded-overview", pageId: "p3", pageNumber: 3 }],
            qualityStatus: "passed",
            createdAt: "2026-05-06T00:00:00.000Z"
          }
        ]
      })
    );

    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.queryByText("修订历史")).not.toBeInTheDocument();
    expect(screen.queryByText("revision-001")).not.toBeInTheDocument();
    expect(screen.queryByText("第 3 页增加了工程例子。")).not.toBeInTheDocument();
    expect(screen.queryByText("质量：passed")).not.toBeInTheDocument();
  });

});

function defaultLearningRoute(): string {
  return "#/course/demo-agentic-design-grounded/unit/unit-overview/page/1";
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

function mockGeneratedPreviewFetch(
  previews: Record<string, { courseTitle: string; lessonTitle: string; pageTitle: string; imageUrl?: string }>,
  options: { latestRunId?: string } = {}
): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url === "/__learning-preview/index.json") {
      const latestRunId = options.latestRunId;
      if (!latestRunId) {
        return jsonResponse({ previews: [] });
      }
      const latest = previews[latestRunId];
      if (!latest) {
        throw new Error(`unexpected latest preview run: ${latestRunId}`);
      }
      return jsonResponse({
        previews: [
          {
            runId: latestRunId,
            courseTitle: latest.courseTitle,
            updatedAt: "2026-05-18T00:00:00.000Z"
          }
        ]
      });
    }

    const match = /^\/__learning-preview\/(?<runId>[a-z0-9-]+)\/(?<assetPath>.+)$/u.exec(url);
    if (!match?.groups) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    const preview = previews[match.groups.runId];
    if (!preview) {
      throw new Error(`unexpected preview run: ${match.groups.runId}`);
    }

    if (match.groups.assetPath === "manifest.json") {
      return jsonResponse({
        schemaVersion: 1,
        runId: match.groups.runId,
        coursePackId: match.groups.runId,
        courseTitle: preview.courseTitle,
        coursePackPath: "course-pack.json",
        lessonPaths: [`lessons/${match.groups.runId}-overview.json`]
      });
    }

    if (match.groups.assetPath === "course-pack.json") {
      return jsonResponse({
        id: match.groups.runId,
        title: preview.courseTitle,
        parentRunId: match.groups.runId,
        sourceKind: "blog",
        strategy: "overview_plus_topic",
        units: [
          {
            unitId: "unit-overview",
            title: preview.lessonTitle,
            kind: "overview",
            lessonId: `${match.groups.runId}-overview`,
            targetPageCount: 1,
            sourceAnchorIds: ["source-001:page-1"],
            conceptIds: ["overview"]
          }
        ]
      });
    }

    if (match.groups.assetPath === `lessons/${match.groups.runId}-overview.json`) {
      return jsonResponse({
        id: `${match.groups.runId}-overview`,
        title: preview.lessonTitle,
        displayMode: "textbook_deck",
        audience: "中文学习者",
        config: { targetPageCount: 1 },
        prerequisites: ["能阅读中文技术材料"],
        learningObjectives: ["建立总览心智模型"],
        pages: [
          {
            id: "page-01",
            type: "summary_card",
            title: preview.pageTitle,
            learningGoal: "压缩模型",
            narrative: "用中文总结结构。",
            ...(preview.imageUrl
              ? {
                  visualSpec: {
                    kind: "diagram",
                    description: "最新生成插图",
                    keyElements: ["问题", "机制", "边界"],
                    imageUrl: preview.imageUrl,
                    imageAlt: "最新生成插图",
                    imageProvider: "imagegen"
                  },
                  knowledgeBoard: {
                    boardKind: "synthesis_board",
                    headline: "最新生成知识板书",
                    coreProposition: "最新生成内容应该优先进入学习页。",
                    leftColumn: [
                      {
                        label: "判断",
                        items: ["入口应读取最新 preview，而不是旧样例。"],
                        emphasis: "mechanism"
                      }
                    ],
                    rightColumn: [
                      {
                        label: "证据",
                        items: ["页面带有 imagegen 图片。"],
                        emphasis: "example"
                      }
                    ],
                    sourceTrace: [],
                    bottomLine: "本地最新 preview 是学习入口的优先内容。"
                  }
                }
              : {})
          }
        ],
        misconceptions: [],
        transferTasks: [],
        summary: ["问题、结构、迁移"]
      });
    }

    throw new Error(`unexpected fetch: ${url}`);
  };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
