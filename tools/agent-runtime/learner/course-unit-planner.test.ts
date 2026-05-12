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

  it("expands chapter-guided long books into one unit per requested chapter with explicit page budget", () => {
    const plan = planCourseUnits({
      runId: "long-book",
      topic: "控制方法论",
      sourceKind: "book",
      strategy: "chapter_guided",
      unitPageCount: 10,
      selectedTopics: [],
      selectedChapters: ["第 1 章", "第 2 章", "第 3 章", "第 4 章", "第 5 章"],
      concepts: ["全局地图", "控制循环", "反馈机制", "系统边界"],
      sourceAnchorIds: Array.from({ length: 25 }, (_, index) => `book:c${Math.floor(index / 5) + 1}:p${index + 1}`),
      sourceNodeIds: ["book:root", "book:chapter-1", "book:chapter-2", "book:chapter-3", "book:chapter-4", "book:chapter-5"]
    });

    expect(plan.units).toHaveLength(6);
    expect(plan.estimatedTotalPages).toBe(60);
    expect(plan.units.slice(1).map((unit) => unit.title)).toEqual([
      "控制方法论：第 1 章",
      "控制方法论：第 2 章",
      "控制方法论：第 3 章",
      "控制方法论：第 4 章",
      "控制方法论：第 5 章"
    ]);
    expect(plan.sourceCoveragePlan).toMatchObject({
      coverageMode: "selected_chapters",
      requestedChapterCount: 5,
      focusedUnitCount: 5,
      totalUnitCount: 6,
      totalPageBudget: 60
    });
    expect(plan.planningNotes).toEqual(expect.arrayContaining([expect.stringContaining("总页数约 60")]));
    for (const unit of plan.units.slice(1)) {
      expect(unit.kind).toBe("chapter");
      expect(unit.targetPageCount).toBe(10);
      expect(unit.expectedSourceCoverage.preserveChapterRefs).toBe(true);
    }
  });

  it("keeps at least two focused units when only one chapter or topic is selected", () => {
    const chapterPlan = planCourseUnits({
      runId: "single-chapter",
      topic: "单章课程",
      sourceKind: "book",
      strategy: "chapter_guided",
      unitPageCount: 8,
      selectedTopics: [],
      selectedChapters: ["第 1 章"],
      concepts: ["全局地图", "核心机制", "迁移应用"],
      sourceAnchorIds: ["book:c1:p1", "book:c1:p2"],
      sourceNodeIds: ["book:root", "book:chapter-1"]
    });
    const topicPlan = planCourseUnits({
      runId: "single-topic",
      topic: "单 topic 课程",
      sourceKind: "paper",
      strategy: "topic_guided",
      unitPageCount: 8,
      selectedTopics: ["method"],
      selectedChapters: [],
      concepts: ["方法结构", "证据边界"],
      sourceAnchorIds: ["paper:p1", "paper:p2"],
      sourceNodeIds: ["paper:root"]
    });

    expect(chapterPlan.units).toHaveLength(3);
    expect(chapterPlan.units.slice(1).map((unit) => unit.title)).toEqual(["单章课程：第 1 章", "单章课程：核心机制"]);
    expect(topicPlan.units).toHaveLength(3);
    expect(topicPlan.units.slice(1).map((unit) => unit.title)).toEqual(["单 topic 课程：method", "单 topic 课程：方法结构"]);
  });

  it("uses source chapter hints as deep core-pattern units for overview-plus-topic book plans", () => {
    const plan = planCourseUnits({
      runId: "agentic-patterns",
      topic: "Agentic Design Patterns",
      sourceKind: "book",
      strategy: "overview_plus_topic",
      unitPageCount: 10,
      selectedTopics: [],
      selectedChapters: [],
      concepts: ["全局地图", "核心机制"],
      sourceAnchorIds: ["book:intro", "book:c1", "book:c2", "book:c3"],
      sourceNodeIds: ["book:root", "book:chapter-1", "book:chapter-2", "book:chapter-3"],
      sourceChapters: [
        {
          title: "Chapter 1: Prompt Chaining",
          sourceNodeId: "book:chapter-1",
          sourceAnchorIds: ["book:c1"]
        },
        {
          title: "Chapter 2: Routing",
          sourceNodeId: "book:chapter-2",
          sourceAnchorIds: ["book:c2"]
        },
        {
          title: "Chapter 3: Parallelization",
          sourceNodeId: "book:chapter-3",
          sourceAnchorIds: ["book:c3"]
        }
      ]
    });

    expect(plan.sourceCoveragePlan.coverageMode).toBe("inferred_chapters");
    expect(plan.units.map((unit) => unit.title)).toEqual([
      "Agentic Design Patterns：总览课",
      "Agentic Design Patterns：Chapter 1: Prompt Chaining",
      "Agentic Design Patterns：Chapter 2: Routing",
      "Agentic Design Patterns：Chapter 3: Parallelization"
    ]);
    expect(plan.units[1]).toMatchObject({
      kind: "topic",
      sourceAnchorIds: ["book:c1"],
      sourceNodeIds: ["book:chapter-1"],
      chapterRefs: ["Chapter 1: Prompt Chaining"],
      focusConcepts: ["Chapter 1: Prompt Chaining"]
    });
    expect(plan.units[2]?.sourceAnchorIds).toEqual(["book:c2"]);
    expect(plan.units[3]?.sourceAnchorIds).toEqual(["book:c3"]);
  });

  it("distributes self-study total page budgets across planned units", () => {
    const plan = planCourseUnits({
      runId: "self-study-book",
      topic: "Agentic Design Patterns",
      sourceKind: "book",
      strategy: "overview_plus_topic",
      courseIntent: "student_self_study_textbook",
      unitPageCount: 10,
      targetTotalPages: 80,
      selectedTopics: [],
      selectedChapters: [],
      concepts: ["全局地图", "Prompt Chaining", "Routing", "Parallelization", "Reflection"],
      sourceAnchorIds: Array.from({ length: 20 }, (_, index) => `book:p${index + 1}`),
      sourceNodeIds: ["book:root"],
      sourceChapters: [
        { title: "Prompt Chaining", sourceNodeId: "book:c1", sourceAnchorIds: ["book:p1"] },
        { title: "Routing", sourceNodeId: "book:c2", sourceAnchorIds: ["book:p2"] },
        { title: "Parallelization", sourceNodeId: "book:c3", sourceAnchorIds: ["book:p3"] },
        { title: "Reflection", sourceNodeId: "book:c4", sourceAnchorIds: ["book:p4"] },
        { title: "Tool Use", sourceNodeId: "book:c5", sourceAnchorIds: ["book:p5"] },
        { title: "Planning", sourceNodeId: "book:c6", sourceAnchorIds: ["book:p6"] },
        { title: "Evaluation", sourceNodeId: "book:c7", sourceAnchorIds: ["book:p7"] }
      ]
    });

    expect(plan.estimatedTotalPages).toBe(80);
    expect(plan.sourceCoveragePlan.totalPageBudget).toBe(80);
    expect(plan.planningNotes.join("\n")).toContain("总页数约 80");
    expect(plan.units).toHaveLength(8);
    expect(plan.units.every((unit) => unit.targetPageCount >= 8 && unit.targetPageCount <= 12)).toBe(true);
  });
});
