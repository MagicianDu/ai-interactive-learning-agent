import { describe, expect, test } from "vitest";

import { createSourceAnchor, createSourceAnchorId, locatorLabel } from "./source-anchor.js";

describe("source anchors", () => {
  test("creates deterministic path-safe source anchor ids", () => {
    expect(createSourceAnchorId("source-001", ["Chapter 1", "Core Topic: Routing"])).toBe(
      "source-001:chapter-1-core-topic-routing"
    );
  });

  test("creates source anchors with readable labels", () => {
    const anchor = createSourceAnchor({
      sourceId: "source-001",
      label: "权利要求 1",
      locator: { kind: "claim", claimNumber: "1" },
      quote: "权利要求1：一种缓存系统..."
    });

    expect(anchor).toEqual({
      sourceId: "source-001",
      anchorId: "source-001:claim-1",
      label: "权利要求 1",
      locator: { kind: "claim", claimNumber: "1" },
      quote: "权利要求1：一种缓存系统..."
    });
    expect(locatorLabel(anchor.locator)).toBe("claim 1");
  });
});
