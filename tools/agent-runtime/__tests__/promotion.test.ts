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

  test("rejects approved lessons that fail product quality gates", async () => {
    const root = await createTempRoot();
    const runStore = new RunStore(root);
    const config = createRunConfigFromArgs({ topic: "哈希表", pages: "8", run: "hash-table-001" });
    const runPath = await runStore.createRun(config);
    const artifacts = new ArtifactStore(runPath);
    await artifacts.writeDraft("lesson", buildLesson({ targetPageCount: 8, qualityComplete: false }));
    const approvals = new ApprovalService(runPath, artifacts);
    await approvals.approve({
      gate: "lesson",
      runId: config.runId,
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });

    const service = new LessonPromotionService(root);

    await expect(service.promote(config.runId)).rejects.toThrow(/quality gate failed.*visual-count/s);
    await expect(stat(path.join(root, "src", "lessons", "hash-table", "lesson.ts"))).rejects.toMatchObject({
      code: "ENOENT"
    });
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
  actualPageCount = targetPageCount,
  qualityComplete = true
}: {
  id?: string;
  targetPageCount: number;
  actualPageCount?: number;
  qualityComplete?: boolean;
}): Record<string, unknown> {
  if (!qualityComplete) {
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

  const completePageTypes = [
    "problem_scene",
    "intuition_visual",
    "structure_diagram",
    "interactive_model",
    "interactive_model",
    "quiz",
    "misconception_check",
    "summary_card"
  ];

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
    pages: Array.from({ length: actualPageCount }, (_, index) =>
      buildQualityPage(`p${index + 1}`, completePageTypes[index % completePageTypes.length] ?? "problem_scene")
    ),
    misconceptions: [{ id: "m1", statement: "哈希表永远 O(1)", correction: "冲突严重时会变慢。" }],
    transferTasks: [{ id: "t1", prompt: "迁移到缓存 key 设计", targetMentalModel: "用搜索空间缩小理解加速。" }],
    summary: ["哈希表用 key 定位 bucket。"]
  };
}

function buildQualityPage(id: string, type: string): Record<string, unknown> {
  const base = {
    id,
    type,
    title: `第 ${id.slice(1)} 页`,
    learningGoal: "建立中文心智模型",
    narrative: "中文内容"
  };
  if (["problem_scene", "intuition_visual", "structure_diagram", "summary_card"].includes(type)) {
    return {
      ...base,
      visualSpec: {
        kind: "diagram",
        description: "中文图示",
        keyElements: ["元素一", "元素二"]
      }
    };
  }
  if (type === "interactive_model") {
    return {
      ...base,
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择一个路径",
        expectedObservation: "看到访问范围变化",
        cognitivePurpose: "理解访问路径",
        options: [
          {
            id: "a",
            label: "选择 A",
            resultTitle: "索引路径",
            outcomeId: "indexed",
            resultTone: "success",
            explanation: "因为 key 能缩小候选范围。"
          }
        ]
      }
    };
  }
  return {
    ...base,
    assessmentSpec: {
      kind: "multiple_choice",
      prompt: "哪种情况更适合索引？",
      options: ["高选择性查询", "全表都要读"],
      correctAnswer: "高选择性查询"
    },
    feedbackSpec: {
      correctFeedback: "正确，因为候选范围显著缩小。",
      incorrectFeedback: "不对，这忽略了选择性。"
    }
  };
}
