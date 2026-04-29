import { describe, expect, test } from "vitest";

import { validateChineseFirstLesson } from "./chinese-first-validator.js";
import { buildCompleteLesson } from "./test-fixtures.js";

describe("validateChineseFirstLesson", () => {
  test("accepts Chinese-first learner-facing fields", () => {
    const result = validateChineseFirstLesson(buildCompleteLesson());

    expect(result.ok).toBe(true);
  });

  test("reports English-only learner-facing fields", () => {
    const lesson = buildCompleteLesson();
    lesson.title = "Hash tables are fast";
    lesson.pages[0].title = "Problem scene";

    const result = validateChineseFirstLesson(lesson);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "chinese-first", path: "title" }),
        expect.objectContaining({ rule: "chinese-first", path: "pages.p1.title" })
      ])
    );
  });
});
