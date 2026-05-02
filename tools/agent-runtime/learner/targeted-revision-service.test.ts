import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { publishableLessonFixture } from "../quality/test-fixtures.js";
import { LearningCoursePublisher } from "./learning-course-publisher.js";
import { LearningRevisionService } from "./learning-revision-service.js";
import { TargetedRevisionService } from "./targeted-revision-service.js";

describe("TargetedRevisionService", () => {
  test("applies page feedback only to the targeted page narrative and republishes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "targeted-revision-"));
    const lesson = withDistinctNarratives(
      publishableLessonFixture({ id: "target-lesson", title: "哈希表：总览课", targetPageCount: 8 })
    );
    await new LearningCoursePublisher(root).publish({
      runId: "target-course",
      lessons: [lesson],
      coursePack: {
        id: "target-course",
        title: "哈希表：课程包",
        parentRunId: "target-course",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "target-lesson",
            targetPageCount: 8
          }
        ]
      }
    });
    await new LearningRevisionService(root).requestRevision({
      runId: "target-course",
      feedback: "第 3 页太抽象，换成工程例子"
    });

    const result = await new TargetedRevisionService(root).applyLatestRevision({ runId: "target-course" });
    const lessonText = await readFile(path.join(root, "src", "lessons", "target-lesson", "lesson.ts"), "utf8");
    const previewText = await readFile(path.join(root, "runs", "target-course", "learning-preview.json"), "utf8");

    expect(result).toMatchObject({
      status: "revision_applied",
      runId: "target-course",
      revisionId: "revision-001",
      changedLessonIds: ["target-lesson"],
      preview: {
        coursePackId: "target-course",
        lessonCount: 1
      }
    });
    expect(lessonText).toContain('narrative: "第3页原文\\n\\n修订说明：第 3 页太抽象，换成工程例子"');
    expect(lessonText).toContain('narrative: "第1页原文"');
    expect(lessonText).toContain('narrative: "第2页原文"');
    expect(lessonText).toContain('narrative: "第4页原文"');
    expect(lessonText.match(/修订说明/g)).toHaveLength(1);
    expect(previewText).toContain("revision-001");
  });

  test("uses the latest revision brief when multiple briefs exist", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "targeted-revision-"));
    const lesson = withDistinctNarratives(
      publishableLessonFixture({ id: "latest-lesson", title: "哈希表：总览课", targetPageCount: 8 })
    );
    await new LearningCoursePublisher(root).publish({
      runId: "latest-course",
      lessons: [lesson],
      coursePack: {
        id: "latest-course",
        title: "哈希表：课程包",
        parentRunId: "latest-course",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "latest-lesson",
            targetPageCount: 8
          }
        ]
      }
    });
    await new LearningRevisionService(root).requestRevision({
      runId: "latest-course",
      feedback: "第 2 页增加类比"
    });
    await new LearningRevisionService(root).requestRevision({
      runId: "latest-course",
      feedback: "第 5 页增加真实排障例子"
    });

    const result = await new TargetedRevisionService(root).applyLatestRevision({ runId: "latest-course" });
    const lessonText = await readFile(path.join(root, "src", "lessons", "latest-lesson", "lesson.ts"), "utf8");

    expect(result).toMatchObject({
      revisionId: "revision-002",
      changedLessonIds: ["latest-lesson"]
    });
    expect(lessonText).toContain('narrative: "第5页原文\\n\\n修订说明：第 5 页增加真实排障例子"');
    expect(lessonText).toContain('narrative: "第2页原文"');
    expect(lessonText.match(/修订说明/g)).toHaveLength(1);
  });
});

function withDistinctNarratives(lesson: Record<string, unknown>): Record<string, unknown> {
  const pages = Array.isArray(lesson.pages)
    ? lesson.pages.map((page, index) => ({
        ...(typeof page === "object" && page !== null ? page : {}),
        narrative: `第${index + 1}页原文`
      }))
    : [];
  return { ...lesson, pages };
}
