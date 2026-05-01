import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { realSourceRegressionSamples, runRealSourceRegressionSuite } from "./real-source-regression.js";

describe("real source regression suite", () => {
  test("covers book, paper, patent, and blog source types", () => {
    expect(realSourceRegressionSamples.map((sample) => sample.id)).toEqual(["book-agentic-design", "paper-talk-reasoner", "patent-rag-legal-research", "blog-agentic-rag"]);
    expect(realSourceRegressionSamples.map((sample) => sample.sourceKind)).toEqual(["book", "paper", "patent", "blog"]);
    expect(realSourceRegressionSamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "patent-rag-legal-research",
          sourcePath: "https://patents.google.com/patent/WO2025085566A1/en",
          strategy: "hybrid"
        }),
        expect.objectContaining({
          id: "blog-agentic-rag",
          sourcePath: "https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/bonus-rag-time-journey-agentic-rag/4404652",
          strategy: "task_guided"
        })
      ])
    );
    for (const sample of realSourceRegressionSamples) {
      expect(sample.unitPages).toBeGreaterThanOrEqual(6);
      expect(sample.acceptanceChecks.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("creates learner projects for regression samples without publishing private content", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-real-source-regression-"));
    const localBook = path.join(root, "book.pdf");
    const localPaper = path.join(root, "paper.pdf");
    await writeFile(localBook, "fake book source", "utf8");
    await writeFile(localPaper, "fake paper source", "utf8");

    const result = await runRealSourceRegressionSuite(root, {
      samples: [
        {
          id: "book-smoke",
          title: "Book Smoke",
          sourceKind: "book",
          sourcePath: localBook,
          sourceType: "file",
          strategy: "chapter_guided",
          selectedChapters: ["第 1 章"],
          unitPages: 8,
          audience: "中文学习者",
          acceptanceChecks: ["project ready", "chapter strategy", "source path retained"]
        },
        {
          id: "paper-smoke",
          title: "Paper Smoke",
          sourceKind: "paper",
          sourcePath: localPaper,
          sourceType: "file",
          strategy: "topic_guided",
          selectedTopics: ["method"],
          unitPages: 8,
          audience: "中文学习者",
          acceptanceChecks: ["project ready", "topic strategy", "source path retained"]
        },
        {
          id: "blog-smoke",
          title: "Blog Smoke",
          sourceKind: "blog",
          sourcePath: "https://example.com/blog",
          sourceType: "url",
          strategy: "task_guided",
          unitPages: 8,
          audience: "中文学习者",
          acceptanceChecks: ["project ready", "url retained", "task strategy"]
        }
      ]
    });

    expect(result.summary).toEqual({ total: 3, ready: 3, missingLocalSources: 0 });
    expect(result.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "book-smoke",
          status: "project_ready",
          strategy: "chapter_guided",
          selectedChapters: ["第 1 章"],
          sourceAvailable: true
        }),
        expect.objectContaining({
          id: "paper-smoke",
          status: "project_ready",
          strategy: "topic_guided",
          selectedTopics: ["method"],
          sourceAvailable: true
        }),
        expect.objectContaining({
          id: "blog-smoke",
          status: "project_ready",
          strategy: "task_guided",
          sourceAvailable: true
        })
      ])
    );
    await expect(readFile(path.join(root, "runs", "regression-book-smoke", "learner-project.json"), "utf8")).resolves.toContain("chapter_guided");
  });
});
