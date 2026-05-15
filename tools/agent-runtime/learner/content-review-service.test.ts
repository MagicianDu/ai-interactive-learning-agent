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
        sourceTracePageCount: 1,
        genericSourceTraceSupportCount: 1,
        staleVisualPromptCount: 1,
        titleDuplicatedInImagePromptCount: 0,
        mechanismDepthWeakPageCount: 1
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
        lowDensityPageCount: 0,
        genericSourceTraceSupportCount: 0,
        staleVisualPromptCount: 0,
        titleDuplicatedInImagePromptCount: 0,
        mechanismDepthWeakPageCount: 0
      },
      delta: {
        templateLabelCount: -1,
        missingImagegenAssetCount: -1,
        lowDensityPageCount: -1,
        genericSourceTraceSupportCount: -1,
        staleVisualPromptCount: -1,
        titleDuplicatedInImagePromptCount: 0,
        mechanismDepthWeakPageCount: -1,
        issueCount: -1
      }
    });
  });

  test("measures semantic review gaps beyond structural compliance", async () => {
    const root = await fixtureRoot("semantic-gaps");
    await writeSemanticGapLesson(root, "semantic-gaps");

    const result = await new ContentReviewService(root).recordReviewReport({
      runId: "semantic-gaps",
      round: 1,
      reviewerVerdict: "revise",
      summary: "结构合规，但来源支撑、图片提示和机制深度仍弱。",
      issues: [
        {
          severity: "major",
          category: "source_fidelity",
          finding: "sourceTrace 仍是泛化支撑句。",
          recommendation: "改成页面命题对应的具体来源说明。"
        }
      ]
    });

    expect(result.metrics).toMatchObject({
      pageCount: 3,
      templateLabelCount: 0,
      missingImagegenAssetCount: 0,
      genericTitleCount: 0,
      lowDensityPageCount: 0,
      genericSourceTraceSupportCount: 1,
      staleVisualPromptCount: 1,
      titleDuplicatedInImagePromptCount: 1,
      mechanismDepthWeakPageCount: 1
    });

    const report = JSON.parse(await readFile(result.reportPath, "utf8")) as Record<string, unknown>;
    expect(report).toMatchObject({
      metrics: {
        genericSourceTraceSupportCount: 1,
        staleVisualPromptCount: 1,
        titleDuplicatedInImagePromptCount: 1,
        mechanismDepthWeakPageCount: 1
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
              sourceTrace: [{ anchorId: "book:p1", supports: "来源给出了判断条件、变量变化和失效边界。" }],
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

async function writeSemanticGapLesson(root: string, runId: string): Promise<void> {
  await mkdir(path.join(root, "runs", runId, "preview", "images", "lesson-a"), { recursive: true });
  for (const pageId of ["page-01", "page-02", "page-03"]) {
    await writeFile(path.join(root, "runs", runId, "preview", "images", "lesson-a", `${pageId}-imagegen-v1.png`), "png", "utf8");
  }
  await writeFile(
    path.join(root, "runs", runId, "preview", "lessons", "lesson-a.json"),
    `${JSON.stringify(
      {
        id: "lesson-a",
        title: "语义指标样本",
        displayMode: "textbook_deck",
        pages: [
          semanticPage({
            id: "page-01",
            title: "来源支撑必须具体",
            imagePrompt: "生成教学插图，表现来源锚点如何支撑页面命题。不要长段文字，不要表格，不要 UI 文本框。",
            sourceSupports: "支撑本页核心命题",
            leftItems: ["来源段落给出条件 A", "条件 A 改变时结论 B 改变"],
            rightItems: ["例子说明 A 到 B", "边界说明 C 时不成立"]
          }),
          semanticPage({
            id: "page-02",
            title: "图片提示不能过期",
            imagePrompt: "生成一张中文 Web Deck 教学插图，只表达“图片提示不能过期”这一页的核心知识关系：图片提示不能过期。不要长段文字，不要表格，不要 UI 文本框。",
            sourceSupports: "来源指出图片提示要跟机制链同步。",
            leftItems: ["机制从输入走向判断", "判断再走向边界"],
            rightItems: ["例子是 prompt 只重复标题", "边界是图像没有解释机制"]
          }),
          semanticPage({
            id: "page-03",
            title: "机制深度不足",
            imagePrompt: "生成教学插图，画面中心表现：输入条件 -> 输出判断 -> 失效边界。不要长段文字，不要表格，不要 UI 文本框。",
            sourceSupports: "来源说明机制链需要讲出条件和边界。",
            leftItems: ["一个机制"],
            rightItems: ["一个例子"]
          })
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function semanticPage(input: {
  id: string;
  title: string;
  imagePrompt: string;
  sourceSupports: string;
  leftItems: string[];
  rightItems: string[];
}): Record<string, unknown> {
  return {
    id: input.id,
    title: input.title,
    narrative: "这页有足够长度的中文解释，用来避免被低密度指标误判，同时保留语义质量缺口。",
    sourceAnchorIds: ["book:p1"],
    visualSpec: {
      imageUrl: `/__learning-preview/semantic-gaps/images/lesson-a/${input.id}-imagegen-v1.png`,
      imageProvider: "imagegen",
      imageAlt: "教学插图",
      imagePrompt: input.imagePrompt
    },
    knowledgeBoard: {
      headline: input.title,
      coreProposition:
        "这页用于验证结构合规不等于语义合格：来源支撑要具体，图片提示要跟机制同步，机制链要包含条件、变化、结果和边界。",
      leftColumn: [{ label: "条件如何改变判断", items: input.leftItems }],
      rightColumn: [{ label: "例子和边界如何校准", items: input.rightItems }],
      sourceTrace: [{ anchorId: "book:p1", supports: input.sourceSupports }],
      bottomLine: "真正的质量门禁要能抓住语义泛化、图文不同步和机制深度不足。"
    }
  };
}
