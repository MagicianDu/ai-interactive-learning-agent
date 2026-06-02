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
      expect(sample.qualityFocus).toEqual(
        expect.arrayContaining(["source_semantics", "source_synthesis", "learner_action", "feedback_mechanism", "transfer"])
      );
    }
  });

  test("documents benchmark expectations for every target source kind", async () => {
    const benchmark = await readFile(path.join(process.cwd(), "docs/runtime/real-source-quality-benchmark.md"), "utf8");

    for (const sourceKind of ["book", "paper", "patent", "blog", "documentation", "notes", "topic-only"]) {
      expect(benchmark).toContain(`### ${sourceKind}`);
    }
    for (const qualityDimension of ["source semantics", "source synthesis", "academic depth", "learner action", "feedback mechanism", "visual purpose", "transfer"]) {
      expect(benchmark).toContain(qualityDimension);
    }
  });

  test("creates learner projects and records source-blocked grounded previews without private content", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-real-source-regression-"));
    const localBook = path.join(root, "book.pdf");
    const localPaper = path.join(root, "paper.pdf");
    await writeFile(localBook, "fake book source", "utf8");
    await writeFile(localPaper, "fake paper source", "utf8");

    const result = await runRealSourceRegressionSuite(root, {
      generateGroundedCourse: true,
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
          difficultyLevel: "upper_undergraduate_or_graduate",
          acceptanceChecks: ["project ready", "chapter strategy", "source path retained"],
          qualityFocus: ["source_semantics", "source_synthesis", "learner_action", "feedback_mechanism", "transfer"]
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
          difficultyLevel: "research",
          acceptanceChecks: ["project ready", "topic strategy", "source path retained"],
          qualityFocus: ["source_semantics", "source_synthesis", "learner_action", "feedback_mechanism", "transfer"]
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
          difficultyLevel: "undergraduate_core",
          acceptanceChecks: ["project ready", "url retained", "task strategy"],
          qualityFocus: ["source_semantics", "source_synthesis", "learner_action", "feedback_mechanism", "transfer"]
        }
      ]
    });

    expect(result.summary).toEqual({ total: 3, ready: 3, groundedReady: 1, missingLocalSources: 0 });
    expect(result.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "book-smoke",
          status: "project_ready",
          groundedCourseStatus: "source_blocked",
          groundedCourseBlocker: expect.objectContaining({
            code: "INVALID_RUN_CONFIG",
            message: expect.stringContaining("no usable source anchors")
          }),
          generatedUnitCount: 0,
          semanticStatus: "failed",
          sourceEvidenceStatus: undefined,
          sourceGraphStatus: undefined,
          missingConceptLabels: ["全局地图", "核心机制"],
          sourceAnchorCount: 0,
          sourceEvidence: undefined,
          semanticExpectations: {
            expectedConceptLabels: ["全局地图", "核心机制"],
            matchedConceptLabels: [],
            missingConceptLabels: ["全局地图", "核心机制"]
          },
          strategy: "chapter_guided",
          selectedChapters: ["第 1 章"],
          sourceAvailable: true
        }),
        expect.objectContaining({
          id: "paper-smoke",
          status: "project_ready",
          groundedCourseStatus: "source_blocked",
          groundedCourseBlocker: expect.objectContaining({
            code: "INVALID_RUN_CONFIG",
            message: expect.stringContaining("no usable source anchors")
          }),
          generatedUnitCount: 0,
          semanticStatus: "failed",
          sourceEvidenceStatus: undefined,
          sourceGraphStatus: undefined,
          missingConceptLabels: ["研究问题", "方法结构", "证据边界"],
          sourceAnchorCount: 0,
          sourceEvidence: undefined,
          semanticExpectations: {
            expectedConceptLabels: ["研究问题", "方法结构", "证据边界"],
            matchedConceptLabels: [],
            missingConceptLabels: ["研究问题", "方法结构", "证据边界"]
          },
          strategy: "topic_guided",
          selectedTopics: ["method"],
          sourceAvailable: true
        }),
        expect.objectContaining({
          id: "blog-smoke",
          status: "project_ready",
          groundedCourseStatus: "preview_ready",
          generatedUnitCount: expect.any(Number),
          semanticStatus: "warning",
          sourceEvidenceStatus: "passed",
          sourceGraphStatus: "passed",
          sourceGraph: expect.objectContaining({
            conceptCount: expect.any(Number),
            sourceUnitCount: expect.any(Number)
          }),
          missingConceptLabels: [],
          sourceAnchorCount: expect.any(Number),
          sourceEvidence: expect.objectContaining({
            unsupportedPages: 0
          }),
          semanticExpectations: {
            expectedConceptLabels: ["实践问题", "操作流程"],
            matchedConceptLabels: ["实践问题", "操作流程"],
            missingConceptLabels: []
          },
          strategy: "task_guided",
          sourceAvailable: true
        })
      ])
    );
    for (const sample of result.samples) {
      if (sample.groundedCourseStatus === "source_blocked") {
        expect(sample.generatedUnitCount).toBe(0);
        expect(sample.semanticStatus).toBe("failed");
        expect(sample.sourceEvidenceStatus).toBeUndefined();
        expect(sample.sourceGraphStatus).toBeUndefined();
        expect(sample.sourceAnchorCount).toBe(0);
      } else {
        expect(sample.generatedUnitCount).toBeGreaterThanOrEqual(3);
        expect(sample.semanticStatus).not.toBe("failed");
        expect(sample.sourceEvidenceStatus).not.toBe("failed");
        expect(sample.sourceGraphStatus).not.toBe("failed");
        expect(sample.sourceGraph?.graphPath).toContain("source-graph");
        expect(sample.sourceAnchorCount).toBeGreaterThan(0);
      }
    }
    await expect(readFile(path.join(root, "runs", "regression-book-smoke", "learner-project.json"), "utf8")).resolves.toContain("chapter_guided");
  }, 15_000);
});
