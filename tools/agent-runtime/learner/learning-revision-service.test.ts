import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { LearningRevisionService } from "./learning-revision-service.js";

describe("LearningRevisionService", () => {
  test("records learner feedback as a revision brief for Codex-authored republish", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-revision-"));
    const service = new LearningRevisionService(root);

    const result = await service.requestRevision({
      runId: "feedback-course",
      feedback: "整体太难了，请减少术语、增加一个生活化例子，并保留中文解释。",
      focus: "difficulty"
    });

    expect(result).toMatchObject({
      status: "revision_brief_ready",
      runId: "feedback-course",
      revisionId: "revision-001",
      next: {
        recommendedTool: "learning_agent.publish_learning_course"
      }
    });
    await expect(readFile(result.revisionBriefPath, "utf8")).resolves.toContain("整体太难了");
  });
});
