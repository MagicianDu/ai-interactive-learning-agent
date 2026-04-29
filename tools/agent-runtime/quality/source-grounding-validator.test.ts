import { describe, expect, test } from "vitest";

import { createRunConfigFromArgs } from "../run-config.js";
import { validateSourceGrounding } from "./source-grounding-validator.js";
import { buildCompleteLesson } from "./test-fixtures.js";

describe("validateSourceGrounding", () => {
  test("does not require anchors for topic-only runs", () => {
    const config = createRunConfigFromArgs({ topic: "哈希表", run: "hash-topic" });
    const result = validateSourceGrounding(buildCompleteLesson(), config);

    expect(result.ok).toBe(true);
  });

  test("accepts source-backed lessons with sourceContext anchors", () => {
    const config = createRunConfigFromArgs({
      sourceFile: "/tmp/book.pdf",
      sourceKind: "book",
      sourceTitle: "Book",
      run: "book-run"
    });
    const lesson = {
      ...buildCompleteLesson(),
      sourceContext: {
        parentRunId: "book-run",
        sourceAnchorIds: ["source-001:page-1"],
        conceptIds: ["routing"]
      }
    };

    const result = validateSourceGrounding(lesson, config);

    expect(result.ok).toBe(true);
  });

  test("accepts source-backed lessons with page-level anchors", () => {
    const config = createRunConfigFromArgs({
      sourceFile: "/tmp/book.pdf",
      sourceKind: "book",
      sourceTitle: "Book",
      run: "book-run"
    });
    const lesson = buildCompleteLesson();
    lesson.pages.forEach((page) => {
      page.sourceAnchorIds = ["source-001:page-1"];
    });

    const result = validateSourceGrounding(lesson, config);

    expect(result.ok).toBe(true);
  });

  test("reports source-backed lessons without anchors", () => {
    const config = createRunConfigFromArgs({
      sourceFile: "/tmp/book.pdf",
      sourceKind: "book",
      sourceTitle: "Book",
      run: "book-run"
    });

    const result = validateSourceGrounding(buildCompleteLesson(), config);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        rule: "source-grounding",
        message: expect.stringContaining("sourceContext.sourceAnchorIds")
      })
    ]);
  });

  test("reports ungrounded source-backed pages when only some pages carry anchors", () => {
    const config = createRunConfigFromArgs({
      sourceFile: "/tmp/book.pdf",
      sourceKind: "book",
      sourceTitle: "Book",
      run: "book-run"
    });
    const lesson = buildCompleteLesson();
    lesson.pages[0].sourceAnchorIds = ["source-001:page-1"];

    const result = validateSourceGrounding(lesson, config);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "source-grounding",
          path: "pages.p2.sourceAnchorIds"
        })
      ])
    );
  });
});
