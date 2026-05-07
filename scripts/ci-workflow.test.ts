import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("GitHub Actions CI workflow", () => {
  test("uses Node 24 project runtime and Node 24-native JavaScript actions", async () => {
    const workflow = await readFile(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).not.toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24");
  });
});
