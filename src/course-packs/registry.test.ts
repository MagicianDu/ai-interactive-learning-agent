import { describe, expect, test } from "vitest";

import { coursePackRegistry } from "./registry";

describe("coursePackRegistry", () => {
  test("loads without duplicate course pack ids", () => {
    const ids = coursePackRegistry.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
