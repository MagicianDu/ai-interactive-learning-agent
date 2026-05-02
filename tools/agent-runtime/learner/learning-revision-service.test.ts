import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { publishableLessonFixture } from "../quality/test-fixtures.js";
import { LearningCoursePublisher } from "./learning-course-publisher.js";
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
      target: {
        scope: "unit",
        requestedChange: "整体太难了，请减少术语、增加一个生活化例子，并保留中文解释。"
      },
      next: {
        recommendedTool: "learning_agent.publish_learning_course"
      }
    });
    await expect(readFile(result.revisionBriefPath, "utf8")).resolves.toContain("整体太难了");
  });

  test("includes current published paths and previous feedback count", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-revision-"));
    await new LearningCoursePublisher(root).publish({
      runId: "feedback-course",
      lessons: [publishableLessonFixture({ id: "feedback-lesson", title: "哈希表：总览课", targetPageCount: 8 })],
      coursePack: {
        id: "feedback-course",
        title: "哈希表：课程包",
        parentRunId: "feedback-course",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "feedback-lesson",
            targetPageCount: 8
          }
        ]
      }
    });
    const service = new LearningRevisionService(root);

    await service.requestRevision({ runId: "feedback-course", feedback: "先加一个例子。" });
    const second = await service.requestRevision({ runId: "feedback-course", feedback: "再降低难度。" });
    const revisionBrief = JSON.parse(await readFile(second.revisionBriefPath, "utf8")) as Record<string, unknown>;

    expect(revisionBrief.previousFeedbackCount).toBe(1);
    expect(revisionBrief.currentCoursePackPath).toContain("coursePack.ts");
    expect(revisionBrief.currentLessonPaths).toEqual([expect.stringContaining("lesson.ts")]);
  });

  test("stores parsed revision targets in the brief", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-revision-"));
    const service = new LearningRevisionService(root);

    const result = await service.requestRevision({
      runId: "feedback-course",
      feedback: "第 4 页互动选择太弱，请换成操作实验"
    });
    const revisionBrief = JSON.parse(await readFile(result.revisionBriefPath, "utf8")) as Record<string, unknown>;

    expect(result).toMatchObject({
      target: {
        scope: "page",
        pageIndex: 3,
        requestedChange: "第 4 页互动选择太弱，请换成操作实验"
      }
    });
    expect(revisionBrief.target).toEqual(result.target);
  });
});
