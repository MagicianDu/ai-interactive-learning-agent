# Codex Quality Calibration Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a learner-facing `learning_agent.calibrate_learning_course` tool that turns quality reports into concrete Codex revision briefs for structure, source, and learner calibration.

**Architecture:** Add a focused calibration service under `tools/agent-runtime/learner/`. The service reads the current preview manifest and `course-quality-report.json`, decides whether calibration is complete or a bounded revision is required, writes calibration artifacts under `runs/<run-id>/quality/calibration/`, and returns a Codex instruction. Runtime and MCP tool contracts expose the service without changing the renderer or auto-editing lessons.

**Tech Stack:** TypeScript, Vitest, local MCP runtime tools, existing learner quality reports, existing preview manifests.

---

### Task 1: Calibration Service Contract

**Files:**
- Create: `tools/agent-runtime/learner/calibration-service.ts`
- Test: `tools/agent-runtime/learner/calibration-service.test.ts`
- Modify: `tools/agent-runtime/index.ts`

- [ ] **Step 1: Write failing service tests**

Create `tools/agent-runtime/learner/calibration-service.test.ts` with tests for:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { CalibrationService } from "./calibration-service.js";

describe("CalibrationService", () => {
  test("returns calibration_complete when a preview already meets stop criteria", async () => {
    const root = await fixtureRoot("complete-course", qualityReport({ status: "passed", score: 94, issues: [] }));
    const result = await new CalibrationService(root).calibrate({ runId: "complete-course" });

    expect(result).toMatchObject({
      status: "calibration_complete",
      runId: "complete-course",
      round: 0,
      maxRounds: 3,
      stopReason: "quality already meets calibration stop criteria",
      previewUrl: "http://127.0.0.1:5173/#/preview/complete-course"
    });
  });

  test("creates a source calibration brief from source synthesis warnings", async () => {
    const root = await fixtureRoot(
      "weak-source-course",
      qualityReport({
        status: "warning",
        score: 85,
        issues: [
          {
            issueId: "quality.page.source-synthesis-weak",
            scope: "page",
            severity: "warning",
            category: "source_evidence",
            lessonId: "lesson-a",
            pageId: "page-03",
            reason: "page has source anchors but does not synthesize source-specific terms",
            requiredFix: "Use the source anchor to teach a specific source term."
          }
        ]
      })
    );

    const result = await new CalibrationService(root).calibrate({ runId: "weak-source-course" });

    expect(result.status).toBe("revision_required");
    expect(result.round).toBe(1);
    expect(result.calibrationKind).toBe("source");
    expect(result.revisionBriefPath).toContain("round-001-source.json");
    expect(result.codexInstruction).toContain("本轮目标：source calibration");
    expect(result.codexInstruction).toContain("lesson-a/page-03");
  });

  test("creates a structure calibration brief for repeated page-title issues", async () => {
    const root = await fixtureRoot(
      "structure-course",
      qualityReport({
        status: "warning",
        score: 88,
        issues: [
          {
            issueId: "quality.page.repeated-title",
            scope: "page",
            severity: "warning",
            category: "page_structure",
            lessonId: "lesson-a",
            pageId: "page-02",
            reason: "page title repeats a page role",
            requiredFix: "Use learner-facing proposition titles."
          }
        ]
      })
    );

    const result = await new CalibrationService(root).calibrate({ runId: "structure-course" });

    expect(result.status).toBe("revision_required");
    expect(result.calibrationKind).toBe("structure");
    expect(result.codexInstruction).toContain("本轮目标：structure calibration");
  });

  test("stops when maxRounds is reached", async () => {
    const root = await fixtureRoot("stopped-course", qualityReport({ status: "warning", score: 80, issues: [] }));
    const result = await new CalibrationService(root).calibrate({ runId: "stopped-course", maxRounds: 0 });

    expect(result).toMatchObject({
      status: "calibration_stopped",
      runId: "stopped-course",
      stopReason: "maxRounds reached before another calibration round"
    });
  });
});
```

Include local helpers in the test file:

```ts
async function fixtureRoot(runId: string, report: Record<string, unknown>): Promise<string> {
  const root = await mkdir(path.join(os.tmpdir(), `calibration-${runId}-`), { recursive: true });
  const runDir = path.join(root, "runs", runId);
  await mkdir(path.join(runDir, "quality"), { recursive: true });
  await mkdir(path.join(runDir, "preview"), { recursive: true });
  await writeFile(path.join(runDir, "quality", "course-quality-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(runDir, "learning-preview.json"),
    JSON.stringify({
      preview: { localUrl: `http://127.0.0.1:5173/#/preview/${runId}` },
      coursePackPath: "preview/course-pack.json",
      lessonPaths: ["preview/lessons/lesson-a.json"]
    }),
    "utf8"
  );
  return root;
}
```

- [ ] **Step 2: Run service tests and verify RED**

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/calibration-service.test.ts
```

Expected: fails because `calibration-service.ts` does not exist.

- [ ] **Step 3: Implement minimal service**

Create `tools/agent-runtime/learner/calibration-service.ts` exporting `CalibrationService`, `CalibrationInput`, and `CalibrationResult`.

Core behavior:

- validate `runId` with `/^[a-z][a-z0-9-]{0,63}$/`
- read `runs/<runId>/quality/course-quality-report.json`
- read `runs/<runId>/learning-preview.json` when available
- default `maxRounds=3`
- default `minScore=90`
- return `calibration_complete` when score is high enough and no issues
- return `calibration_stopped` when `maxRounds <= 0`
- classify issues as `structure`, `source`, or `learner`
- write `runs/<runId>/quality/calibration/round-001-<kind>.json`
- return `revision_required` with `revisionBriefPath` and `codexInstruction`

- [ ] **Step 4: Export service**

Modify `tools/agent-runtime/index.ts`:

```ts
export { CalibrationService } from "./learner/calibration-service.js";
```

- [ ] **Step 5: Run service tests and verify GREEN**

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/calibration-service.test.ts
```

Expected: pass.

### Task 2: Runtime Tool Wiring

**Files:**
- Modify: `tools/mcp-server/runtime-tools.ts`
- Test: `tools/mcp-server/runtime-tools.test.ts`

- [ ] **Step 1: Add failing runtime tool test**

Add a test that calls:

```ts
await tools.callTool("learning_agent.calibrate_learning_course", {
  runId: "weak-source-course"
});
```

Expected behavior:

- returns `revision_required`
- includes `revisionBriefPath`
- includes `codexInstruction`

- [ ] **Step 2: Run runtime test and verify RED**

Run:

```bash
npm run test:unit -- tools/mcp-server/runtime-tools.test.ts
```

Expected: fails with unsupported tool or missing contract.

- [ ] **Step 3: Wire runtime tool**

Modify `tools/mcp-server/runtime-tools.ts`:

- import `CalibrationService`
- add switch case for `learning_agent.calibrate_learning_course`
- parse `runId`, `maxRounds`, `minScore`, `failOnWarnings`, and `focus`
- add name to `isLearningAgentToolName`

- [ ] **Step 4: Run runtime test and verify GREEN**

Run:

```bash
npm run test:unit -- tools/mcp-server/runtime-tools.test.ts
```

Expected: pass.

### Task 3: MCP Contract

**Files:**
- Modify: `tools/mcp-server/tool-contracts.ts`
- Test: `tools/mcp-server/runtime-tools.test.ts`
- Test: `tools/mcp-server/skill-mcp-contract.test.ts`
- Test: `scripts/codex-mcp-tool-check.ts`
- Test: `scripts/learning-agent-bundle.ts`

- [ ] **Step 1: Add failing contract assertions**

Update tests and bundle checks so expected learner tools include:

```ts
"learning_agent.calibrate_learning_course"
```

- [ ] **Step 2: Run focused contract tests and verify RED**

Run:

```bash
npm run test:unit -- tools/mcp-server/runtime-tools.test.ts tools/mcp-server/skill-mcp-contract.test.ts scripts/learning-agent-bundle.test.ts
```

Expected: fails because tool contract is missing.

- [ ] **Step 3: Add MCP contract**

Modify `tools/mcp-server/tool-contracts.ts`:

- add `"learning_agent.calibrate_learning_course"` to `LearningAgentToolName`
- add learner-facing contract after `publish_learning_course`
- input schema includes `runId`, `maxRounds`, `minScore`, `failOnWarnings`, `focus`

Modify bundle/tool-check lists so Codex install checks see the tool.

- [ ] **Step 4: Run focused contract tests and verify GREEN**

Run:

```bash
npm run test:unit -- tools/mcp-server/runtime-tools.test.ts tools/mcp-server/skill-mcp-contract.test.ts scripts/learning-agent-bundle.test.ts
```

Expected: pass.

### Task 4: Weyl Acceptance Check

**Files:**
- No source edits expected unless tests reveal a contract gap.

- [ ] **Step 1: Run calibration against current Weyl preview**

Run:

```bash
npx tsx -e 'import { LearningAgentRuntimeTools } from "./tools/mcp-server/runtime-tools.ts"; const tools = new LearningAgentRuntimeTools(process.cwd()); console.log(JSON.stringify(await tools.callTool("learning_agent.calibrate_learning_course", { runId: "self-study-weyl-space-time-matter-v1" }), null, 2));'
```

Expected:

- `status=revision_required`
- `calibrationKind=source`
- `codexInstruction` references the current three `source_synthesis_weak` pages
- writes `runs/self-study-weyl-space-time-matter-v1/quality/calibration/round-001-source.json`

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/calibration-service.test.ts tools/mcp-server/runtime-tools.test.ts tools/mcp-server/skill-mcp-contract.test.ts scripts/learning-agent-bundle.test.ts
```

Expected: pass.

### Task 5: Final Review

**Files:**
- Review all changed files with `git diff`.

- [ ] **Step 1: Confirm no unrelated files are staged**

Run:

```bash
git status --short
```

Expected: calibration implementation files changed; existing `src/components/deck/ViewportFit.tsx` may remain as a separate prior fix.

- [ ] **Step 2: Summarize result**

Report:

- implemented tool
- tests run
- Weyl calibration result
- remaining gap: Codex still needs to apply the revision brief and republish for actual content improvement
