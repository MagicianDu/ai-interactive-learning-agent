import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { LessonPage } from "../../schemas/lesson.schema";
import { DeckPage } from "./DeckPage";

const page: LessonPage = {
  id: "p1",
  type: "problem_scene",
  title: "为什么要看来源",
  learningGoal: "理解来源依据，并能说出本页的关键结构。",
  narrative:
    "学习内容需要能回到资料证据。学习者还需要在同一页看到问题、关键结构和状态变化，而不是只看到一小段被截断的摘要。",
  sourceAnchorIds: ["source-001:page-1", "source-001:paragraph-2"]
};

describe("DeckPage", () => {
  test("keeps source anchors out of the fixed teaching page body", () => {
    render(<DeckPage page={page} pageNumber={1} totalPages={8} />);

    expect(screen.getByText("为什么要看来源")).toBeInTheDocument();
    expect(screen.queryByText("来源依据")).not.toBeInTheDocument();
    expect(screen.queryByText("source-001:page-1")).not.toBeInTheDocument();
  });

  test("renders a richer teaching brief without clamping core lesson text", () => {
    const richPage: LessonPage = {
      ...page,
      visualSpec: {
        kind: "flow",
        description: "把来源证据转化成可学习的心智模型。",
        keyElements: ["来源证据", "关键结构", "学习动作"],
        states: ["读取资料", "抽取结构", "形成可迁移模型"]
      }
    };

    render(<DeckPage page={richPage} pageNumber={1} totalPages={8} />);

    expect(screen.getByText(richPage.narrative)).not.toHaveClass("line-clamp-3");
    expect(screen.getByText("本页要抓住")).toBeInTheDocument();
    expect(screen.getByText("理解来源依据，并能说出本页的关键结构。")).toBeInTheDocument();
    expect(screen.queryByText("来源证据")).not.toBeInTheDocument();
    expect(screen.queryByText("形成可迁移模型")).not.toBeInTheDocument();
  });
});
