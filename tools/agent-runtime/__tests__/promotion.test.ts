import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { ApprovalService } from "../approval-service.js";
import { ArtifactStore } from "../artifact-store.js";
import { LessonPromotionService } from "../promotion/lesson-promotion-service.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LessonPromotionService", () => {
  test("promotes approved lesson without assuming ten pages", async () => {
    const root = await createTempRoot();
    const runStore = new RunStore(root);
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-001" });
    const runPath = await runStore.createRun(config);
    const artifacts = new ArtifactStore(runPath);
    await artifacts.writeDraft("lesson", buildLesson({ targetPageCount: 8 }));
    const approvals = new ApprovalService(runPath, artifacts);
    await approvals.approve({
      gate: "lesson",
      runId: config.runId,
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });

    const service = new LessonPromotionService(root);
    const result = await service.promote(config.runId);

    expect(result.lessonId).toBe("hash-table");
    expect(result.lessonPath).toBe(path.join(root, "src", "lessons", "hash-table", "lesson.ts"));
    await expect(readFile(result.lessonPath, "utf8")).resolves.toContain("targetPageCount: 8");
  });

  test("rejects approved lessons whose pages do not match targetPageCount", async () => {
    const root = await createTempRoot();
    const runStore = new RunStore(root);
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-001" });
    const runPath = await runStore.createRun(config);
    const artifacts = new ArtifactStore(runPath);
    await artifacts.writeDraft("lesson", buildLesson({ targetPageCount: 8, actualPageCount: 7 }));
    const approvals = new ApprovalService(runPath, artifacts);
    await approvals.approve({
      gate: "lesson",
      runId: config.runId,
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });

    const service = new LessonPromotionService(root);

    await expect(service.promote(config.runId)).rejects.toThrow(/pages length must match targetPageCount/);
    await expect(stat(path.join(root, "src", "lessons", "hash-table", "lesson.ts"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("rejects unsafe lesson ids before writing outside the lessons directory", async () => {
    const root = await createTempRoot();
    const runStore = new RunStore(root);
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-001" });
    const runPath = await runStore.createRun(config);
    const artifacts = new ArtifactStore(runPath);
    await artifacts.writeDraft("lesson", buildLesson({ id: "../outside", targetPageCount: 8 }));
    const approvals = new ApprovalService(runPath, artifacts);
    await approvals.approve({
      gate: "lesson",
      runId: config.runId,
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });

    const service = new LessonPromotionService(root);

    await expect(service.promote(config.runId)).rejects.toThrow(/lesson.id must match/);
    await expect(stat(path.join(root, "src", "outside", "lesson.ts"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects invalid misconception objects before writing promoted lesson", async () => {
    const root = await createTempRoot();
    const runStore = new RunStore(root);
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-001" });
    const runPath = await runStore.createRun(config);
    const artifacts = new ArtifactStore(runPath);
    const lesson = buildLesson({ targetPageCount: 8 });
    lesson.misconceptions = [{}];
    await artifacts.writeDraft("lesson", lesson);
    const approvals = new ApprovalService(runPath, artifacts);
    await approvals.approve({
      gate: "lesson",
      runId: config.runId,
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });

    const service = new LessonPromotionService(root);

    await expect(service.promote(config.runId)).rejects.toThrow(/misconception is missing required strings/);
    await expect(stat(path.join(root, "src", "lessons", "hash-table", "lesson.ts"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("rejects invalid interactionSpec.kind before writing promoted lesson", async () => {
    const root = await createTempRoot();
    const runStore = new RunStore(root);
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-001" });
    const runPath = await runStore.createRun(config);
    const artifacts = new ArtifactStore(runPath);
    const lesson = buildLesson({ targetPageCount: 8 });
    const pages = lesson.pages;
    if (!Array.isArray(pages) || typeof pages[0] !== "object" || pages[0] === null) {
      throw new Error("test lesson pages were not created");
    }
    pages[0].interactionSpec = {
      kind: "decorative_hover",
      learnerAction: "选择一个条件",
      expectedObservation: "看到路径变化",
      cognitivePurpose: "理解访问路径"
    };
    await artifacts.writeDraft("lesson", lesson);
    const approvals = new ApprovalService(runPath, artifacts);
    await approvals.approve({
      gate: "lesson",
      runId: config.runId,
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });

    const service = new LessonPromotionService(root);

    await expect(service.promote(config.runId)).rejects.toThrow(/interactionSpec has invalid kind/);
    await expect(stat(path.join(root, "src", "lessons", "hash-table", "lesson.ts"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("rejects unsafe run ids before reading outside runs", async () => {
    const root = await createTempRoot();
    const service = new LessonPromotionService(root);

    await expect(service.promote("../outside")).rejects.toThrow(/runId must match/);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "agent-runtime-promotion-"));
  tempRoots.push(root);
  return root;
}

function buildLesson({
  id = "hash-table",
  targetPageCount,
  actualPageCount = targetPageCount
}: {
  id?: string;
  targetPageCount: number;
  actualPageCount?: number;
}): Record<string, unknown> {
  return {
    id,
    title: "哈希表为什么快",
    audience: "中文学习者",
    config: {
      targetPageCount,
      minPageCount: 6,
      maxPageCount: 12
    },
    prerequisites: [],
    learningObjectives: ["解释哈希表的访问路径"],
    pages: Array.from({ length: actualPageCount }, (_, index) => ({
      id: `p${index + 1}`,
      type: index === actualPageCount - 1 ? "summary_card" : "problem_scene",
      title: `第 ${index + 1} 页`,
      learningGoal: "建立理解",
      narrative: "中文内容"
    })),
    misconceptions: [],
    transferTasks: [],
    summary: ["哈希表用 key 定位 bucket。"]
  };
}
