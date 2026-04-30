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
  test("renders source anchors for source-backed pages", () => {
    render(<DeckPage page={page} pageNumber={1} totalPages={8} />);

    expect(screen.getByText("来源依据")).toBeInTheDocument();
    expect(screen.getByText("source-001:page-1")).toBeInTheDocument();
    expect(screen.getByText("source-001:paragraph-2")).toBeInTheDocument();
  });
});
