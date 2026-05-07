import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("GitHub Actions CI workflow", () => {
  test("uses Node 24 for project runtime and JavaScript actions", async () => {
    const workflow = await readFile(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true");
  });
});
