import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Lesson } from "../../schemas/lesson.schema";
import { DeckShell } from "./DeckShell";

const twoPageLesson: Lesson = {
  id: "two-page-test-lesson",
  title: "Two page test lesson",
  audience: "Test learners.",
  config: {
    targetPageCount: 2,
  },
  prerequisites: [],
  learningObjectives: ["Move between pages."],
  pages: [
    {
      id: "p01",
      type: "problem_scene",
      title: "First page",
      learningGoal: "Start the lesson.",
      narrative: "This is the first page.",
    },
    {
      id: "p02",
      type: "summary_card",
      title: "Second page",
      learningGoal: "Finish the lesson.",
      narrative: "This is the second page.",
    },
  ],
  misconceptions: [],
  transferTasks: [],
  summary: [],
};

describe("DeckShell", () => {
  test("uses lesson page count for the label and navigation", async () => {
    const user = userEvent.setup();

    render(
      <DeckShell
        lesson={twoPageLesson}
        renderPage={(currentIndex) => (
          <article>
            <h2>{twoPageLesson.pages[currentIndex].title}</h2>
          </article>
        )}
      />,
    );

    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /跳转到第/i })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "跳转到第 1 页" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "跳转到第 2 页" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "跳转到第 10 页" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First page" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(screen.getByRole("heading", { name: "Second page" })).toBeInTheDocument();
    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });

  test("wraps each page in a viewport fit container instead of a scroll container", () => {
    render(
      <DeckShell
        lesson={twoPageLesson}
        renderPage={(currentIndex) => (
          <article>
            <h2>{twoPageLesson.pages[currentIndex].title}</h2>
          </article>
        )}
      />,
    );

    expect(screen.getByTestId("deck-viewport-fit")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("deck-page-stage")).not.toHaveClass("overflow-y-auto");
  });

  test("supports arrow-key page navigation", async () => {
    const user = userEvent.setup();

    render(
      <DeckShell
        lesson={twoPageLesson}
        renderPage={(currentIndex) => (
          <article>
            <h2>{twoPageLesson.pages[currentIndex].title}</h2>
          </article>
        )}
      />,
    );

    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("heading", { name: "Second page" })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("heading", { name: "First page" })).toBeInTheDocument();
  });
});
