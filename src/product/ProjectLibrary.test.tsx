import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CoursePackRegistryEntry } from "../course-packs/registry";
import { ProjectLibrary } from "./ProjectLibrary";

const course = {
  id: "agentic",
  label: "Agentic 课程",
  modulePath: "./agentic/coursePack.ts",
  projectStatus: "preview-ready",
  sourceKind: "book",
  strategy: "overview_plus_topic",
  unitCount: 3,
  coursePack: {
    id: "agentic",
    title: "Agentic 课程",
    parentRunId: "agentic",
    sourceKind: "book",
    strategy: "overview_plus_topic",
    units: []
  }
} satisfies CoursePackRegistryEntry;

describe("ProjectLibrary", () => {
  it("renders projects and selects a course", async () => {
    const onSelect = vi.fn();
    render(<ProjectLibrary coursePacks={[course]} onSelectCourse={onSelect} selectedCoursePackId="" />);

    await userEvent.click(screen.getByRole("button", { name: /打开 Agentic 课程/u }));

    expect(screen.getByText("book · overview_plus_topic · 3 个单元")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith("agentic");
  });
});
