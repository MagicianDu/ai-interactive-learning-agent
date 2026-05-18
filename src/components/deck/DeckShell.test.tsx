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
  test("keeps navigation without repeating lesson title or page count", async () => {
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

    expect(screen.queryByText("Two page test lesson")).not.toBeInTheDocument();
    expect(screen.queryByText("Test learners.")).not.toBeInTheDocument();
    expect(screen.queryByText("第 1 / 2 页")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First page" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(screen.getByRole("heading", { name: "Second page" })).toBeInTheDocument();
    expect(screen.queryByText("第 2 / 2 页")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });

  test("renders page navigation as a bottom translucent overlay instead of a top header", () => {
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

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByTestId("deck-navigation-overlay")).toHaveClass("absolute", "bottom-4", "z-20");
    expect(screen.getByRole("navigation", { name: "课程翻页" })).toHaveClass(
      "bg-transparent",
      "hover:bg-white/60",
      "focus-within:bg-white/60",
      "backdrop-blur-0",
      "hover:backdrop-blur-md"
    );
    expect(screen.getByRole("button", { name: "下一页" })).toHaveClass("bg-transparent", "opacity-25", "hover:bg-accent/90");
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
