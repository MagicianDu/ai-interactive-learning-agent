import { describe, expect, test } from "vitest";

import { evaluateKnowledgeBoardRubric } from "./knowledge-board-rubric.js";
import { professorBoardLessonFixture, publishableLessonFixture } from "./test-fixtures.js";

describe("knowledge-board-rubric", () => {
  test("passes when every professor lecture page has a useful knowledge board", () => {
    const lesson = professorBoardLessonFixture({ id: "board-rich", targetPageCount: 8 });

    const result = evaluateKnowledgeBoardRubric([lesson]);

    expect(result).toMatchObject({
      status: "passed",
      requiredPageCount: 8,
      satisfiedPageCount: 8,
      failedPageCount: 0,
      pageResults: expect.arrayContaining([
        expect.objectContaining({
          lessonId: "board-rich",
          pageId: "p1",
          status: "passed",
          missingItems: [],
          weakItems: []
        })
      ])
    });
    expect(result.pageResults.every((page) => page.status === "passed")).toBe(true);
  });

  test("fails each page that is missing knowledgeBoard", () => {
    const lesson = publishableLessonFixture({ id: "board-missing", targetPageCount: 8 });

    const result = evaluateKnowledgeBoardRubric([lesson]);

    expect(result).toMatchObject({
      status: "failed",
      requiredPageCount: 8,
      satisfiedPageCount: 0,
      failedPageCount: 8
    });
    expect(result.pageResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: "board-missing",
          pageId: "p1",
          status: "failed",
          missingItems: expect.arrayContaining(["knowledgeBoard"])
        })
      ])
    );
  });

  test("fails missing sourceTrace because board claims must map to source evidence", () => {
    const lesson = professorBoardLessonFixture({ id: "board-no-source-trace", targetPageCount: 8 });
    if (!lesson.pages[0]?.knowledgeBoard) {
      throw new Error("expected fixture page to include knowledgeBoard");
    }
    lesson.pages[0] = {
      ...lesson.pages[0],
      knowledgeBoard: {
        ...lesson.pages[0].knowledgeBoard,
        sourceTrace: []
      }
    };

    const result = evaluateKnowledgeBoardRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.satisfiedPageCount).toBe(7);
    expect(result.pageResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: "board-no-source-trace",
          pageId: "p1",
          status: "failed",
          missingItems: expect.arrayContaining(["knowledgeBoard.sourceTrace"])
        })
      ])
    );
  });

  test("fails invalid boardKind, shallow columns, and source traces outside page anchors", () => {
    const lesson = professorBoardLessonFixture({ id: "board-invalid", targetPageCount: 8 });
    if (!lesson.pages[0]?.knowledgeBoard) {
      throw new Error("expected fixture page to include knowledgeBoard");
    }
    lesson.pages[0] = {
      ...lesson.pages[0],
      sourceAnchorIds: ["source-001:page-1"],
      knowledgeBoard: {
        ...lesson.pages[0].knowledgeBoard,
        boardKind: "summary" as "mechanism_board",
        headline: "关键链路",
        leftColumn: [{ label: "概念", items: ["状态"] }],
        rightColumn: [{ label: "例子", items: ["调用"] }],
        sourceTrace: [{ anchorId: "source-001:page-99", supports: "游离来源不支持当前页。" }]
      }
    };

    const result = evaluateKnowledgeBoardRubric([lesson]);

    expect(result.status).toBe("failed");
    expect(result.pageResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: "board-invalid",
          pageId: "p1",
          status: "failed",
          missingItems: expect.arrayContaining([
            "knowledgeBoard.leftColumn.items",
            "knowledgeBoard.rightColumn.items"
          ]),
          weakItems: expect.arrayContaining([
            "knowledgeBoard.boardKind",
            "knowledgeBoard.sourceTrace"
          ])
        })
      ])
    );
    expect(result.pageResults[0]?.weakItems).not.toContain("knowledgeBoard.headline");
  });
});
