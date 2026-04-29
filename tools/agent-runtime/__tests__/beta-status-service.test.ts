import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { ApprovalService } from "../approval-service.js";
import { ArtifactStore } from "../artifact-store.js";
import { BetaStatusService } from "../beta/beta-status-service.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("BetaStatusService", () => {
  test("summarizes parent gates, artifacts, next actions, and child run gates", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-beta-status-"));
    tempRoots.push(root);
    const runStore = new RunStore(root);
    const parentConfig = createRunConfigFromArgs({
      sourceText: "# 第一章\n智能体系统需要可审查产物。",
      sourceKind: "book",
      sourceTitle: "Agentic Notes",
      unitPages: "8",
      run: "agentic-parent",
      adapter: "mock"
    });
    const parentRunPath = await runStore.createRun(parentConfig);
    const parentArtifacts = new ArtifactStore(parentRunPath);
    const parentApprovals = new ApprovalService(parentRunPath, parentArtifacts);

    await writeAndApprove(parentArtifacts, parentApprovals, "agentic-parent", "source-map", { artifactId: "source-map" });
    await writeAndApprove(parentArtifacts, parentApprovals, "agentic-parent", "concept-map", { artifactId: "concept-map" });
    await parentArtifacts.writeDraft("curriculum-plan", { artifactId: "curriculum-plan" });

    const childConfig = {
      ...parentConfig,
      runId: "agentic-parent-unit-overview",
      topic: "Agentic Notes：总览课",
      selectedUnit: {
        id: "unit-overview",
        title: "Agentic Notes：总览课",
        kind: "overview" as const,
        purpose: "建立全局地图",
        targetPageCount: 8,
        sourceAnchorIds: ["source-001:page-1"],
        sourceNodeIds: ["source-001:root"],
        chapterRefs: [],
        conceptIds: ["agent-loop"],
        outputProducts: ["web_lesson" as const],
        parentRunId: "agentic-parent",
        parentCoursePackId: "agentic-parent-course-pack"
      }
    };
    const childRunPath = await runStore.createRun(childConfig);
    const childArtifacts = new ArtifactStore(childRunPath);
    await childArtifacts.writeDraft("learning-architecture", { artifactId: "learning-architecture" });

    const status = await new BetaStatusService(root).getStatus("agentic-parent");

    expect(status).toMatchObject({
      status: "beta_status",
      runId: "agentic-parent",
      topic: "Agentic Notes",
      parent: {
        currentGate: "curriculum-plan",
        approvedGates: ["source-map", "concept-map"],
        nextActions: [expect.stringContaining("Review curriculum-plan")]
      },
      artifacts: expect.arrayContaining([
        expect.objectContaining({ artifactId: "source-map", draftVersion: "v1", approvedVersion: "v1", approved: true }),
        expect.objectContaining({ artifactId: "curriculum-plan", draftVersion: "v1", approved: false })
      ]),
      childRuns: [
        expect.objectContaining({
          runId: "agentic-parent-unit-overview",
          unitId: "unit-overview",
          title: "Agentic Notes：总览课",
          currentGate: "learning-architecture",
          approvedGates: [],
          nextActions: [expect.stringContaining("Review learning-architecture")]
        })
      ]
    });
    expect(JSON.stringify(status).length).toBeLessThan(15000);
  });
});

async function writeAndApprove(
  artifacts: ArtifactStore,
  approvals: ApprovalService,
  runId: string,
  gate: "source-map" | "concept-map",
  payload: Record<string, unknown>
): Promise<void> {
  const result = await artifacts.writeDraft(gate, payload);
  await approvals.approve({ gate, runId, artifactId: gate, version: result.version, decision: "approved" });
}
