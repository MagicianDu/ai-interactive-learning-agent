import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
        requestedChange: "整体太难了，请减少术语、增加一个生活化例子，并保留中文解释。",
        confidence: "medium"
      },
      next: {
        recommendedTool: "learning_agent.publish_learning_course"
      }
    });
    expect(result.target.categories).toEqual(expect.arrayContaining(["too_hard", "example_missing", "style_change"]));
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
    expect(revisionBrief.schemaVersion).toBe(2);
    expect(revisionBrief.currentCoursePackPath).toContain("preview/course-pack.json");
    expect(revisionBrief.currentLessonPaths).toEqual([expect.stringContaining("preview/lessons/feedback-lesson.json")]);
    expect(revisionBrief.sourceConstraints).toMatchObject({
      preserveSourceAnchors: true,
      allowInferredGrounding: true
    });
    expect(revisionBrief.expectedQualityChecks).toEqual(expect.arrayContaining(["Chinese-first", "publish validation", "quality report"]));
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
        pageNumber: 4,
        categories: ["interaction_weak"],
        confidence: "high",
        requestedChange: "第 4 页互动选择太弱，请换成操作实验"
      }
    });
    expect(revisionBrief.target).toEqual(result.target);
  });

  test("includes Course IR and quality report paths when publish artifacts exist", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-revision-artifacts-"));
    const runDir = path.join(root, "runs", "artifact-course");
    await mkdir(path.join(runDir, "artifacts"), { recursive: true });
    await mkdir(path.join(runDir, "quality"), { recursive: true });
    await writeFile(path.join(runDir, "artifacts", "course-ir.draft.json"), "{}\n", "utf8");
    await writeFile(path.join(runDir, "quality", "course-quality-report.json"), "{}\n", "utf8");

    const result = await new LearningRevisionService(root).requestRevision({
      runId: "artifact-course",
      feedback: "这页来源依据不清楚",
      focus: "第 2 页"
    });
    const revisionBrief = JSON.parse(await readFile(result.revisionBriefPath, "utf8")) as Record<string, unknown>;

    expect(revisionBrief).toMatchObject({
      schemaVersion: 2,
      courseIRPath: path.join(runDir, "artifacts", "course-ir.draft.json"),
      qualityReportPath: path.join(runDir, "quality", "course-quality-report.json"),
      sourceConstraints: {
        preserveSourceAnchors: true,
        sourceBacked: true
      }
    });
    expect(revisionBrief.expectedQualityChecks).toEqual(expect.arrayContaining(["source grounding"]));
  });

  test("creates a quality revision brief from authoring comparison gaps", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-quality-revision-"));
    const runDir = path.join(root, "runs", "quality-course");
    await mkdir(path.join(runDir, "quality"), { recursive: true });
    await writeFile(
      path.join(runDir, "quality", "authoring-quality-comparison.json"),
      `${JSON.stringify(
        {
          status: "authoring_quality_compared",
          authoredRunId: "quality-course",
          draftRunId: "quality-course-draft",
          remainingGaps: [
            {
              id: "generic-content",
              title: "Codex-authored 内容仍有泛化页面",
              evidence: "泛化页数量=2。"
            }
          ],
          revisionInstructions: [
            {
              gapId: "generic-content",
              instruction: "替换泛化页面：每页必须围绕具体来源术语、机制、例子、证据或局限写成一屏学习动作。",
              expectedEvidence: "genericPageCount 归零。"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = await new LearningRevisionService(root).requestQualityRevision({
      runId: "quality-course"
    });
    const revisionBrief = JSON.parse(await readFile(result.revisionBriefPath, "utf8")) as Record<string, unknown>;

    expect(result).toMatchObject({
      status: "quality_revision_brief_ready",
      runId: "quality-course",
      revisionId: "revision-001",
      comparisonReportPath: path.join(runDir, "quality", "authoring-quality-comparison.json"),
      target: {
        scope: "course",
        categories: expect.arrayContaining(["quality_gap"]),
        requestedChange: expect.stringContaining("generic-content")
      },
      next: {
        recommendedTool: "learning_agent.publish_learning_course"
      }
    });
    expect(revisionBrief.revisionInstructions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("替换泛化页面"),
        expect.stringContaining("genericPageCount 归零")
      ])
    );
    expect(revisionBrief.expectedQualityChecks).toEqual(expect.arrayContaining(["quality comparison", "quality report"]));
  });
});
