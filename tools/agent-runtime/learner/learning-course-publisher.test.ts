import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

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
