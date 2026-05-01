import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { CourseWorkspace } from "./CourseWorkspace";

describe("CourseWorkspace", () => {
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
});
