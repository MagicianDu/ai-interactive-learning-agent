import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ArtifactStore } from "../artifact-store.js";
import { publishableLessonFixture } from "../quality/test-fixtures.js";
import { LearnerProjectService } from "./learner-project-service.js";
import { LearningCoursePublisher } from "./learning-course-publisher.js";

describe("LearningCoursePublisher", () => {
  test("publishes a Codex-authored course bundle into the clean preview runtime by default", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const lesson = publishableLessonFixture({ id: "hash-table-overview", title: "哈希表：总览课", targetPageCount: 8 });
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "hash-course",
      lessons: [lesson],
      coursePack: {
        id: "hash-course",
        title: "哈希表：课程包",
        parentRunId: "hash-course",
        sourceKind: "topic",
        strategy: "overview_plus_topic",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "hash-table-overview",
            targetPageCount: 8,
            conceptIds: ["hash-table"]
          }
        ]
      }
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      coursePackId: "hash-course",
      outputMode: "preview",
      qualityReport: {
        status: "passed",
        score: 100,
        requiredFixCount: 0
      },
      publishValidation: {
        status: "passed",
        issueCount: 0,
        errorCount: 0,
        warningCount: 0
      },
      quality: { checkedLessons: 1, blockingIssueCount: 0 }
    });
    if (result.status !== "preview_ready") {
      throw new Error("expected preview_ready");
    }
    expect(result.coursePackPath).toBe(path.join(root, "runs", "hash-course", "preview", "course-pack.json"));
    expect(result.lessonPaths).toEqual([path.join(root, "runs", "hash-course", "preview", "lessons", "hash-table-overview.json")]);
    await expect(readFile(result.coursePackPath, "utf8")).resolves.toContain("\"id\": \"hash-course\"");
    await expect(readFile(result.lessonPaths[0] as string, "utf8")).resolves.toContain("\"id\": \"hash-table-overview\"");
    await expect(readFile(path.join(root, "runs", "hash-course", "preview", "manifest.json"), "utf8")).resolves.toContain(
      "\"coursePackPath\": \"course-pack.json\""
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "learning-preview.json"), "utf8")).resolves.toContain(
      "#/preview/hash-course"
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "quality", "course-quality-report.json"), "utf8")).resolves.toContain(
      "\"status\": \"passed\""
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "artifacts", "course-ir.v1.json"), "utf8")).resolves.toContain(
      "\"irVersion\": \"course-ir/v1\""
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "artifacts", "lesson-bundle.v1.json"), "utf8")).resolves.toContain(
      "\"lessons\""
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "artifacts", "publish-validation.v1.json"), "utf8")).resolves.toContain(
      "\"status\": \"passed\""
    );
    await expect(readFile(path.join(root, "src", "lessons", "hash-table-overview", "lesson.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(path.join(root, "src", "course-packs", "hash-course", "coursePack.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("can explicitly publish maintainer TypeScript fixtures when requested", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-source-"));
    const lesson = publishableLessonFixture({ id: "hash-table-overview", title: "哈希表：总览课", targetPageCount: 8 });
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "hash-source",
      outputMode: "source",
      lessons: [lesson],
      coursePack: coursePackFixture("hash-source", "hash-table-overview")
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      coursePackId: "hash-source",
      outputMode: "source"
    });
    await expect(readFile(path.join(root, "src", "lessons", "hash-table-overview", "lesson.ts"), "utf8")).resolves.toContain(
      "generatedLesson"
    );
    await expect(readFile(path.join(root, "src", "course-packs", "hash-source", "coursePack.ts"), "utf8")).resolves.toContain(
      "generatedCoursePack"
    );
  });

  test("returns revision_required when the Codex-authored lesson is not Chinese-first", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const lesson = {
      ...publishableLessonFixture({ id: "english-lesson", title: "Hash tables", targetPageCount: 8 }),
      audience: "English learners",
      learningObjectives: ["Explain hash table access paths"],
      summary: ["Hash tables reduce search space."]
    };
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "english-course",
      lessons: [lesson],
      coursePack: coursePackFixture("english-course", "english-lesson")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "english-course",
      qualityReport: {
        status: "failed",
        checks: {
          chineseFirst: "failed"
        }
      },
      userMessage: "课程还不能发布：需要 Codex 先修订中文学习内容和质量问题。"
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues.some((issue) => issue.rule === "chinese-first")).toBe(true);
  });

  test("returns revision_required when publish validation finds malformed authored pages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-validation-"));
    const lesson = {
      ...publishableLessonFixture({ id: "bad-page-lesson", title: "坏页面课程", targetPageCount: 8 }),
      pages: [
        {
          ...publishableLessonFixture({ id: "bad-page-lesson", title: "坏页面课程", targetPageCount: 8 }).pages[0],
          learningGoal: ""
        }
      ]
    };
    const publisher = new LearningCoursePublisher(root);

    const result = await publisher.publish({
      runId: "bad-page-course",
      lessons: [lesson],
      coursePack: coursePackFixture("bad-page-course", "bad-page-lesson")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "bad-page-course",
      qualityReport: {
        status: "failed"
      },
      publishValidation: {
        status: "failed",
        issueCount: 1,
        errorCount: 1
      }
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "publish.page.learning-goal-missing",
          message: expect.stringContaining("Set page.learningGoal")
        })
      ])
    );
    await expect(readFile(path.join(root, "runs", "bad-page-course", "artifacts", "publish-validation.v1.json"), "utf8")).resolves.toContain(
      "\"status\": \"failed\""
    );
  });

  test("requires source grounding when publishing a source-backed learner project", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const sourcePath = path.join(root, "source.pdf");
    const publisher = new LearningCoursePublisher(root);
    await new LearnerProjectService(root).createProject({
      request: `请用 ${sourcePath} 这本书生成中文学习材料，面向有编程基础的学习者，每个单元 8 页。`,
      runId: "source-course"
    });

    const ungrounded = await publisher.publish({
      runId: "source-course",
      lessons: [publishableLessonFixture({ id: "source-lesson", title: "资料总览课", targetPageCount: 8 })],
      coursePack: coursePackFixture("source-course", "source-lesson")
    });

    expect(ungrounded).toMatchObject({ status: "revision_required", runId: "source-course" });
    if (ungrounded.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(ungrounded.issues.some((issue) => issue.rule === "source-grounding")).toBe(true);

    const groundedLesson = {
      ...publishableLessonFixture({ id: "source-lesson", title: "资料总览课", targetPageCount: 8 }),
      sourceContext: {
        sourceAnchorIds: ["source-001:page-1"],
        sourcePath
      },
      pages: publishableLessonFixture({ id: "source-lesson", title: "资料总览课", targetPageCount: 8 }).pages.map((page) => ({
        ...page,
        sourceAnchorIds: ["source-001:page-1"]
      }))
    };

    const grounded = await publisher.publish({
      runId: "source-course",
      lessons: [groundedLesson],
      coursePack: coursePackFixture("source-course", "source-lesson", ["source-001:page-1"])
    });

    expect(grounded).toMatchObject({
      status: "preview_ready",
      coursePackId: "source-course"
    });
  });

  test("returns revision_required when a persisted content blueprint detects authored page drift", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-blueprint-"));
    const publisher = new LearningCoursePublisher(root);
    const lesson = blueprintCompliantLessonFixture();
    const driftedLesson = {
      ...lesson,
      pages: lesson.pages.map((page, index) => {
        if (index === 1) {
          return { ...page, type: "structure_diagram" };
        }
        if (index === 2) {
          return { ...page, type: "intuition_visual" };
        }
        return page;
      })
    };
    await new ArtifactStore(path.join(root, "runs", "blueprint-course")).writeDraft("authoring-context", {
      artifactId: "authoring-context",
      roleId: "learning-architecture",
      runId: "blueprint-course",
      contentBlueprint: contentBlueprintFixture()
    });

    const result = await publisher.publish({
      runId: "blueprint-course",
      lessons: [driftedLesson],
      coursePack: coursePackFixture("blueprint-course", "hash-lesson")
    });

    expect(result).toMatchObject({
      status: "revision_required",
      runId: "blueprint-course",
      qualityReport: {
        status: "passed"
      },
      publishValidation: {
        status: "failed",
        errorCount: 2
      }
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "publish.blueprint.page-type-mismatch",
          message: expect.stringContaining("contentBlueprint")
        })
      ])
    );
    await expect(readFile(path.join(root, "runs", "blueprint-course", "artifacts", "publish-validation.v1.json"), "utf8")).resolves.toContain(
      "publish.blueprint.page-type-mismatch"
    );
  });

  test("rejects unsafe lesson and course pack ids before writing files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-course-publisher-"));
    const publisher = new LearningCoursePublisher(root);

    await expect(
      publisher.publish({
        runId: "unsafe-course",
        lessons: [publishableLessonFixture({ id: "../bad", targetPageCount: 8 })],
        coursePack: coursePackFixture("../bad", "../bad")
      })
    ).rejects.toThrow("id must match");
  });
});

function coursePackFixture(coursePackId: string, lessonId: string, sourceAnchorIds: string[] = []): Record<string, unknown> {
  return {
    id: coursePackId,
    title: "哈希表：课程包",
    parentRunId: coursePackId,
    sourceKind: "topic",
    strategy: "overview_plus_topic",
    units: [
      {
        unitId: "unit-overview",
        title: "哈希表：总览课",
        kind: "overview",
        lessonId,
        targetPageCount: 8,
        sourceAnchorIds,
        conceptIds: ["hash-table"]
      }
    ]
  };
}

function contentBlueprintFixture(): Record<string, unknown> {
  const sourceRequirement = "topic-only 页面必须清楚区分常识、推理和示例；不要伪造 sourceAnchorIds。";
  return {
    version: "content-blueprint/v1",
    globalRules: ["中文优先"],
    units: [
      {
        unitId: "unit-overview",
        lessonId: "hash-lesson",
        title: "哈希表：总览课",
        targetPageCount: 8,
        unitKind: "overview",
        focusConcepts: ["哈希表"],
        sourceAnchorIds: [],
        sourceRequirement,
        pageBlueprints: [
          "problem_scene",
          "intuition_visual",
          "structure_diagram",
          "interactive_model",
          "quiz",
          "misconception_check",
          "transfer_challenge",
          "summary_card"
        ].map((pageType, index) => ({
          pageNumber: index + 1,
          pageType,
          teachingMove: "围绕一个清晰学习目标推进。",
          learnerAction: "让学习者做判断、预测或操作。",
          visualRequirement: "页面需要可见结构。",
          feedbackRequirement: "反馈解释为什么。",
          sourceRequirement,
          mustInclude: ["中文学习目标"]
        }))
      }
    ]
  };
}

function blueprintCompliantLessonFixture(): ReturnType<typeof publishableLessonFixture> {
  const base = publishableLessonFixture({ id: "hash-lesson", title: "哈希表：总览课", targetPageCount: 8 });
  const pages = [
    lessonPage("p1", "problem_scene", { visual: true }),
    lessonPage("p2", "intuition_visual", { visual: true }),
    lessonPage("p3", "structure_diagram", { visual: true }),
    lessonPage("p4", "interactive_model", { visual: true, interaction: true }),
    lessonPage("p5", "quiz", { assessment: true }),
    lessonPage("p6", "misconception_check", { assessment: true }),
    lessonPage("p7", "transfer_challenge", { assessment: true, interaction: true }),
    lessonPage("p8", "summary_card", { visual: true })
  ];

  return {
    ...base,
    pages
  };
}

function lessonPage(
  id: string,
  type: string,
  options: { visual?: boolean; interaction?: boolean; assessment?: boolean }
): Record<string, unknown> {
  return {
    id,
    type,
    title: `${id} 中文页`,
    learningGoal: "理解哈希表为什么快，建立可迁移的中文心智模型",
    narrative: "这是一段围绕哈希表访问路径的中文学习内容。",
    ...(options.visual
      ? {
          visualSpec: {
            kind: "diagram",
            description: "中文结构图",
            keyElements: ["键", "桶", "候选范围"]
          }
        }
      : {}),
    ...(options.interaction
      ? {
          interactionSpec: {
            kind: "choice",
            learnerAction: "选择访问路径",
            expectedObservation: "看到候选范围变化",
            cognitivePurpose: "理解搜索空间缩小",
            options: [
              {
                id: "indexed",
                label: "选择索引路径",
                resultTitle: "候选范围缩小",
                outcomeId: "indexed",
                resultTone: "success",
                explanation: "因为 key 改变了访问路径。"
              }
            ]
          }
        }
      : {}),
    ...(options.assessment
      ? {
          assessmentSpec: {
            kind: "multiple_choice",
            prompt: "哪种判断更符合哈希表心智模型？",
            options: ["用 key 缩小候选范围", "随机让程序变快"],
            correctAnswer: "用 key 缩小候选范围"
          },
          feedbackSpec: {
            correctFeedback: "正确，因为 key 决定访问路径。",
            incorrectFeedback: "不对，这忽略了搜索空间缩小。"
          }
        }
      : {})
  };
}
