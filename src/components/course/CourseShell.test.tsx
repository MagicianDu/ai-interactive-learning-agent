import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { CourseShell } from "./CourseShell";
import type { CoursePack } from "../../schemas/course-pack.schema";

const coursePack: CoursePack = {
  id: "agentic-design-book-course-pack",
  title: "Agentic Design Patterns：课程包",
  parentRunId: "agentic-design-book",
  sourceKind: "book",
  strategy: "overview_plus_topic",
  overviewUnitId: "unit-overview",
  units: [
    {
      unitId: "unit-overview",
      title: "总览课",
      kind: "overview",
      lessonId: "overview-lesson",
      targetPageCount: 10,
      sourceAnchorIds: ["source-001:chapter-01"],
      sourceNodeIds: ["source-001:root"],
      chapterRefs: ["Chapter 1"],
      conceptIds: ["routing"]
    },
    {
      unitId: "unit-topic-01",
      title: "路由与任务分派",
      kind: "topic",
      targetPageCount: 10,
      sourceAnchorIds: ["source-001:chapter-02"],
      sourceNodeIds: ["source-001:root"],
      chapterRefs: ["Chapter 2"],
      conceptIds: ["routing", "planning"]
    }
  ],
  chapterMapping: [
    {
      chapterId: "source-001:chapter-01",
      title: "Chapter 1",
      unitIds: ["unit-overview"],
      anchorIds: ["source-001:chapter-01"]
    },
    {
      chapterId: "source-001:chapter-02",
      title: "Chapter 2",
      unitIds: ["unit-topic-01"],
      anchorIds: ["source-001:chapter-02"]
    }
  ],
  sourceCoverage: [
    { sourceNodeId: "source-001:chapter-01", status: "covered", unitIds: ["unit-overview"] },
    { sourceNodeId: "source-001:chapter-02", status: "partial", unitIds: ["unit-topic-01"] }
  ],
  conceptCoverage: [
    { conceptId: "routing", status: "covered", unitIds: ["unit-overview", "unit-topic-01"] },
    { conceptId: "planning", status: "partial", unitIds: ["unit-topic-01"] }
  ]
};

describe("CourseShell", () => {
  test("renders course metadata and unit generation status", () => {
    render(
      <CourseShell
        coursePack={coursePack}
        onSelectLesson={() => undefined}
        selectedLessonId="overview-lesson"
        units={[
          { unit: coursePack.units[0]!, lessonAvailable: true },
          { unit: coursePack.units[1]!, lessonAvailable: false }
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Agentic Design Patterns：课程包" })).toBeInTheDocument();
    expect(screen.getByText("book")).toBeInTheDocument();
    expect(screen.getByText("overview_plus_topic")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /总览课/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /路由与任务分派/ })).toBeDisabled();
    expect(screen.getByText("已生成")).toBeInTheDocument();
    expect(screen.getByText("待生成")).toBeInTheDocument();
    expect(screen.getByText("来源覆盖")).toBeInTheDocument();
    expect(screen.getByText("概念覆盖")).toBeInTheDocument();
    expect(screen.getByText("source-001:chapter-02")).toBeInTheDocument();
    expect(screen.getByText("planning")).toBeInTheDocument();
  });

  test("selects generated units and renders source mapping", async () => {
    const onSelectLesson = vi.fn();
    render(
      <CourseShell
        coursePack={coursePack}
        onSelectLesson={onSelectLesson}
        selectedLessonId=""
        units={[
          { unit: coursePack.units[0]!, lessonAvailable: true },
          { unit: coursePack.units[1]!, lessonAvailable: false }
        ]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /总览课/ }));

    expect(onSelectLesson).toHaveBeenCalledWith("overview-lesson");
    expect(screen.getByText("来源映射")).toBeInTheDocument();
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Chapter 2")).toBeInTheDocument();
  });

  test("falls back to unit-level source anchors when chapter mapping is not available", () => {
    render(
      <CourseShell
        coursePack={{ ...coursePack, chapterMapping: undefined, units: [{ ...coursePack.units[0]!, chapterRefs: undefined }] }}
        onSelectLesson={() => undefined}
        selectedLessonId="overview-lesson"
        units={[{ unit: { ...coursePack.units[0]!, chapterRefs: undefined }, lessonAvailable: true }]}
      />
    );

    expect(screen.getByText("总览课 · 来源锚点")).toBeInTheDocument();
    expect(screen.getByText(/anchors: 1/)).toBeInTheDocument();
  });

  test("filters units by search text and generation status", async () => {
    render(
      <CourseShell
        coursePack={coursePack}
        onSelectLesson={() => undefined}
        selectedLessonId=""
        units={[
          { unit: coursePack.units[0]!, lessonAvailable: true },
          { unit: coursePack.units[1]!, lessonAvailable: false }
        ]}
      />
    );

    await userEvent.type(screen.getByRole("searchbox", { name: "搜索课程单元" }), "路由");

    expect(screen.queryByRole("button", { name: /总览课/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /路由与任务分派/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "已生成" }));

    expect(screen.getByText("没有匹配的课程单元")).toBeInTheDocument();
  });
});
