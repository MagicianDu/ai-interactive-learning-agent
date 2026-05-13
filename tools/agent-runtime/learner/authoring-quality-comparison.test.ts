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
          academicMarkerCount: 1,
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

  test("flags generic authored content and weak source synthesis", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-quality-generic-"));
    await writePreviewRun(root, "draft-run", {
      lessonId: "draft-overview",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 92,
      sourceSpecific: true
    });
    await writePreviewRun(root, "authored-run", {
      lessonId: "authored-overview",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 92,
      genericPages: true
    });

    const result = await new AuthoringQualityComparisonService(root).compare({
      authoredRunId: "authored-run",
      draftRunId: "draft-run"
    });

    expect(result.authored.metrics.genericPageCount).toBeGreaterThan(0);
    expect(result.authored.metrics.weakSourceSynthesisPageCount).toBeGreaterThan(0);
    expect(result.remainingGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "generic-content" }),
        expect.objectContaining({ id: "source-synthesis" })
      ])
    );
    expect(result.revisionInstructions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gapId: "generic-content",
          instruction: expect.stringContaining("替换泛化页面")
        }),
        expect.objectContaining({
          gapId: "source-synthesis",
          instruction: expect.stringContaining("sourceAnchorIds")
        })
      ])
    );
  });

  test("reports source-kind depth improvements and remaining gaps from quality issues", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-quality-source-kind-depth-"));
    await writePreviewRun(root, "draft-run", {
      lessonId: "draft-blog",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 75,
      qualityIssueIds: ["quality.lesson.blog-practice-depth-shallow"]
    });
    await writePreviewRun(root, "authored-run", {
      lessonId: "authored-blog",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 100,
      sourceKindDepth: "blog"
    });
    await writePreviewRun(root, "weak-authored-run", {
      lessonId: "weak-patent",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 75,
      qualityIssueIds: ["quality.lesson.patent-depth-shallow"]
    });

    const improved = await new AuthoringQualityComparisonService(root).compare({
      authoredRunId: "authored-run",
      draftRunId: "draft-run"
    });
    const weak = await new AuthoringQualityComparisonService(root).compare({
      authoredRunId: "weak-authored-run",
      draftRunId: "draft-run"
    });

    expect(improved.draft.quality?.issueIds).toEqual(expect.arrayContaining(["quality.lesson.blog-practice-depth-shallow"]));
    expect(improved.authored.metrics.sourceKindDepthMarkerCount).toBeGreaterThan(improved.draft.metrics.sourceKindDepthMarkerCount);
    expect(improved.improvements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "source-kind-depth",
          title: "来源类型深度更完整"
        })
      ])
    );
    expect(improved.remainingGaps.map((gap) => gap.id)).not.toContain("source-kind-depth");
    expect(weak.remainingGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "source-kind-depth",
          title: "来源类型深度仍不足"
        })
      ])
    );
  });

  test("reports feedback mechanism improvements and remaining gaps from quality issues", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-quality-feedback-mechanism-"));
    await writePreviewRun(root, "draft-run", {
      lessonId: "draft-feedback",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 80,
      qualityIssueIds: ["quality.page.feedback-missing"]
    });
    await writePreviewRun(root, "authored-run", {
      lessonId: "authored-feedback",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 100
    });
    await writePreviewRun(root, "weak-authored-run", {
      lessonId: "weak-feedback",
      academic: true,
      pageSourceAnchors: true,
      qualityScore: 80,
      qualityIssueIds: ["quality.interaction.feedback-missing"]
    });

    const improved = await new AuthoringQualityComparisonService(root).compare({
      authoredRunId: "authored-run",
      draftRunId: "draft-run"
    });
    const weak = await new AuthoringQualityComparisonService(root).compare({
      authoredRunId: "weak-authored-run",
      draftRunId: "draft-run"
    });

    expect(improved.draft.quality?.issueIds).toEqual(expect.arrayContaining(["quality.page.feedback-missing"]));
    expect(improved.improvements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "feedback-mechanism",
          title: "解释性反馈更完整"
        })
      ])
    );
    expect(improved.remainingGaps.map((gap) => gap.id)).not.toContain("missing-feedback");
    expect(weak.remainingGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "missing-feedback",
          title: "解释性反馈机制仍不足"
        })
      ])
    );
    expect(weak.revisionInstructions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gapId: "missing-feedback",
          instruction: expect.stringContaining("feedbackSpec")
        })
      ])
    );
  });
});

async function writePreviewRun(
  root: string,
  runId: string,
  options: {
    lessonId: string;
    academic: boolean;
    pageSourceAnchors: boolean;
    qualityScore: number;
    extraLessonCount?: number;
    genericPages?: boolean;
    sourceSpecific?: boolean;
    sourceKindDepth?: "patent" | "blog";
    qualityIssueIds?: string[];
  }
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
    `${JSON.stringify(
      {
        status: options.qualityIssueIds && options.qualityIssueIds.length > 0 ? "warning" : "passed",
        score: options.qualityScore,
        checks: { sourceEvidence: "passed", chineseFirst: "passed" },
        issues: (options.qualityIssueIds ?? []).map((issueId) => ({
          issueId,
          scope: "lesson",
          severity: "warning",
          category: "learner_level_mismatch",
          reason: "source kind depth warning",
          requiredFix: "rewrite with source kind depth",
          rule: "source-kind-depth",
          path: "lesson.sourceKindDepth"
        }))
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function buildLesson(options: { lessonId: string; academic: boolean; pageSourceAnchors: boolean; sourceKindDepth?: "patent" | "blog" }): Record<string, unknown> {
  const anchorIds = ["source-001:section-1"];
  const sourceKindSummary =
    options.sourceKindDepth === "patent"
      ? "权利要求边界、现有技术问题、技术方案/机制、实施例、法律/适用边界、规避或迁移判断。"
      : options.sourceKindDepth === "blog"
        ? "实际问题、作者方案、实现路径、caveat/失败模式、可操作检查、迁移边界。"
        : "";
  return {
    id: options.lessonId,
    title: options.academic ? "控制型智能体：研究生课程总览" : "控制型智能体：快速草稿",
    audience: "有工程背景的中文学习者",
    sourceContext: {
      sourceAnchorIds: anchorIds
    },
    prerequisites: options.academic ? ["先修概念：控制回路、状态建模、策略评估"] : ["能阅读基础技术材料"],
    learningObjectives: options.academic
      ? ["使用正式术语解释关键链路", "围绕证据链和局限边界完成案例判断", `完成边界案例。${sourceKindSummary}`]
      : ["理解资料大意"],
    pages: [
      page("p1", "problem_scene", "问题场景", options.pageSourceAnchors ? anchorIds : [], options),
      page("p2", "structure_diagram", "结构图", options.pageSourceAnchors ? anchorIds : [], options),
      page("p3", "interactive_model", "学习动作", options.pageSourceAnchors ? anchorIds : [], options),
      page("p4", "quiz", "测验", options.pageSourceAnchors ? anchorIds : [], options),
      page("p5", "transfer_challenge", "迁移任务", options.pageSourceAnchors ? anchorIds : [], options)
    ],
    transferTasks: options.academic
      ? [{ id: "t1", prompt: "完成一个边界案例：把控制型智能体应用到新的工程故障排查场景。", targetMentalModel: "先修概念到正式术语再到边界。" }]
      : []
  };
}

function page(
  id: string,
  type: string,
  title: string,
  sourceAnchorIds: string[],
  options: { academic: boolean; genericPages?: boolean; sourceSpecific?: boolean }
): Record<string, unknown> {
  const academicNarrative = options.sourceSpecific
    ? "先修概念、正式术语、知识节点、关键链路、案例判断、边界案例、研究问题、证据链、局限边界。tool feedback、reflection loop、evaluation boundary 共同构成来源机制。"
    : "先修概念、正式术语、知识节点、关键链路、案例判断、边界案例、研究问题、证据链、局限边界。";
  return {
    id,
    type,
    title,
    learningGoal: options.academic ? "用大学高年级/研究生课程方式深化理解" : "理解概要",
    narrative: options.genericPages ? "本页介绍核心概念，帮助学习者理解资料大意和整体内容。" : options.academic ? academicNarrative : "这是一个快速摘要页面。",
    sourceAnchorIds,
    ...(type === "structure_diagram" ? { visualSpec: { kind: "diagram", description: "结构图", keyElements: ["关键链路"] } } : {}),
    ...(type === "interactive_model"
      ? {
          interactionSpec: {
            kind: "choice",
            learnerAction: "选择一个解释路径",
            expectedObservation: "看到不同路径的证据差异",
            cognitivePurpose: "训练来源到机制的连接",
            options: [
              {
                id: "evidence-path",
                label: "证据路径",
                explanation: "反馈会解释为什么这个选择能把来源证据连接到机制。"
              }
            ]
          }
        }
      : {}),
    ...(type === "quiz" || type === "transfer_challenge"
      ? {
          assessmentSpec: {
            kind: type === "transfer_challenge" ? "transfer" : "multiple_choice",
            prompt: "哪种解释更可靠？",
            options: options.academic ? ["有证据链", "只复述结论"] : ["有依据", "只复述结论"],
            correctAnswer: options.academic ? "有证据链" : "有依据"
          },
          feedbackSpec: {
            correctFeedback: "正确，因为它连接了来源证据和机制。",
            incorrectFeedback: "不对，只复述结论不能支撑迁移。"
          }
        }
      : {})
  };
}
