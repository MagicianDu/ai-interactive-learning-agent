import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { LessonPage } from "../../schemas/lesson.schema";
import { DeckPage } from "./DeckPage";

const page: LessonPage = {
  id: "p1",
  type: "problem_scene",
  title: "为什么要看来源",
  learningGoal: "理解来源依据",
  narrative: "学习内容需要能回到资料证据。",
  sourceAnchorIds: ["source-001:page-1", "source-001:paragraph-2"]
};

describe("DeckPage", () => {
  test("keeps source anchors out of the fixed teaching page body", () => {
    render(<DeckPage page={page} pageNumber={1} totalPages={8} />);

    expect(screen.getByText("为什么要看来源")).toBeInTheDocument();
    expect(screen.queryByText("来源依据")).not.toBeInTheDocument();
    expect(screen.queryByText("source-001:page-1")).not.toBeInTheDocument();
  });
});
