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
    expect(screen.getByRole("button", { name: "课程结构" })).toBeInTheDocument();
    expect(screen.queryByLabelText("生成进度")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("分享和导出")).not.toBeInTheDocument();
    expect(screen.queryByText("把技术资料变成可交互的中文学习体验")).not.toBeInTheDocument();
    expect(screen.queryByText("讨论")).not.toBeInTheDocument();
    expect(screen.queryByText("设置")).not.toBeInTheDocument();
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
});
