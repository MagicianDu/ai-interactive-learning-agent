import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { CourseWorkspace } from "./CourseWorkspace";

describe("CourseWorkspace", () => {
  test("renders product mode tabs and course progress", () => {
    render(<CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />);

    expect(screen.getByRole("tab", { name: "学习" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "知识地图" })).toBeInTheDocument();
    expect(screen.getAllByText(/已生成/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/先用总览课建立全局地图/).length).toBeGreaterThan(0);
  });
});
