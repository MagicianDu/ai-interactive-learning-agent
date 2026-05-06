import { describe, expect, it } from "vitest";

import { planCourseUnits } from "./course-unit-planner.js";

describe("planCourseUnits", () => {
  it("creates overview plus three topic units for a long book", () => {
    const plan = planCourseUnits({
      runId: "agentic-book",
      topic: "Agent Workflow Patterns",
      sourceKind: "book",
      strategy: "overview_plus_topic",
      unitPageCount: 8,
      selectedTopics: [],
      selectedChapters: [],
      concepts: ["全局地图", "规划模式", "工具使用", "反思机制"],
      sourceAnchorIds: Array.from({ length: 12 }, (_, index) => `source-001:p${index + 1}`),
      sourceNodeIds: ["source-001:root"]
    });

    expect(plan.overviewUnitId).toBe("unit-overview");
    expect(plan.units.map((unit) => unit.unitId)).toEqual(["unit-overview", "unit-topic-01", "unit-topic-02", "unit-topic-03"]);
    expect(plan.units[0]).toMatchObject({ kind: "overview", lessonId: "agentic-book-overview" });
    expect(plan.units.filter((unit) => unit.kind === "topic")).toHaveLength(3);
  });

  it("uses selected topics before inferred concepts", () => {
    const plan = planCourseUnits({
      runId: "paper-course",
      topic: "论文课程",
      sourceKind: "paper",
      strategy: "overview_plus_topic",
      unitPageCount: 10,
      selectedTopics: ["研究问题", "实验设计"],
      selectedChapters: [],
      concepts: ["方法结构", "证据边界"],
      sourceAnchorIds: ["paper:p1", "paper:p2", "paper:p3"],
      sourceNodeIds: ["paper:root"]
    });

    expect(plan.units.map((unit) => unit.title)).toContain("论文课程：研究问题");
    expect(plan.units.map((unit) => unit.title)).toContain("论文课程：实验设计");
    expect(plan.units[1]?.focusConcepts).toEqual(["研究问题"]);
    expect(plan.units[2]?.focusConcepts).toEqual(["实验设计"]);
  });

  it.each([
    ["chapter_guided", "chapter", "unit-chapter-01"],
    ["task_guided", "task", "unit-task-01"],
    ["hybrid", "hybrid", "unit-hybrid-01"],
    ["topic_guided", "topic", "unit-topic-01"],
    ["unknown", "topic", "unit-topic-01"]
  ])("maps strategy %s to focused unit kind %s", (strategy, expectedKind, expectedUnitId) => {
    const plan = planCourseUnits({
      runId: "strategy-course",
      topic: "策略课程",
      sourceKind: "book",
      strategy,
      unitPageCount: 8,
      selectedTopics: ["目标拆解", "练习路径"],
      selectedChapters: ["第 1 章"],
      concepts: ["概念结构", "迁移应用"],
      sourceAnchorIds: ["book:p1", "book:p2", "book:p3", "book:p4"],
      sourceNodeIds: ["book:root"]
    });

    expect(plan.units[1]).toMatchObject({
      unitId: expectedUnitId,
      kind: expectedKind,
      chapterRefs: ["第 1 章"]
    });
  });

  it("pads sparse input so every source-backed course has at least two focused units", () => {
    const plan = planCourseUnits({
      runId: "sparse-course",
      topic: "短资料课程",
      sourceKind: "blog",
      strategy: "overview_plus_topic",
      unitPageCount: 6,
      selectedTopics: [],
      selectedChapters: [],
      concepts: ["全局地图"],
      sourceAnchorIds: ["blog:p1"],
      sourceNodeIds: ["blog:root"]
    });

    expect(plan.units).toHaveLength(3);
    expect(plan.units.map((unit) => unit.unitId)).toEqual(["unit-overview", "unit-topic-01", "unit-topic-02"]);
    expect(plan.units.filter((unit) => unit.kind !== "overview")).toHaveLength(2);
  });

  it("records effective strategy, recommendation reason, and course acceptance expectations", () => {
    const plan = planCourseUnits({
      runId: "unknown-strategy-course",
      topic: "复杂技术书",
      sourceKind: "book",
      strategy: "unknown",
      unitPageCount: 8,
      selectedTopics: [],
      selectedChapters: ["第 1 章", "第 2 章"],
      concepts: ["全局地图", "核心机制", "迁移应用"],
      sourceAnchorIds: ["book:c1", "book:c2", "book:c3", "book:c4"],
      sourceNodeIds: ["book:root", "book:chapter-1", "book:chapter-2"]
    });

    expect(plan.strategy).toBe("overview_plus_topic");
    expect(plan.strategyReason).toContain("未识别");
    expect(plan.acceptanceExpectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "overview-plus-focused-units",
          scope: "course",
          required: true
        }),
        expect.objectContaining({
          id: "source-mapping-preserved",
          scope: "course",
          required: true
        })
      ])
    );
    expect(plan.units[1]).toMatchObject({
      expectedInteractions: expect.arrayContaining(["prediction", "comparison"]),
      expectedAssessments: expect.arrayContaining(["misconception_check", "transfer_challenge"]),
      expectedSourceCoverage: {
        minSourceAnchorCount: 1,
        preserveChapterRefs: true
      }
    });
  });

  it("adds task labels and transfer expectations for task-guided units", () => {
    const plan = planCourseUnits({
      runId: "task-course",
      topic: "Agentic RAG",
      sourceKind: "blog",
      strategy: "task_guided",
      unitPageCount: 8,
      selectedTopics: ["判断是否需要检索", "选择工具"],
      selectedChapters: [],
      concepts: ["实践问题", "操作流程", "评估方式"],
      sourceAnchorIds: ["blog:p1", "blog:p2", "blog:p3", "blog:p4"],
      sourceNodeIds: ["blog:root"]
    });

    expect(plan.strategy).toBe("task_guided");
    expect(plan.strategyReason).toContain("任务");
    expect(plan.units[1]).toMatchObject({
      kind: "task",
      taskLabel: "任务：判断是否需要检索",
      transferExpectation: "把同一判断步骤迁移到新的真实任务或资料片段。",
      expectedInteractions: expect.arrayContaining(["debugging", "comparison"])
    });
  });
});
