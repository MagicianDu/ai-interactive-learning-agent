import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { CourseWorkspace } from "./CourseWorkspace";

describe("CourseWorkspace", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "#/");
  });

  test("opens directly into the learner lesson instead of developer panels", () => {
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.getAllByText(/第 1 \//).length).toBeGreaterThan(0);
    expect(screen.getAllByText("智能体工作流公开示例：总览课").length).toBeGreaterThan(0);
    expect(screen.getByText("当前学习单元")).toBeInTheDocument();
    expect(screen.getByText(/策略：/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "课程结构" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "来源依据" })).toBeInTheDocument();
    expect(screen.queryByLabelText("生成进度")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("分享和导出")).not.toBeInTheDocument();
    expect(screen.queryByText("把技术资料变成可交互的中文学习体验")).not.toBeInTheDocument();
    expect(screen.queryByText("讨论")).not.toBeInTheDocument();
    expect(screen.queryByText("设置")).not.toBeInTheDocument();
  });

  test("uses a fixed learning viewport without body vertical scroll", () => {
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.getByTestId("learning-main-viewport")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("desktop-learning-sidebar")).toHaveClass("hidden", "lg:block");
    expect(screen.getByTestId("workspace-status-strip")).toHaveClass("hidden", "lg:block");
    expect(getComputedStyle(document.body).overflow).toBe("hidden");
    expect(document.body.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
  });

  test("opens the course, unit, and page from a stable hash route", () => {
    const routedCourse = coursePackRegistry.find((entry) => entry.coursePack.units.some((unit) => unit.lessonId));
    const routedUnit = routedCourse?.coursePack.units.find((unit) => unit.lessonId);
    if (!routedCourse || !routedUnit) {
      throw new Error("expected at least one routable course pack");
    }
    window.history.replaceState(null, "", `#/course/${routedCourse.id}/unit/${routedUnit.unitId}/page/2`);

    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.getAllByText(/第 2 \//).length).toBeGreaterThan(0);
    expect(window.location.hash).toBe(`#/course/${routedCourse.id}/unit/${routedUnit.unitId}/page/2`);
  });

  test("updates the stable hash route when the learner changes page", async () => {
    const user = userEvent.setup();
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(window.location.hash).toMatch(/^#\/course\/[a-z0-9-]+\/unit\/[a-z0-9-]+\/page\/2$/u);
  });

  test("opens the learner project library without replacing the default learning flow", async () => {
    const user = userEvent.setup();
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.queryByText("选择要继续学习的课程")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "项目库" }));

    expect(screen.getByText("选择要继续学习的课程")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /打开 /u }).length).toBeGreaterThan(0);
  });

  test("opens source grounding as a course-aware learner page", async () => {
    const user = userEvent.setup();
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    await user.click(screen.getByRole("button", { name: "来源依据" }));

    expect(screen.getByRole("heading", { name: "来源依据" })).toBeInTheDocument();
    expect(screen.getByText("当前页来源锚点")).toBeInTheDocument();
    expect(screen.getByText("课程来源覆盖")).toBeInTheDocument();
    expect(screen.getByText("单元来源映射")).toBeInTheDocument();
  });

  test("sidebar product modes show actionable learner surfaces", async () => {
    const user = userEvent.setup();
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    await user.click(screen.getByRole("button", { name: "练习" }));
    expect(screen.getByRole("heading", { name: "练习模式" })).toBeInTheDocument();
    expect(screen.getByText("掌握度路径")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "教师" }));
    expect(screen.getByRole("heading", { name: "教师模式" })).toBeInTheDocument();
    expect(screen.getByText("可直接使用的课堂动作")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "实验" }));
    expect(screen.getByRole("heading", { name: "实验模式" })).toBeInTheDocument();
    expect(screen.getByText("实验记录")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "导师" }));
    expect(screen.getByRole("heading", { name: "导师模式" })).toBeInTheDocument();
    expect(screen.getByText("当前页辅导策略")).toBeInTheDocument();
  });
});
