import { describe, expect, test } from "vitest";

import { coursePackRegistry } from "./registry";

describe("coursePackRegistry", () => {
  test("loads without duplicate course pack ids", () => {
    const ids = coursePackRegistry.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps registered samples open-source safe", () => {
    for (const entry of coursePackRegistry) {
      expect(JSON.stringify(entry.coursePack)).not.toMatch(/\/Users\/dm|Documents\/1\.书籍资料|Agentic Design Patterns/u);
    }
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
