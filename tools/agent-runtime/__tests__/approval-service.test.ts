import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { ApprovalService } from "../approval-service.js";
import { ArtifactStore } from "../artifact-store.js";

const tempRoots: string[] = [];

async function createRunPath(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "agent-runtime-approval-"));
  tempRoots.push(root);
  return path.join(root, "runs", "database-index-001");
}

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ApprovalService", () => {
  test("approves exact artifact version and writes approved alias for learning-architecture v1", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);
    const firstPayload = { pageSequence: ["problem", "visual"], version: 1 };
    const secondPayload = { pageSequence: ["changed draft"], version: 2 };

    await artifactStore.writeDraft("learning-architecture", firstPayload);
    await artifactStore.writeDraft("learning-architecture", secondPayload);

    await service.approve({
      gate: "learning-architecture",
      runId: "database-index-001",
      artifactId: "learning-architecture",
      version: "v1",
      decision: "approved"
    });

    const approvalRecord = JSON.parse(
      await readFile(path.join(runPath, "approvals", "learning-architecture.approved.json"), "utf8")
    ) as Record<string, unknown>;
    expect(approvalRecord).toMatchObject({
      gate: "learning-architecture",
      runId: "database-index-001",
      approvedArtifact: "artifacts/learning-architecture.v1.json",
      decision: "approved",
      operatorNotes: ""
    });
    expect(new Date(approvalRecord.decidedAt as string).toISOString()).toBe(approvalRecord.decidedAt);

    await expect(readFile(path.join(runPath, "artifacts", "learning-architecture.approved.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(firstPayload, null, 2)}\n`
    );
  });

  test("revision_requested writes decision record and does not overwrite prior approved record or alias", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);
    const approvedPayload = { lesson: "approved" };
    const revisionPayload = { lesson: "needs revision" };

    await artifactStore.writeDraft("lesson", approvedPayload);
    await service.approve({
      gate: "lesson",
      runId: "database-index-001",
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });
    await artifactStore.writeDraft("lesson", revisionPayload);

    await service.approve({
      gate: "lesson",
      runId: "database-index-001",
      artifactId: "lesson",
      version: "v2",
      decision: "revision_requested",
      operatorNotes: "Tighten the transfer task."
    });

    const approvedRecord = JSON.parse(await readFile(path.join(runPath, "approvals", "lesson.approved.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(approvedRecord).toMatchObject({
      gate: "lesson",
      runId: "database-index-001",
      approvedArtifact: "artifacts/lesson.v1.json",
      decision: "approved",
      operatorNotes: ""
    });

    const decisionRecord = JSON.parse(await readFile(path.join(runPath, "approvals", "lesson.decision.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(decisionRecord).toMatchObject({
      gate: "lesson",
      runId: "database-index-001",
      approvedArtifact: "artifacts/lesson.v2.json",
      decision: "revision_requested",
      operatorNotes: "Tighten the transfer task."
    });
    await expect(readFile(path.join(runPath, "artifacts", "lesson.approved.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(approvedPayload, null, 2)}\n`
    );
  });

  test("rejected writes decision record without creating approved record or alias", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("publish-package", { package: "not ready" });

    await service.approve({
      gate: "publish-package",
      runId: "database-index-001",
      artifactId: "publish-package",
      version: "v1",
      decision: "rejected",
      operatorNotes: "Export is missing run instructions."
    });

    const decisionRecord = JSON.parse(
      await readFile(path.join(runPath, "approvals", "publish-package.decision.json"), "utf8")
    ) as Record<string, unknown>;
    expect(decisionRecord).toMatchObject({
      gate: "publish-package",
      runId: "database-index-001",
      approvedArtifact: "artifacts/publish-package.v1.json",
      decision: "rejected",
      operatorNotes: "Export is missing run instructions."
    });
    await expect(stat(path.join(runPath, "approvals", "publish-package.approved.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(stat(path.join(runPath, "artifacts", "publish-package.approved.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("approving with unsafe artifactId or invalid version rejects through ArtifactStore validation", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await expect(
      service.approve({
        gate: "lesson",
        runId: "database-index-001",
        artifactId: "../lesson",
        version: "v1",
        decision: "approved"
      })
    ).rejects.toThrow(/artifactId must match/);
    await expect(stat(path.join(runPath, "approvals", "lesson.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });

    await expect(
      service.approve({
        gate: "lesson",
        runId: "database-index-001",
        artifactId: "lesson",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        version: "../v1" as any,
        decision: "approved"
      })
    ).rejects.toThrow(/version must match/);
    await expect(stat(path.join(runPath, "approvals", "lesson.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("approved_with_notes copies alias and preserves operatorNotes", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);
    const payload = { report: "ready with minor caveat" };

    await artifactStore.writeDraft("critic-report", payload);

    await service.approve({
      gate: "critic-report",
      runId: "database-index-001",
      artifactId: "critic-report",
      version: "v1",
      decision: "approved_with_notes",
      operatorNotes: "Accept, but revisit rubric wording."
    });

    const approvalRecord = JSON.parse(
      await readFile(path.join(runPath, "approvals", "critic-report.approved.json"), "utf8")
    ) as Record<string, unknown>;
    expect(approvalRecord).toMatchObject({
      gate: "critic-report",
      runId: "database-index-001",
      approvedArtifact: "artifacts/critic-report.v1.json",
      decision: "approved_with_notes",
      operatorNotes: "Accept, but revisit rubric wording."
    });
    await expect(readFile(path.join(runPath, "artifacts", "critic-report.approved.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(payload, null, 2)}\n`
    );
  });

  test("reports gate unapproved when the approval record targets an older artifact version", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("learning-architecture", { version: 1 });
    await service.approve({
      gate: "learning-architecture",
      runId: "database-index-001",
      artifactId: "learning-architecture",
      version: "v1",
      decision: "approved"
    });
    await artifactStore.writeDraft("learning-architecture", { version: 2 });

    await expect(service.isGateApprovedForCurrentArtifact("learning-architecture", "learning-architecture")).resolves.toBe(
      false
    );
  });

  test("reports gate unapproved when a negative decision is not older than the approval record", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("lesson", { lesson: "approved" });
    await service.approve({
      gate: "lesson",
      runId: "database-index-001",
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });
    await service.approve({
      gate: "lesson",
      runId: "database-index-001",
      artifactId: "lesson",
      version: "v1",
      decision: "revision_requested",
      operatorNotes: "Needs another pass."
    });

    await expect(service.isGateApprovedForCurrentArtifact("lesson", "lesson")).resolves.toBe(false);
  });

  test("reports current artifact decision only when the decision targets the current version", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("learning-architecture", { version: 1 });
    await service.approve({
      gate: "learning-architecture",
      runId: "database-index-001",
      artifactId: "learning-architecture",
      version: "v1",
      decision: "revision_requested",
      operatorNotes: "Regenerate this architecture."
    });

    await expect(
      service.getGateDecisionForCurrentArtifact("learning-architecture", "learning-architecture")
    ).resolves.toMatchObject({
      decision: "revision_requested",
      approvedArtifact: "artifacts/learning-architecture.v1.json"
    });

    await artifactStore.writeDraft("learning-architecture", { version: 2 });

    await expect(
      service.getGateDecisionForCurrentArtifact("learning-architecture", "learning-architecture")
    ).resolves.toBeUndefined();
  });

  test("reports gate approved only for the current artifact version without a later negative decision", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("publish-package", { package: "ready" });
    await service.approve({
      gate: "publish-package",
      runId: "database-index-001",
      artifactId: "publish-package",
      version: "v1",
      decision: "approved_with_notes",
      operatorNotes: "Ready for smoke testing."
    });

    await expect(service.isGateApprovedForCurrentArtifact("publish-package", "publish-package")).resolves.toBe(true);
  });

  test("approval after negative decision in same millisecond clears stale decision record", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T10:00:00.000Z"));

    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("lesson", { lesson: "same millisecond decision order" });
    await service.approve({
      gate: "lesson",
      runId: "database-index-001",
      artifactId: "lesson",
      version: "v1",
      decision: "revision_requested",
      operatorNotes: "Needs another pass."
    });
    await service.approve({
      gate: "lesson",
      runId: "database-index-001",
      artifactId: "lesson",
      version: "v1",
      decision: "approved"
    });

    await expect(service.isGateApprovedForCurrentArtifact("lesson", "lesson")).resolves.toBe(true);
    await expect(stat(path.join(runPath, "approvals", "lesson.decision.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("rejects mismatched artifactId for gate before writing approval records", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("lesson", { lesson: "wrong gate" });

    await expect(
      service.approve({
        gate: "learning-architecture",
        runId: "database-index-001",
        artifactId: "lesson",
        version: "v1",
        decision: "approved"
      })
    ).rejects.toThrow(/artifactId must match gate/);
    await expect(stat(path.join(runPath, "approvals", "learning-architecture.approved.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(stat(path.join(runPath, "artifacts", "lesson.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects invalid runtime gate before constructing an approval record path", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("lesson", { lesson: "safe artifact" });

    await expect(
      service.approve({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gate: "../outside" as any,
        runId: "database-index-001",
        artifactId: "lesson",
        version: "v1",
        decision: "approved"
      })
    ).rejects.toThrow(/gate must be one of/);
    await expect(stat(path.join(runPath, "outside.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(runPath, "approvals", "outside.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(runPath, "artifacts", "lesson.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects unsafe runtime runId before writing approval records", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("lesson", { lesson: "safe artifact" });

    await expect(
      service.approve({
        gate: "lesson",
        runId: "../bad",
        artifactId: "lesson",
        version: "v1",
        decision: "approved"
      })
    ).rejects.toThrow(/runId must match/);
    await expect(stat(path.join(runPath, "approvals", "lesson.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(runPath, "artifacts", "lesson.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects unsupported runtime decision before writing approval records", async () => {
    const runPath = await createRunPath();
    const artifactStore = new ArtifactStore(runPath);
    const service = new ApprovalService(runPath, artifactStore);

    await artifactStore.writeDraft("lesson", { lesson: "safe artifact" });

    await expect(
      service.approve({
        gate: "lesson",
        runId: "database-index-001",
        artifactId: "lesson",
        version: "v1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decision: "waived" as any
      })
    ).rejects.toThrow(/decision must be one of/);
    await expect(stat(path.join(runPath, "approvals", "lesson.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(runPath, "artifacts", "lesson.approved.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
