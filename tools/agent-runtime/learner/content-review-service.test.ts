import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ContentReviewService } from "./content-review-service.js";

describe("ContentReviewService", () => {
  test("creates round 1 critic brief from the published preview bundle", async () => {
    const root = await fixtureRoot("review-course");

    const result = await new ContentReviewService(root).prepareReview({ runId: "review-course" });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "review-course",
      round: 1,
      maxRounds: 3,
      reviewBriefPath: expect.stringContaining("round-001-content-review.json")
    });
    if (result.status !== "revision_required") {
      throw new Error(`expected revision_required, got ${result.status}`);
    }
    expect(result.codexInstruction).toContain("第 1 / 3 轮内容审核");
    expect(result.codexInstruction).toContain("挑刺");
    expect(result.codexInstruction).toContain("不要改 coursePack.units");

    const brief = JSON.parse(await readFile(result.reviewBriefPath, "utf8")) as Record<string, unknown>;
    expect(brief).toMatchObject({
      runId: "review-course",
      round: 1,
      maxRounds: 3,
      criticRole: "content-review-agent",
      targetQuality: {
        minScore: 90,
        learnerMode: "student_self_study_textbook"
      }
    });
    expect(JSON.stringify(brief)).toContain("第一条知识命题");
    expect(JSON.stringify(brief)).toContain("quality.page.source-synthesis-weak");
  });

  test("increments review rounds from previously written briefs", async () => {
    const root = await fixtureRoot("review-rounds");
    const service = new ContentReviewService(root);

    await service.prepareReview({ runId: "review-rounds" });
    const result = await service.prepareReview({ runId: "review-rounds" });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "review-rounds",
      round: 2,
      maxRounds: 3,
      reviewBriefPath: expect.stringContaining("round-002-content-review.json")
    });
  });

  test("stops after max review rounds", async () => {
    const root = await fixtureRoot("review-stop");
    const service = new ContentReviewService(root);

    await service.prepareReview({ runId: "review-stop", maxRounds: 2 });
    await service.prepareReview({ runId: "review-stop", maxRounds: 2 });
    const result = await service.prepareReview({ runId: "review-stop", maxRounds: 2 });

    expect(result).toMatchObject({
      status: "review_complete",
      runId: "review-stop",
      round: 2,
      maxRounds: 2,
      stopReason: "max review rounds reached; use the latest revised bundle for publishing"
    });
  });

  test("records a reviewer report with course metrics and state", async () => {
    const root = await fixtureRoot("review-report");
    const service = new ContentReviewService(root);

    const result = await service.recordReviewReport({
      runId: "review-report",
      round: 1,
      reviewerVerdict: "revise",
      summary: "页面仍有模板化栏目和未生成的教学插图。",
      issues: [
        {
          lessonId: "lesson-a",
          pageId: "page-01",
          severity: "major",
          category: "template_language",
          finding: "右侧栏目仍使用模板化标题。",
          recommendation: "改成与本页知识命题直接对应的小标题。"
        }
      ]
    });

    expect(result).toMatchObject({
      status: "review_report_recorded",
      runId: "review-report",
      round: 1,
      reportPath: expect.stringContaining("round-001-content-review-report.json"),
      statePath: expect.stringContaining("content-review-state.json"),
      metrics: {
        lessonCount: 1,
        pageCount: 1,
        templateLabelCount: 1,
        missingImagegenAssetCount: 1,
        lowDensityPageCount: 1,
        sourceAnchoredPageCount: 1,
        sourceTracePageCount: 1
      },
      delta: null
    });

    const report = JSON.parse(await readFile(result.reportPath, "utf8")) as Record<string, unknown>;
    expect(report).toMatchObject({
      reviewerVerdict: "revise",
      metrics: {
        templateLabelCount: 1,
        missingImagegenAssetCount: 1
      },
      issues: [
        expect.objectContaining({
          category: "template_language",
          severity: "major"
        })
      ]
    });
    await expect(readFile(result.statePath, "utf8")).resolves.toContain('"latestVerdict": "revise"');
  });

  test("records metric deltas between review rounds", async () => {
    const root = await fixtureRoot("review-delta");
    const service = new ContentReviewService(root);

    await service.recordReviewReport({
      runId: "review-delta",
      round: 1,
      reviewerVerdict: "revise",
      summary: "第一轮发现模板化和缺图。",
      issues: [
        {
          severity: "major",
          category: "template_language",
          finding: "存在模板化栏目。",
          recommendation: "改为内容专属栏目。"
        }
      ]
    });
    await writeDenseImagegenLesson(root, "review-delta");

    const result = await service.recordReviewReport({
      runId: "review-delta",
      round: 2,
      reviewerVerdict: "pass",
      summary: "第二轮修掉模板化栏目和缺图问题。",
      issues: []
    });

    expect(result).toMatchObject({
      status: "review_report_recorded",
      round: 2,
      metrics: {
        templateLabelCount: 0,
        missingImagegenAssetCount: 0,
        lowDensityPageCount: 0
      },
      delta: {
        templateLabelCount: -1,
        missingImagegenAssetCount: -1,
        lowDensityPageCount: -1,
        issueCount: -1
      }
    });
  });

  test("marks the third report as the final reviewer verdict", async () => {
    const root = await fixtureRoot("review-final");
    const service = new ContentReviewService(root);

    const result = await service.recordReviewReport({
      runId: "review-final",
      round: 3,
      reviewerVerdict: "pass",
      summary: "第三轮可作为最终内容基线进入 imagegen。",
      issues: []
    });

    expect(result).toMatchObject({
      status: "review_report_recorded",
      runId: "review-final",
      round: 3,
      finalVerdict: "pass"
    });
    await expect(readFile(result.statePath, "utf8")).resolves.toContain('"finalVerdict": "pass"');
  });
});

async function fixtureRoot(runId: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-review-"));
  const previewRoot = path.join(root, "runs", runId, "preview");
  await mkdir(path.join(previewRoot, "lessons"), { recursive: true });
  await mkdir(path.join(root, "runs", runId, "quality"), { recursive: true });
  await writeFile(
    path.join(previewRoot, "course-pack.json"),
    `${JSON.stringify(
      {
        id: runId,
        title: "测试课程",
        language: "zh-CN",
        units: [{ unitId: "unit-overview", title: "总览", kind: "overview", lessonId: "lesson-a", targetPageCount: 2 }]
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
        title: "测试课程总览",
        displayMode: "textbook_deck",
        pages: [
          {
            id: "page-01",
            title: "第一条知识命题",
            narrative: "中文解释。",
            sourceAnchorIds: ["book:p1"],
            visualSpec: {
              imageAlt: "用于解释第一条知识命题的教学插图"
            },
            knowledgeBoard: {
              headline: "第一条知识命题",
              coreProposition: "短。",
              leftColumn: [{ label: "机制链", items: ["一个机制"] }],
              rightColumn: [{ label: "例子边界", items: ["例如一个场景", "边界是另一个场景"] }],
              sourceTrace: [{ anchorId: "book:p1", supports: "来源支持这个命题。" }],
              bottomLine: "短。"
            }
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(root, "runs", runId, "quality", "course-quality-report.json"),
    `${JSON.stringify(
      {
        status: "warning",
        score: 85,
        topIssues: [
          {
            issueId: "quality.page.source-synthesis-weak",
            lessonId: "lesson-a",
            pageId: "page-01",
            requiredFix: "讲出来源材料中的具体关系。"
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

async function writeDenseImagegenLesson(root: string, runId: string): Promise<void> {
  await mkdir(path.join(root, "runs", runId, "preview", "images", "lesson-a"), { recursive: true });
  await writeFile(path.join(root, "runs", runId, "preview", "images", "lesson-a", "page-01-imagegen-v1.png"), "png", "utf8");
  await writeFile(
    path.join(root, "runs", runId, "preview", "lessons", "lesson-a.json"),
    `${JSON.stringify(
      {
        id: "lesson-a",
        title: "测试课程总览",
        displayMode: "textbook_deck",
        pages: [
          {
            id: "page-01",
            title: "第一条知识命题",
            narrative: "中文解释。",
            sourceAnchorIds: ["book:p1"],
            visualSpec: {
              imageAlt: "用于解释第一条知识命题的教学插图",
              imageUrl: "/__learning-preview/review-delta/images/lesson-a/page-01-imagegen-v1.png",
              imageProvider: "imagegen",
              imagePrompt: "教学插图。不要长段文字，不要表格，不要 UI 文本框。"
            },
            knowledgeBoard: {
              headline: "第一条知识命题",
              coreProposition:
                "这页解释一个具体知识关系：先把来源中的关键概念放到同一张关系图里，再说明变量改变时系统判断如何变化。",
              leftColumn: [
                {
                  label: "判断先后关系",
                  items: ["先识别约束条件", "再比较可变因素", "最后判断结论是否仍成立"]
                }
              ],
              rightColumn: [
                {
                  label: "例子与失效边界",
                  items: ["例子说明概念如何落地", "边界说明同一判断何时失效", "来源锚点支撑这两个判断"]
                }
              ],
              sourceTrace: [{ anchorId: "book:p1", supports: "来源支持这个命题。" }],
              bottomLine: "真正要记住的不是术语，而是这个判断在什么条件下成立、什么条件下会失效。"
            }
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}
