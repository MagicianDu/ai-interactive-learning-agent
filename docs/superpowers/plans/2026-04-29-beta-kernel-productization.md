# Beta Kernel Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the project from a developer-oriented runtime MVP to a Beta-grade, Codex/MCP-operated learning-agent product loop.

**Architecture:** Keep the file-backed runtime as the source of truth. Add a product-facing run status layer, improve source-to-unit coverage planning, and expose concise MCP tools so Codex can guide the user through plan, gates, course generation, and promotion without dumping raw artifacts. UI work remains limited to consuming promoted course packs; this plan focuses on the kernel.

**Tech Stack:** TypeScript, Node.js ESM, Vite/React, Vitest, `tools/agent-runtime`, `tools/mcp-server`, JSON artifacts under `runs/<run-id>/`.

---

## Beta Acceptance Boundary

Beta means a real operator can use Codex or another MCP client to run:

```text
用这本书生成一套中文课程：先做总览课，再按核心 topic 拆课。
每个单元 8-12 页，保留来源映射，并在关键节点让我审核。
```

The system must:

- Produce a reviewable natural-language run plan.
- Initialize a source-backed run after approval.
- Extract source anchors with explicit warnings when extraction is limited.
- Generate `source-map`, `concept-map`, `curriculum-plan`, unit child runs, lessons, and critic reports through gates.
- Give Codex a compact `beta_status` view with next actions, current gates, child run state, and artifact pointers.
- Split source anchors across topic units instead of assigning the whole source to every unit.
- Keep full source mapping in artifacts while MCP/CLI outputs stay compact.
- Promote approved child units into a course pack.
- Pass `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build`.

Non-goals for this Beta slice:

- Hosted SaaS accounts, auth, billing, cloud storage, or team sharing.
- A polished run dashboard UI.
- True provider API integration for every model. Codex/manual and mock remain acceptable if the tool loop is product-like and resumable.

## Task 1: Beta Run Status Service

**Files:**
- Create: `tools/agent-runtime/beta/beta-status-service.ts`
- Modify: `tools/agent-runtime/index.ts`
- Modify: `tools/agent-runtime/cli.ts`
- Modify: `tools/mcp-server/tool-contracts.ts`
- Modify: `tools/mcp-server/runtime-tools.ts`
- Test: `tools/agent-runtime/__tests__/beta-status-service.test.ts`
- Test: `tools/mcp-server/runtime-tools.test.ts`

- [x] **Step 1: Write failing tests for run status and next actions**

Create a temp run, seed artifacts/approvals, and assert `BetaStatusService.getStatus(runId)` returns:

```ts
{
  status: "beta_status",
  runId: "agentic-parent",
  parent: {
    currentGate: "curriculum-plan",
    approvedGates: ["source-map", "concept-map"],
    nextActions: [
      expect.stringContaining("Review curriculum-plan")
    ]
  },
  artifacts: expect.arrayContaining([
    expect.objectContaining({ artifactId: "source-map", approved: true }),
    expect.objectContaining({ artifactId: "curriculum-plan", draftVersion: "v1", approved: false })
  ])
}
```

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/beta-status-service.test.ts
```

Expected: fail because the service does not exist.

- [x] **Step 2: Implement `BetaStatusService`**

The service reads `run.config.json`, `runs/<run-id>/artifacts`, `runs/<run-id>/approvals`, and child run configs. It must not execute workflow steps. It returns compact status only:

```ts
type BetaRunStatus = {
  status: "beta_status";
  runId: string;
  topic: string;
  sourceKind?: string;
  outputLanguage: string;
  parent: {
    currentGate?: string;
    approvedGates: string[];
    nextActions: string[];
  };
  artifacts: Array<{
    artifactId: string;
    draftVersion?: string;
    approvedVersion?: string;
    approved: boolean;
  }>;
  childRuns: Array<{
    runId: string;
    unitId?: string;
    title: string;
    currentGate?: string;
    approvedGates: string[];
    nextActions: string[];
  }>;
};
```

- [x] **Step 3: Expose CLI command**

Add:

```bash
npm run agent:beta-status -- --run <run-id>
```

Expected output is the compact `BetaRunStatus` JSON.

- [x] **Step 4: Expose MCP tool**

Add tool:

```text
learning_agent.beta_status
```

Input schema:

```json
{ "runId": "string" }
```

- [x] **Step 5: Verify**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/beta-status-service.test.ts tools/mcp-server/runtime-tools.test.ts
```

Expected: pass.

## Task 2: Source-Aware Curriculum Unit Coverage

**Files:**
- Modify: `tools/agent-runtime/adapters/mock-adapter.ts`
- Test: `tools/agent-runtime/__tests__/agent-workflow.test.ts`

- [x] **Step 1: Write failing curriculum coverage test**

Use a source-backed run with at least 12 anchors. Advance to `curriculum-plan`, read the draft, and assert:

```ts
const units = plan.units;
expect(units.find((unit) => unit.id === "unit-overview").sourceAnchorIds).toHaveLength(12);
expect(units.find((unit) => unit.id === "unit-topic-01").sourceAnchorIds.length).toBeGreaterThan(0);
expect(units.find((unit) => unit.id === "unit-topic-01").sourceAnchorIds.length).toBeLessThan(12);
expect(units.find((unit) => unit.id === "unit-topic-01").sourceAnchorIds).not.toEqual(
  units.find((unit) => unit.id === "unit-topic-02").sourceAnchorIds
);
```

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/agent-workflow.test.ts
```

Expected: fail because every unit currently receives all anchors.

- [x] **Step 2: Implement anchor slicing**

Keep `unit-overview` mapped to all anchors. For topic units, split anchors into contiguous chunks. Preserve at least one anchor per topic unit:

```ts
function sourceAnchorSliceForTopic(sourceAnchorIds: string[], topicIndex: number, topicCount: number): string[] {
  if (sourceAnchorIds.length <= topicCount) return sourceAnchorIds.slice(topicIndex, topicIndex + 1);
  const chunkSize = Math.ceil(sourceAnchorIds.length / topicCount);
  const start = topicIndex * chunkSize;
  return sourceAnchorIds.slice(start, Math.min(sourceAnchorIds.length, start + chunkSize));
}
```

- [x] **Step 3: Improve coverage metadata**

Set `sourceCoverage` and `chapterMapping` using actual unit anchor slices. `sourceCoverage.unitIds` should include units that cover that source, and `chapterMapping.anchorIds` should remain bounded to sample or source-level mapping when needed.

- [x] **Step 4: Verify**

Run:

```bash
npm run test -- tools/agent-runtime/__tests__/agent-workflow.test.ts tools/agent-runtime/__tests__/course-pack-service.test.ts
```

Expected: pass.

## Task 3: Codex/MCP Operator Loop Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/runtime/mcp-client-setup.md`
- Modify: `docs/runtime/runtime-adapters.md`

- [x] **Step 1: Document the Beta operator loop**

Add the exact sequence:

```text
plan_run -> init_from_plan -> beta_status -> run_until_gate -> read_artifact -> approve_gate/revise_gate -> run_course -> beta_status -> promote_units
```

- [x] **Step 2: Document full artifact audit path**

State that compact tools return summaries and full source mapping is available through:

```text
learning_agent.read_artifact({ artifactId: "curriculum-plan", version: "approved" })
```

- [x] **Step 3: Verify docs references**

Run:

```bash
rg "beta_status|operator loop|learning_agent.beta_status" README.md docs/runtime
```

Expected: all terms appear.

## Task 4: Beta Smoke Test

**Files:**
- Modify: `tools/mcp-server/json-rpc-server.test.ts`
- Optional docs: `docs/runtime/mcp-client-setup.md`

- [x] **Step 1: Extend JSON-RPC smoke**

Add `learning_agent.beta_status` calls after `init_from_plan`, after parent gates, and after `run_course`. Assert:

```ts
expect(status.status).toBe("beta_status");
expect(status.parent.nextActions.length).toBeGreaterThan(0);
expect(JSON.stringify(status).length).toBeLessThan(15000);
```

- [x] **Step 2: Verify**

Run:

```bash
npm run test -- tools/mcp-server/json-rpc-server.test.ts
```

Expected: pass.

## Task 5: Final Verification And Commit

**Files:**
- All files touched above.

- [x] **Step 1: Run full verification**

```bash
npm run lint
npm run test
npm run typecheck
npm run build
git diff --check
```

- [x] **Step 2: Run real-source status smoke**

Against the existing local real PDF smoke if present:

```bash
npm run agent:beta-status -- --run kernel-real-pdf-smoke-5
npm run agent:units -- --run kernel-real-pdf-smoke-5
```

Expected: compact output with count/sample source mapping.

- [x] **Step 3: Commit**

```bash
git add README.md docs/runtime tools/agent-runtime tools/mcp-server
git commit -m "Add beta operator status loop"
```

## Self-Review

- Spec coverage: Tasks 1 and 4 cover the product-like Codex/MCP loop; Task 2 improves source-to-unit grounding; Task 3 documents the operator path; Task 5 verifies Beta readiness.
- Placeholder scan: no TBD/TODO placeholders are used as implementation instructions.
- Type consistency: the new tool name is consistently `learning_agent.beta_status`; the CLI command is consistently `agent:beta-status`; the returned object is consistently `BetaRunStatus`.
