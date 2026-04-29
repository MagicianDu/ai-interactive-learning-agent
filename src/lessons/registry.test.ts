import { describe, expect, test } from "vitest";

import { lessonRegistry } from "./registry";

describe("lessonRegistry", () => {
  test("auto-discovers promoted lessons", () => {
    expect(lessonRegistry.map((entry) => entry.id)).toContain("database-index-speed");
    expect(lessonRegistry.length).toBeGreaterThan(0);
  });

  test("does not register duplicate lesson ids", () => {
    const ids = lessonRegistry.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
