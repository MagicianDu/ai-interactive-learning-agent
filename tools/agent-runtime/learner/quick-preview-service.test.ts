import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { LearnerProjectService } from "./learner-project-service.js";
import { QuickPreviewService } from "./quick-preview-service.js";

describe("QuickPreviewService", () => {
  test("auto-advances internal gates and returns preview without learner approval", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "quick-preview-"));
    const sourcePath = path.join(root, "notes.md");
    await writeFile(sourcePath, "# 哈希表\n哈希表通过 key 到 bucket 的映射减少搜索空间。", "utf8");
    await new LearnerProjectService(root).createProject({
      request: `请用 ${sourcePath} 生成中文学习材料，面向有编程基础的学习者，教学难度为本科核心课程，每个单元 8 页。`,
      runId: "quick-hash"
    });

    const result = await new QuickPreviewService(root).generate({ runId: "quick-hash", maxSteps: 80 });

    expect(result).toMatchObject({
      status: "preview_ready",
      runId: "quick-hash",
      preview: { devCommand: "npm run dev", localUrl: "http://127.0.0.1:5173/" }
    });
    expect(result.autoApprovedGates).toEqual(
      expect.arrayContaining(["source-map", "concept-map", "curriculum-plan", "learning-architecture", "lesson", "critic-report"])
    );
  }, 15000);
});
