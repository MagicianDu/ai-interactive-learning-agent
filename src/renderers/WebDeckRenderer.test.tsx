import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { databaseIndexLesson } from "../lessons/database-index/lesson";
import type { Lesson } from "../schemas/lesson.schema";
import { WebDeckRenderer } from "./WebDeckRenderer";

describe("WebDeckRenderer", () => {
  test("renders the database index lesson with its actual 10 page count", () => {
    render(<WebDeckRenderer lesson={databaseIndexLesson} />);

    expect(databaseIndexLesson.pages).toHaveLength(10);
    expect(
      screen.getByRole("heading", { level: 2, name: "问题引入：为什么全表扫描慢？" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("第 1 / 10 页")).toHaveLength(2);
  });

  test("renders a shorter lesson with a matching configured target count", () => {
    const shorterLesson: Lesson = {
      ...databaseIndexLesson,
      id: "database-index-shorter-test",
      config: {
        ...databaseIndexLesson.config,
        targetPageCount: 6,
      },
      pages: databaseIndexLesson.pages.slice(0, 6),
    };

    render(<WebDeckRenderer lesson={shorterLesson} />);

    expect(screen.getAllByText("第 1 / 6 页")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "跳转到第 6 页" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "跳转到第 7 页" })).not.toBeInTheDocument();
  });

  test("renders explicit fallback states for incomplete generated page specs", () => {
    const incompleteLesson: Lesson = {
      ...databaseIndexLesson,
      id: "incomplete-generated-test",
      pages: [
        {
          id: "p1",
          type: "problem_scene",
          title: "缺少规格的页面",
          learningGoal: "识别待补充状态",
          narrative: "这页还没有生成完整规格。"
        }
      ],
      config: {
        targetPageCount: 1
      }
    };

    render(<WebDeckRenderer lesson={incompleteLesson} />);

    expect(screen.getByText("视觉说明待补充")).toBeInTheDocument();
    expect(screen.getByText("互动或评估待补充")).toBeInTheDocument();
  });

  test("accepts an initial page index and reports page changes", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <WebDeckRenderer
        initialPageIndex={1}
        lesson={databaseIndexLesson}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getAllByText("第 2 / 10 页")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getAllByText("第 3 / 10 页")).toHaveLength(2);
  });
});
