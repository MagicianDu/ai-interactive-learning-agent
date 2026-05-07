import { describe, expect, it } from "vitest";

import { parseRevisionTarget, parseRevisionTargetV2 } from "./revision-targeting.js";

describe("parseRevisionTarget", () => {
  it("targets a page from Chinese feedback", () => {
    expect(parseRevisionTarget("第 3 页太抽象，换成工程例子")).toEqual({
      scope: "page",
      pageIndex: 2,
      requestedChange: "第 3 页太抽象，换成工程例子"
    });
  });

  it("targets a page from focus text", () => {
    expect(parseRevisionTarget("换成工程例子", "第十页")).toEqual({
      scope: "page",
      pageIndex: 9,
      requestedChange: "换成工程例子"
    });
  });

  it("targets course structure", () => {
    expect(parseRevisionTarget("课程结构要按章节组织，不要只按 topic")).toMatchObject({
      scope: "course"
    });
  });

  it("targets learner interactions", () => {
    expect(parseRevisionTarget("互动操作太少，加一个参数实验")).toMatchObject({
      scope: "interaction"
    });
  });

  it("targets assessment feedback", () => {
    expect(parseRevisionTarget("测验题太简单，评估要更像真实 debugging")).toMatchObject({
      scope: "assessment"
    });
  });

  it("targets source grounding", () => {
    expect(parseRevisionTarget("来源引用和锚点不够清楚")).toMatchObject({
      scope: "source"
    });
  });

  it("defaults to unit scope", () => {
    expect(parseRevisionTarget("这一段太抽象，请换成更具体的工程例子")).toEqual({
      scope: "unit",
      requestedChange: "这一段太抽象，请换成更具体的工程例子"
    });
  });

  it("v2 classifies explicit page feedback with category and confidence", () => {
    expect(parseRevisionTargetV2("第 3 页太抽象，换成工程例子")).toMatchObject({
      scope: "page",
      requestedChange: "第 3 页太抽象，换成工程例子",
      pageIndex: 2,
      pageNumber: 3,
      categories: ["too_abstract", "example_missing"],
      confidence: "high"
    });
  });

  it("v2 resolves current page context when learner says this page", () => {
    expect(
      parseRevisionTargetV2("这页来源依据不清楚", {
        currentCourseId: "course-a",
        currentUnitId: "unit-overview",
        currentLessonId: "lesson-a",
        currentPageId: "p4",
        currentPageIndex: 3
      })
    ).toMatchObject({
      scope: "page",
      requestedChange: "这页来源依据不清楚",
      courseId: "course-a",
      unitId: "unit-overview",
      lessonId: "lesson-a",
      pageId: "p4",
      pageIndex: 3,
      pageNumber: 4,
      categories: ["source_unclear"],
      confidence: "high"
    });
  });

  it("v2 returns one learner-answerable clarification for ambiguous page-like feedback", () => {
    expect(parseRevisionTargetV2("这页太抽象")).toMatchObject({
      scope: "page",
      requestedChange: "这页太抽象",
      categories: ["too_abstract"],
      confidence: "low",
      clarificationQuestion: "你想修改哪一页？请告诉我页码，或先打开要修改的页面。"
    });
  });

  it("v2 classifies coarse learner difficulty and practice feedback", () => {
    expect(parseRevisionTargetV2("整体太难了，练习也不够")).toMatchObject({
      scope: "unit",
      categories: ["too_hard", "more_practice"],
      confidence: "medium"
    });
  });
});
