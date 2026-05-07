import { describe, expect, test } from "vitest";

import { buildRevisionBriefV2 } from "./revision-brief.js";
import { parseRevisionTargetV2 } from "./revision-targeting.js";

describe("buildRevisionBriefV2", () => {
  test("builds a source-preserving revision brief with artifact paths and expected checks", () => {
    const brief = buildRevisionBriefV2({
      runId: "course-a",
      revisionId: "revision-001",
      feedback: "第 3 页太抽象，换成工程例子",
      target: parseRevisionTargetV2("第 3 页太抽象，换成工程例子"),
      currentPreview: {
        devCommand: "npm run dev",
        localUrl: "http://127.0.0.1:5173/#/preview/course-a",
        coursePackId: "course-a",
        courseTitle: "哈希表课程",
        lessonCount: 2,
        previewManifestPath: "/tmp/runs/course-a/preview/manifest.json"
      },
      currentCoursePackPath: "runs/course-a/preview/course-pack.json",
      currentLessonPaths: ["runs/course-a/preview/lessons/lesson-a.json"],
      courseIRPath: "runs/course-a/artifacts/course-ir.draft.json",
      qualityReportPath: "runs/course-a/quality/course-quality-report.json",
      sourceBacked: true,
      previousFeedbackCount: 0,
      now: new Date("2026-05-06T00:00:00.000Z")
    });

    expect(brief).toMatchObject({
      schemaVersion: 2,
      runId: "course-a",
      revisionId: "revision-001",
      feedback: "第 3 页太抽象，换成工程例子",
      target: {
        scope: "page",
        pageIndex: 2,
        categories: ["too_abstract", "example_missing"]
      },
      currentPreview: {
        localUrl: "http://127.0.0.1:5173/#/preview/course-a",
        coursePackId: "course-a",
        courseTitle: "哈希表课程",
        lessonCount: 2
      },
      currentCoursePackPath: "runs/course-a/preview/course-pack.json",
      currentLessonPaths: ["runs/course-a/preview/lessons/lesson-a.json"],
      courseIRPath: "runs/course-a/artifacts/course-ir.draft.json",
      qualityReportPath: "runs/course-a/quality/course-quality-report.json",
      sourceConstraints: {
        preserveSourceAnchors: true,
        allowInferredGrounding: true,
        sourceBacked: true
      },
      previousFeedbackCount: 0,
      createdAt: "2026-05-06T00:00:00.000Z"
    });
    expect(brief.revisionInstructions).toEqual(
      expect.arrayContaining([
        "Revise only the targeted page unless the quality report shows a prerequisite issue.",
        "Preserve existing sourceAnchorIds and grounding on source-backed pages."
      ])
    );
    expect(brief.expectedQualityChecks).toEqual(
      expect.arrayContaining(["source grounding", "Chinese-first", "publish validation", "quality report"])
    );
  });
});
