import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { publishableLessonFixture } from "../quality/test-fixtures.js";
import { LearningCoursePublisher } from "./learning-course-publisher.js";

describe("LearningCoursePublisher", () => {
  test("publishes a Codex-authored course bundle into lessons and course-packs", async () => {
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
      quality: { checkedLessons: 1, blockingIssueCount: 0 }
    });
    await expect(readFile(path.join(root, "src", "lessons", "hash-table-overview", "lesson.ts"), "utf8")).resolves.toContain(
      "generatedLesson"
    );
    await expect(readFile(path.join(root, "src", "course-packs", "hash-course", "coursePack.ts"), "utf8")).resolves.toContain(
      "generatedCoursePack"
    );
    await expect(readFile(path.join(root, "runs", "hash-course", "learning-preview.json"), "utf8")).resolves.toContain(
      "http://127.0.0.1:5173/"
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
      userMessage: "课程还不能发布：需要 Codex 先修订中文学习内容和质量问题。"
    });
    if (result.status !== "revision_required") {
      throw new Error("expected revision_required");
    }
    expect(result.issues.some((issue) => issue.rule === "chinese-first")).toBe(true);
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

function coursePackFixture(coursePackId: string, lessonId: string): Record<string, unknown> {
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
        conceptIds: ["hash-table"]
      }
    ]
  };
}
