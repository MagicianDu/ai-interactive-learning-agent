import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { publishableLessonFixture } from "../quality/test-fixtures.js";
import { LearningCoursePublisher } from "./learning-course-publisher.js";
import { LearningPreviewService } from "./learning-preview-service.js";

describe("LearningPreviewService", () => {
  test("returns not_published before a course bundle is published", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-preview-"));

    await expect(new LearningPreviewService(root).getPreview("missing-run")).resolves.toEqual({
      status: "not_published",
      runId: "missing-run"
    });
  });

  test("returns learner-readable preview metadata for a published course", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-preview-"));
    await new LearningCoursePublisher(root).publish({
      runId: "preview-course",
      lessons: [publishableLessonFixture({ id: "preview-lesson", title: "哈希表：总览课", targetPageCount: 8 })],
      coursePack: {
        id: "preview-course",
        title: "哈希表：课程包",
        parentRunId: "preview-course",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "preview-lesson",
            targetPageCount: 8
          }
        ]
      }
    });

    await expect(new LearningPreviewService(root).getPreview("preview-course")).resolves.toMatchObject({
      status: "preview_ready",
      runId: "preview-course",
      preview: {
        devCommand: "npm run dev",
        localUrl: "http://127.0.0.1:5173/#/preview/preview-course",
        coursePackId: "preview-course",
        courseTitle: "哈希表：课程包",
        lessonCount: 1,
        previewManifestPath: path.join(root, "runs", "preview-course", "preview", "manifest.json"),
        qualityReport: {
          status: "passed",
          score: 100
        },
        revisionHistory: []
      }
    });
  });

  test("returns learner-readable revision history when preview includes revisions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-preview-"));
    await new LearningCoursePublisher(root).publish({
      runId: "preview-revised-course",
      lessons: [publishableLessonFixture({ id: "preview-revised-lesson", title: "哈希表：总览课", targetPageCount: 8 })],
      coursePack: {
        id: "preview-revised-course",
        title: "哈希表：课程包",
        parentRunId: "preview-revised-course",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "preview-revised-lesson",
            targetPageCount: 8
          }
        ]
      },
      revisionHistoryItem: {
        revisionId: "revision-001",
        scope: "page",
        summary: "第 3 页增加了工程例子。",
        changedLessonIds: ["preview-revised-lesson"],
        changedPages: [{ lessonId: "preview-revised-lesson", pageId: "p3", pageNumber: 3 }],
        createdAt: "2026-05-06T00:00:00.000Z"
      }
    });

    await expect(new LearningPreviewService(root).getPreview("preview-revised-course")).resolves.toMatchObject({
      status: "preview_ready",
      preview: {
        revisionHistory: [
          {
            runId: "preview-revised-course",
            revisionId: "revision-001",
            summary: "第 3 页增加了工程例子。",
            qualityStatus: "passed"
          }
        ]
      }
    });
  });
});
