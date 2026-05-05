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

  test("keeps registered lessons open-source safe", () => {
    for (const entry of lessonRegistry) {
      expect(JSON.stringify(entry.lesson)).not.toMatch(/\/Users\/dm|Documents\/1\.书籍资料|Agentic Design Patterns/u);
    }
  });
});
