import { describe, expect, test } from "vitest";

import { validateLessonQuality } from "./lesson-quality-validator.js";
import { buildCompleteLesson } from "./test-fixtures.js";

describe("validateLessonQuality", () => {
  test("accepts lessons that satisfy product quality requirements", () => {
    const result = validateLessonQuality(buildCompleteLesson());

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test("reports missing required learning experience elements", () => {
    const lesson = buildCompleteLesson();
    lesson.pages = lesson.pages.filter((page) => page.type !== "transfer_challenge");
    lesson.transferTasks = [];
    lesson.config.targetPageCount = lesson.pages.length;

    const result = validateLessonQuality(lesson);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "transfer-challenge", message: expect.stringContaining("transfer_challenge") })
      ])
    );
  });

  test("reports interactions without explanatory feedback", () => {
    const lesson = buildCompleteLesson();
    const interactivePage = lesson.pages.find((page) => page.interactionSpec?.options);
    if (!interactivePage?.interactionSpec?.options?.[0]) {
      throw new Error("expected interactive page");
    }
    interactivePage.interactionSpec.options[0].explanation = "";

    const result = validateLessonQuality(lesson);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "interaction-feedback", path: expect.stringContaining(String(interactivePage.id)) })
      ])
    );
  });
});
