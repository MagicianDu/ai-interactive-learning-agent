import { describe, expect, test } from "vitest";

import { coursePackRegistry } from "./registry";

describe("coursePackRegistry", () => {
  test("loads without duplicate course pack ids", () => {
    const ids = coursePackRegistry.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("exposes project metadata for learner project library", () => {
    for (const entry of coursePackRegistry) {
      expect(entry.unitCount).toBe(entry.coursePack.units.length);
      expect(entry.projectStatus).toMatch(/preview-ready|generated|sample/u);
      expect(entry.sourceKind).toBe(entry.coursePack.sourceKind);
      expect(entry.strategy).toBe(entry.coursePack.strategy);
    }
  });
});
