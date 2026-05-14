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
              coreProposition: "这页要讲清一个具体知识关系。",
              leftColumn: [{ label: "关键关系", items: ["一个机制", "一个变化"] }],
              rightColumn: [{ label: "例子边界", items: ["例如一个场景", "边界是另一个场景"] }],
              sourceTrace: [{ anchorId: "book:p1", supports: "来源支持这个命题。" }],
              bottomLine: "记住这个知识关系。"
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
