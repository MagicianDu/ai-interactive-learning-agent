import { describe, expect, it } from "vitest";

import { parseRevisionTarget } from "./revision-targeting.js";

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
});
