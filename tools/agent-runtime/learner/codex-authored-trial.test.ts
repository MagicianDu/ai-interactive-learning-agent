import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { CodexAuthoredTrialService } from "./codex-authored-trial.js";

describe("CodexAuthoredTrialService", () => {
  test("publishes a source-grounded Codex-authored trial bundle in an isolated workspace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-authored-trial-"));
    const sourcePath = path.join(root, "source.pdf");

    const result = await new CodexAuthoredTrialService(root).runTrial({
      runId: "trial-book",
      sourcePath,
      sourceKind: "book",
      audience: "有编程基础但缺少智能体系统心智模型的中文学习者",
      unitPages: 8
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      runId: "trial-book",
      coursePackId: "trial-book",
      preview: {
        devCommand: "npm run dev",
        localUrl: "http://127.0.0.1:5173/"
      }
    });
    await expect(readFile(path.join(root, "src", "lessons", "trial-book-overview", "lesson.ts"), "utf8")).resolves.toContain(
      "sourceContext"
    );
  });
});
