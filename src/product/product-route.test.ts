import { describe, expect, it } from "vitest";

import { buildProductRoute, parseProductRoute } from "./product-route";

describe("product-route", () => {
  it("parses course, unit, and page hash routes", () => {
    expect(parseProductRoute("#/course/agentic/unit/unit-topic-01/page/3")).toEqual({
      courseId: "agentic",
      unitId: "unit-topic-01",
      pageIndex: 2
    });
  });

  it("parses generated preview routes", () => {
    expect(parseProductRoute("#/preview/mock-run/unit/unit-overview/page/2")).toEqual({
      previewRunId: "mock-run",
      unitId: "unit-overview",
      pageIndex: 1
    });
  });

  it("builds stable hash routes", () => {
    expect(buildProductRoute({ courseId: "agentic", unitId: "unit-overview", pageIndex: 0 })).toBe(
      "#/course/agentic/unit/unit-overview/page/1"
    );
  });

  it("builds generated preview hash routes", () => {
    expect(buildProductRoute({ previewRunId: "mock-run", unitId: "unit-overview", pageIndex: 0 })).toBe(
      "#/preview/mock-run/unit/unit-overview/page/1"
    );
  });
});
