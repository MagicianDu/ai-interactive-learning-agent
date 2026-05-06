import { describe, expect, test } from "vitest";

import {
  addFeedbackBrief,
  addRevisionHistoryItem,
  buildPageKey,
  completedPageCountForCourse,
  createPageFeedbackRevisionBrief,
  learningProgressStorageKey,
  loadLearningProgress,
  recordPageVisit,
  saveLearningProgress
} from "./learning-progress";

describe("learning-progress", () => {
  test("records completed pages and restores progress from local storage", () => {
    const storage = new MemoryStorage();
    const state = recordPageVisit(loadLearningProgress(storage), {
      courseId: "course-a",
      unitId: "unit-overview",
      lessonId: "lesson-a",
      pageId: "page-01",
      pageIndex: 0
    });

    saveLearningProgress(state, storage);

    expect(storage.getItem(learningProgressStorageKey)).toContain("course-a:lesson-a:page-01");
    expect(loadLearningProgress(storage)).toMatchObject({
      currentCourseId: "course-a",
      currentUnitId: "unit-overview",
      currentLessonId: "lesson-a",
      currentPageIndex: 0,
      completedPages: [buildPageKey("course-a", "lesson-a", "page-01")]
    });
    expect(completedPageCountForCourse(loadLearningProgress(storage), "course-a")).toBe(1);
  });

  test("creates page-scoped learner feedback revision briefs", () => {
    const brief = createPageFeedbackRevisionBrief({
      courseId: "course-a",
      unitId: "unit-overview",
      lessonId: "lesson-a",
      pageId: "page-03",
      pageNumber: 3,
      option: "unclear_source",
      now: new Date("2026-05-06T00:00:00.000Z")
    });
    const state = addFeedbackBrief(loadLearningProgress(new MemoryStorage()), brief);

    expect(brief).toMatchObject({
      courseId: "course-a",
      unitId: "unit-overview",
      lessonId: "lesson-a",
      pageId: "page-03",
      scope: "page",
      focus: "source",
      recommendedTool: "learning_agent.revise_learning_course"
    });
    expect(brief.feedback).toContain("来源依据不清楚");
    expect(state.feedbackBriefs[0]).toEqual(brief);
  });

  test("stores learner-facing revision history and restores it from storage", () => {
    const storage = new MemoryStorage();
    const state = addRevisionHistoryItem(loadLearningProgress(storage), {
      runId: "course-a",
      revisionId: "revision-001",
      scope: "page",
      summary: "第 3 页增加了工程例子。",
      changedLessonIds: ["lesson-a"],
      changedPages: [{ lessonId: "lesson-a", pageId: "page-03", pageNumber: 3 }],
      qualityStatus: "passed",
      createdAt: "2026-05-06T00:00:00.000Z"
    });

    saveLearningProgress(state, storage);

    expect(loadLearningProgress(storage).revisionHistory).toEqual([
      {
        runId: "course-a",
        revisionId: "revision-001",
        scope: "page",
        summary: "第 3 页增加了工程例子。",
        changedLessonIds: ["lesson-a"],
        changedPages: [{ lessonId: "lesson-a", pageId: "page-03", pageNumber: 3 }],
        qualityStatus: "passed",
        createdAt: "2026-05-06T00:00:00.000Z"
      }
    ]);
  });

  test("keeps revision history newest first and caps it", () => {
    const state = Array.from({ length: 25 }, (_, index) => index + 1).reduce(
      (current, index) =>
        addRevisionHistoryItem(current, {
          runId: "course-a",
          revisionId: `revision-${String(index).padStart(3, "0")}`,
          scope: "page",
          summary: `第 ${index} 次修订`,
          changedLessonIds: ["lesson-a"],
          changedPages: [{ lessonId: "lesson-a", pageId: `page-${index}`, pageNumber: index }],
          qualityStatus: "passed",
          createdAt: `2026-05-06T00:00:${String(index).padStart(2, "0")}.000Z`
        }),
      loadLearningProgress(new MemoryStorage())
    );

    expect(state.revisionHistory).toHaveLength(20);
    expect(state.revisionHistory[0]?.revisionId).toBe("revision-025");
    expect(state.revisionHistory[state.revisionHistory.length - 1]?.revisionId).toBe("revision-006");
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
