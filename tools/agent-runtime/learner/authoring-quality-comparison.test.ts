import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { AuthoringQualityComparisonService } from "./authoring-quality-comparison.js";

describe("AuthoringQualityComparisonService", () => {
  test("compares Codex-authored content against a deterministic draft and writes a report", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-quality-comparison-"));
    await writePreviewRun(root, "draft-run", {
      lessonId: "draft-overview",
      academic: false,
      pageSourceAnchors: false,
      qualityScore: 78
    });
    await writePreviewRun(root, "authored-run", {
      lessonId: "authored-overview",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 94
    });

    const result = await new AuthoringQualityComparisonService(root).compare({
      authoredRunId: "authored-run",
      draftRunId: "draft-run"
    });

    expect(result).toMatchObject({
      status: "authoring_quality_compared",
      authoredRunId: "authored-run",
      draftRunId: "draft-run",
      draft: {
        quality: { status: "passed", score: 78 },
        metrics: {
          academicMarkerCount: 0,
          sourceAnchoredPageRatio: 0
        }
      },
      authored: {
        quality: { status: "passed", score: 94 },
        metrics: {
          academicMarkerCount: expect.any(Number),
          sourceAnchoredPageRatio: 1
        }
      },
      improvements: expect.arrayContaining([
        expect.objectContaining({ id: "academic-depth" }),
        expect.objectContaining({ id: "source-grounding" }),
        expect.objectContaining({ id: "quality-score" })
      ]),
      remainingGaps: [],
      recommendedNextActions: expect.arrayContaining(["可进入真实学习者试用，并收集难度、节奏和练习反馈。"])
    });
    expect(result.authored.metrics.academicMarkerCount).toBeGreaterThan(result.draft.metrics.academicMarkerCount);
    await expect(readFile(result.reportPath, "utf8")).resolves.toContain("\"status\": \"authoring_quality_compared\"");
  });

  test("flags scope coverage when the authored preview covers fewer pages than the deterministic draft", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-quality-scope-"));
    await writePreviewRun(root, "draft-run", {
      lessonId: "draft-overview",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 100,
      extraLessonCount: 4
    });
    await writePreviewRun(root, "authored-run", {
      lessonId: "authored-overview",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 100
    });

    const result = await new AuthoringQualityComparisonService(root).compare({
      authoredRunId: "authored-run",
      draftRunId: "draft-run"
    });

    expect(result).toMatchObject({
      draft: {
        lessonCount: 5,
        metrics: { pageCount: 25 }
      },
      authored: {
        lessonCount: 1,
        metrics: { pageCount: 5 }
      },
      remainingGaps: expect.arrayContaining([
        expect.objectContaining({
          id: "scope-coverage",
          title: "Codex-authored 覆盖范围不足"
        })
      ]),
      recommendedNextActions: expect.arrayContaining([
        expect.stringContaining("remainingGaps")
      ])
    });
    expect(result.summary.join("\n")).toContain("内容质量 gap");
  });
});

async function writePreviewRun(
  root: string,
  runId: string,
  options: { lessonId: string; academic: boolean; pageSourceAnchors: boolean; qualityScore: number; extraLessonCount?: number }
): Promise<void> {
  const lessonDir = path.join(root, "runs", runId, "preview", "lessons");
  const qualityDir = path.join(root, "runs", runId, "quality");
  await mkdir(lessonDir, { recursive: true });
  await mkdir(qualityDir, { recursive: true });
  await writeFile(path.join(lessonDir, `${options.lessonId}.json`), `${JSON.stringify(buildLesson(options), null, 2)}\n`, "utf8");
  for (let index = 0; index < (options.extraLessonCount ?? 0); index += 1) {
    const lessonId = `${options.lessonId}-topic-${index + 1}`;
    await writeFile(path.join(lessonDir, `${lessonId}.json`), `${JSON.stringify(buildLesson({ ...options, lessonId }), null, 2)}\n`, "utf8");
  }
  await writeFile(
    path.join(qualityDir, "course-quality-report.json"),
    `${JSON.stringify({ status: "passed", score: options.qualityScore, checks: { sourceEvidence: "passed", chineseFirst: "passed" } }, null, 2)}\n`,
    "utf8"
  );
}

function buildLesson(options: { lessonId: string; academic: boolean; pageSourceAnchors: boolean }): Record<string, unknown> {
  const anchorIds = ["source-001:section-1"];
  return {
    id: options.lessonId,
    title: options.academic ? "控制型智能体：研究生课程总览" : "控制型智能体：快速草稿",
    audience: "有工程背景的中文学习者",
    sourceContext: {
      sourceAnchorIds: anchorIds
    },
    prerequisites: options.academic ? ["先修概念：控制回路、状态建模、策略评估"] : ["能阅读基础技术材料"],
    learningObjectives: options.academic
      ? ["使用正式术语解释机制链", "围绕证据链和局限边界展开课堂讨论", "完成课后作业式迁移"]
      : ["理解资料大意"],
    pages: [
      page("p1", "problem_scene", "问题场景", options.pageSourceAnchors ? anchorIds : [], options.academic),
      page("p2", "structure_diagram", "结构图", options.pageSourceAnchors ? anchorIds : [], options.academic),
      page("p3", "interactive_model", "学习动作", options.pageSourceAnchors ? anchorIds : [], options.academic),
      page("p4", "quiz", "测验", options.pageSourceAnchors ? anchorIds : [], options.academic),
      page("p5", "transfer_challenge", "迁移任务", options.pageSourceAnchors ? anchorIds : [], options.academic)
    ],
    transferTasks: options.academic
      ? [{ id: "t1", prompt: "设计一个课后作业：把控制型智能体迁移到新的工程故障排查场景。", targetMentalModel: "先修概念到正式术语再到迁移。" }]
      : []
  };
}

function page(id: string, type: string, title: string, sourceAnchorIds: string[], academic: boolean): Record<string, unknown> {
  return {
    id,
    type,
    title,
    learningGoal: academic ? "用大学高年级/研究生课程方式深化理解" : "理解概要",
    narrative: academic ? "先修概念、正式术语、课堂讨论、课后作业、研究问题、证据链、局限边界。" : "这是一个快速摘要页面。",
    sourceAnchorIds,
    ...(type === "structure_diagram" ? { visualSpec: { kind: "diagram", description: "结构图", keyElements: ["机制链"] } } : {}),
    ...(type === "interactive_model"
      ? {
          interactionSpec: {
            kind: "choice",
            learnerAction: "选择一个解释路径",
            expectedObservation: "看到不同路径的证据差异",
            cognitivePurpose: "训练来源到机制的连接"
          }
        }
      : {}),
    ...(type === "quiz" || type === "transfer_challenge"
      ? {
          assessmentSpec: {
            kind: type === "transfer_challenge" ? "transfer" : "multiple_choice",
            prompt: "哪种解释更可靠？",
            options: academic ? ["有证据链", "只复述结论"] : ["有依据", "只复述结论"],
            correctAnswer: academic ? "有证据链" : "有依据"
          },
          feedbackSpec: {
            correctFeedback: "正确，因为它连接了来源证据和机制。",
            incorrectFeedback: "不对，只复述结论不能支撑迁移。"
          }
        }
      : {})
  };
}
