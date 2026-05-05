import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import type { CoursePack } from "../schemas/course-pack.schema";
import { CanvasMapRenderer } from "./CanvasMapRenderer";

const coursePack: CoursePack = {
  id: "agentic-design-book",
  title: "Agent Workflow Patterns：课程包",
  parentRunId: "agentic-design-book",
  sourceKind: "book",
  strategy: "overview_plus_topic",
  units: [
    {
      unitId: "unit-overview",
      title: "总览课",
      kind: "overview",
      lessonId: "overview-lesson",
      targetPageCount: 10,
      sourceAnchorIds: ["source-001:chapter-01"],
      chapterRefs: ["Chapter 1"],
      conceptIds: ["routing", "planning"]
    },
    {
      unitId: "unit-topic-01",
      title: "路由与任务分派",
      kind: "topic",
      targetPageCount: 10,
      sourceAnchorIds: ["source-001:chapter-02"],
      chapterRefs: ["Chapter 2"],
      conceptIds: ["routing"]
    }
  ],
  conceptCoverage: [
    { conceptId: "routing", status: "covered", unitIds: ["unit-overview", "unit-topic-01"] },
    { conceptId: "planning", status: "partial", unitIds: ["unit-overview"] }
  ],
  sourceCoverage: [
    { sourceNodeId: "source-001:chapter-01", status: "covered", unitIds: ["unit-overview"] },
    { sourceNodeId: "source-001:chapter-02", status: "partial", unitIds: ["unit-topic-01"] }
  ]
};

describe("CanvasMapRenderer", () => {
  test("renders a course knowledge map with units, concepts, and source anchors", () => {
    render(<CanvasMapRenderer coursePack={coursePack} onSelectLesson={() => undefined} selectedLessonId="" />);

    expect(screen.getByRole("heading", { name: "知识地图" })).toBeInTheDocument();
    expect(screen.getByText("已生成单元")).toBeInTheDocument();
    expect(screen.getByText("待生成单元")).toBeInTheDocument();
    expect(screen.getByText("核心概念")).toBeInTheDocument();
    expect(screen.getByText("来源锚点")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("总览课").length).toBeGreaterThan(0);
    expect(screen.getAllByText("路由与任务分派").length).toBeGreaterThan(0);
    expect(screen.getByText("待生成")).toBeInTheDocument();
    expect(screen.getAllByText("routing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("planning").length).toBeGreaterThan(0);
    expect(screen.getByText("source-001:chapter-01")).toBeInTheDocument();
    expect(screen.getByText("概念覆盖：部分覆盖")).toBeInTheDocument();
    expect(screen.getByText("来源覆盖：已覆盖")).toBeInTheDocument();
  });

  test("opens generated lesson units from the map", async () => {
    const onSelectLesson = vi.fn();
    render(<CanvasMapRenderer coursePack={coursePack} onSelectLesson={onSelectLesson} selectedLessonId="" />);

    await userEvent.click(screen.getByRole("button", { name: "打开 总览课" }));

    expect(onSelectLesson).toHaveBeenCalledWith("overview-lesson");
  });

  test("opens the first generated lesson related to a concept node", async () => {
    const onSelectLesson = vi.fn();
    render(<CanvasMapRenderer coursePack={coursePack} onSelectLesson={onSelectLesson} selectedLessonId="" />);

    await userEvent.click(screen.getByRole("button", { name: "打开概念 routing 对应课程" }));

    expect(onSelectLesson).toHaveBeenCalledWith("overview-lesson");
  });
});
