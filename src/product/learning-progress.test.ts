import { describe, expect, test } from "vitest";

import {
  addFeedbackBrief,
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
