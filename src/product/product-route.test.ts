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

  it("builds stable hash routes", () => {
    expect(buildProductRoute({ courseId: "agentic", unitId: "unit-overview", pageIndex: 0 })).toBe(
      "#/course/agentic/unit/unit-overview/page/1"
    );
  });
});
