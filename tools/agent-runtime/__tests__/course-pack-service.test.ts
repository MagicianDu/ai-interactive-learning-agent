import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { MockRuntimeAdapter } from "../adapters/mock-adapter.js";
import { ApprovalService } from "../approval-service.js";
import { ArtifactStore } from "../artifact-store.js";
import { CoursePackService } from "../course-pack-service.js";
import { createRunConfigFromArgs } from "../run-config.js";
import { RunStore } from "../run-store.js";
import { AgentWorkflow } from "../workflow/agent-workflow.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CoursePackService", () => {
  test("lists and selects a unit from the approved curriculum plan", async () => {
    const { root, runPath, artifacts, approvals } = await createParentRun();
    await seedApprovedCorpusPlan(artifacts, approvals, "agentic-parent");
    await artifacts.writeDraft("source-ingest", { stale: true });

    const service = new CoursePackService(root);
    await expect(service.listUnits("agentic-parent")).resolves.toMatchObject([
      { id: "unit-overview", kind: "overview", targetPageCount: 12 },
      { id: "unit-topic-01", kind: "topic", targetPageCount: 10 }
    ]);

    await expect(service.selectUnit("agentic-parent", "unit-topic-01")).resolves.toEqual({
      status: "unit_selected",
      runId: "agentic-parent",
      unitId: "unit-topic-01",
      targetPageCount: 10,
      invalidatedAfter: "curriculum-plan"
    });

    const updatedConfig = JSON.parse(await readFile(path.join(runPath, "run.config.json"), "utf8")) as {
      selectedUnit?: { id?: string };
      pageCount?: { target?: number };
    };
    expect(updatedConfig.selectedUnit?.id).toBe("unit-topic-01");
    expect(updatedConfig.pageCount?.target).toBe(10);
    await expect(stat(path.join(runPath, "artifacts", "source-ingest.draft.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  test("summarizes unit source anchors instead of returning full anchor lists", async () => {
    const { root, artifacts, approvals } = await createParentRun();
    await seedApprovedCorpusPlan(artifacts, approvals, "agentic-parent", {
      overviewAnchorIds: Array.from({ length: 80 }, (_, index) => `source-001:paragraph-${index + 1}`)
    });

    const service = new CoursePackService(root);
    const units = await service.listUnits("agentic-parent");

    expect(units[0]).toMatchObject({
      id: "unit-overview",
      sourceAnchorCount: 80,
      sourceAnchorSample: ["source-001:paragraph-1", "source-001:paragraph-2", "source-001:paragraph-3"]
    });
    expect(units[0]).not.toHaveProperty("sourceAnchorIds");
  });

  test("spawns child runs for all units and seeds approved corpus artifacts", async () => {
    const { root, artifacts, approvals } = await createParentRun();
    await seedApprovedCorpusPlan(artifacts, approvals, "agentic-parent");

    const service = new CoursePackService(root);
    const result = await service.spawnUnitRuns("agentic-parent", "all");

    expect(result.childRuns.map((run) => run.unitId)).toEqual(["unit-overview", "unit-topic-01"]);

    const childRunId = result.childRuns[0]?.runId;
    if (!childRunId) {
      throw new Error("expected a child run");
    }
    const runStore = new RunStore(root);
    const childRunPath = runStore.getRunPath(childRunId);
    await expect(readFile(path.join(childRunPath, "artifacts", "source-map.approved.json"), "utf8")).resolves.toContain(
      "source-map"
    );

    const childArtifacts = new ArtifactStore(childRunPath);
    const childApprovals = new ApprovalService(childRunPath, childArtifacts);
    const workflow = new AgentWorkflow(runStore, childArtifacts, childApprovals, new MockRuntimeAdapter());
    await expect(workflow.runNext(childRunId)).resolves.toMatchObject({
      status: "artifact_written",
      artifactId: "source-ingest"
    });
  });

  test("advances spawned child runs until they need approval or manual action", async () => {
    const { root, artifacts, approvals } = await createParentRun();
    await seedApprovedCorpusPlan(artifacts, approvals, "agentic-parent");
    const service = new CoursePackService(root);
    await service.spawnUnitRuns("agentic-parent", "all");

    const result = await service.runUnitRuns("agentic-parent", "all", 10);

    expect(result.status).toBe("unit_runs_advanced");
    expect(result.childRuns).toHaveLength(2);
    expect(result.childRuns.map((run) => run.finalStatus)).toEqual(["approval_required", "approval_required"]);
    expect(result.childRuns[0]?.steps.map((step) => step.status)).toEqual([
      "artifact_written",
      "artifact_written",
      "approval_required"
    ]);
  });

  test("orchestrates course units without respawning existing child runs", async () => {
    const { root, artifacts, approvals } = await createParentRun();
    await seedApprovedCorpusPlan(artifacts, approvals, "agentic-parent");
    const service = new CoursePackService(root);

    const first = await service.orchestrateCourse({ runId: "agentic-parent", unitSelector: "all", maxSteps: 10 });
    expect(first.status).toBe("course_orchestrated");
    expect(first.spawned.map((run) => run.unitId)).toEqual(["unit-overview", "unit-topic-01"]);
    expect(first.units[0]).not.toHaveProperty("sourceAnchorIds");
    expect(first.units[0]).toMatchObject({ sourceAnchorCount: 1, sourceAnchorSample: ["source-001:chapter-01"] });
    expect(first.childRuns.map((run) => run.finalStatus)).toEqual(["approval_required", "approval_required"]);
    expect(first.nextActions).toEqual(
      expect.arrayContaining(["Review and approve/revise learning-architecture for child runs that reached an approval gate."])
    );

    const second = await service.orchestrateCourse({ runId: "agentic-parent", unitSelector: "all", maxSteps: 10 });
    expect(second.spawned).toHaveLength(0);
    expect(second.childRuns).toHaveLength(2);
  });

  test("ignores unrelated legacy runs with stale config schema while finding child runs", async () => {
    const { root, artifacts, approvals } = await createParentRun();
    await seedApprovedCorpusPlan(artifacts, approvals, "agentic-parent");
    await mkdir(path.join(root, "runs", "legacy-run"), { recursive: true });
    await writeFile(
      path.join(root, "runs", "legacy-run", "run.config.json"),
      JSON.stringify({ runId: "legacy-run", topic: "旧运行", sources: [] }),
      "utf8"
    );

    const service = new CoursePackService(root);
    const result = await service.orchestrateCourse({ runId: "agentic-parent", unitSelector: "all", maxSteps: 10 });

    expect(result.status).toBe("course_orchestrated");
    expect(result.childRuns.map((run) => run.unitId)).toEqual(["unit-overview", "unit-topic-01"]);
  });

  test("orchestrates one selected unit", async () => {
    const { root, artifacts, approvals } = await createParentRun();
    await seedApprovedCorpusPlan(artifacts, approvals, "agentic-parent");
    const service = new CoursePackService(root);

    const result = await service.orchestrateCourse({ runId: "agentic-parent", unitSelector: "unit-topic-01", maxSteps: 10 });

    expect(result.spawned.map((run) => run.unitId)).toEqual(["unit-topic-01"]);
    expect(result.childRuns.map((run) => run.unitId)).toEqual(["unit-topic-01"]);
  });

  test("promotes approved child unit lessons and writes a course-pack manifest", async () => {
    const { root, artifacts, approvals } = await createParentRun();
    await seedApprovedCorpusPlan(artifacts, approvals, "agentic-parent");
    const service = new CoursePackService(root);
    const spawned = await service.spawnUnitRuns("agentic-parent", "all");
    const runStore = new RunStore(root);

    for (const child of spawned.childRuns) {
      const childRunPath = runStore.getRunPath(child.runId);
      const childArtifacts = new ArtifactStore(childRunPath);
      const childApprovals = new ApprovalService(childRunPath, childArtifacts);
      await childArtifacts.writeDraft("lesson", buildLesson({ id: child.runId, targetPageCount: 10, title: child.title }));
      await childApprovals.approve({
        gate: "lesson",
        runId: child.runId,
        artifactId: "lesson",
        version: "v1",
        decision: "approved"
      });
    }

    const result = await service.promoteUnitRuns("agentic-parent", "all");

    expect(result.status).toBe("unit_runs_promoted");
    expect(result.childRuns.map((run) => run.unitId)).toEqual(["unit-overview", "unit-topic-01"]);
    await expect(readFile(result.coursePackPath, "utf8")).resolves.toContain("generatedCoursePack");
    await expect(readFile(result.coursePackPath, "utf8")).resolves.toContain("unit-overview");
    await expect(readFile(path.join(root, "src", "lessons", result.childRuns[0]?.lessonId ?? "", "lesson.ts"), "utf8")).resolves.toContain(
      "generatedLesson"
    );
  });
});

async function createParentRun(): Promise<{
  root: string;
  runPath: string;
  artifacts: ArtifactStore;
  approvals: ApprovalService;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "agent-runtime-course-pack-"));
  tempRoots.push(root);
  const runStore = new RunStore(root);
  const config = createRunConfigFromArgs({
    sourceFile: "/tmp/agent-workflow-notes.pdf",
    sourceKind: "book",
    sourceTitle: "Agent Workflow Notes",
    unitPages: "12",
    run: "agentic-parent"
  });
  const runPath = await runStore.createRun(config);
  const artifacts = new ArtifactStore(runPath);
  const approvals = new ApprovalService(runPath, artifacts);
  return { root, runPath, artifacts, approvals };
}

function buildLesson({
  id,
  title,
  targetPageCount
}: {
  id: string;
  title: string;
  targetPageCount: number;
}): Record<string, unknown> {
  return {
    id,
    title,
    audience: "中文学习者",
    config: {
      targetPageCount,
      minPageCount: Math.max(1, targetPageCount - 2),
      maxPageCount: targetPageCount + 2
    },
    sourceContext: {
      parentRunId: "agentic-parent",
      sourceAnchorIds: ["source-001:chapter-01"],
      conceptIds: ["routing"]
    },
    prerequisites: [],
    learningObjectives: ["建立该单元的核心心智模型"],
    pages: Array.from({ length: targetPageCount }, (_, index) =>
      buildQualityPage(`p${index + 1}`, qualityPageTypes[index % qualityPageTypes.length] ?? "problem_scene")
    ),
    misconceptions: [{ id: "m1", statement: "学习单元只有定义即可", correction: "需要通过行动、反馈和迁移建立心智模型。" }],
    transferTasks: [{ id: "t1", prompt: "迁移到新的技术场景", targetMentalModel: "用同一机制解释新问题。" }],
    summary: ["单元总结"]
  };
}

const qualityPageTypes = [
  "problem_scene",
  "intuition_visual",
  "structure_diagram",
  "interactive_model",
  "interactive_model",
  "quiz",
  "misconception_check",
  "summary_card"
];

function buildQualityPage(id: string, type: string): Record<string, unknown> {
  const base = {
    id,
    type,
    title: `第 ${id.slice(1)} 页`,
    learningGoal: "建立中文心智模型",
    narrative: "中文内容"
  };
  if (["problem_scene", "intuition_visual", "structure_diagram", "summary_card"].includes(type)) {
    return {
      ...base,
      visualSpec: {
        kind: "diagram",
        description: "中文图示",
        keyElements: ["元素一", "元素二"]
      }
    };
  }
  if (type === "interactive_model") {
    return {
      ...base,
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择一个路径",
        expectedObservation: "看到结构变化",
        cognitivePurpose: "理解因果关系",
        options: [
          {
            id: "a",
            label: "选择 A",
            resultTitle: "路径变化",
            outcomeId: "path-a",
            resultTone: "success",
            explanation: "因为这个选择改变了候选范围。"
          }
        ]
      }
    };
  }
  return {
    ...base,
    assessmentSpec: {
      kind: "multiple_choice",
      prompt: "哪种判断更符合心智模型？",
      options: ["关注因果机制", "只背定义"],
      correctAnswer: "关注因果机制"
    },
    feedbackSpec: {
      correctFeedback: "正确，学习目标是形成可迁移的机制理解。",
      incorrectFeedback: "不对，只背定义无法支持迁移。"
    }
  };
}

async function seedApprovedCorpusPlan(
  artifacts: ArtifactStore,
  approvals: ApprovalService,
  runId: string,
  options: { overviewAnchorIds?: string[] } = {}
): Promise<void> {
  await artifacts.writeDraft("source-map", { artifactId: "source-map", anchors: [] });
  await approvals.approve({ gate: "source-map", runId, artifactId: "source-map", version: "v1", decision: "approved" });

  await artifacts.writeDraft("concept-map", { artifactId: "concept-map", concepts: [] });
  await approvals.approve({ gate: "concept-map", runId, artifactId: "concept-map", version: "v1", decision: "approved" });

  await artifacts.writeDraft("curriculum-plan", {
    artifactId: "curriculum-plan",
    coursePack: {
      id: "agentic-parent-course-pack",
      units: [
        {
          id: "unit-overview",
          title: "总览课",
          kind: "overview",
          purpose: "建立全局地图",
          targetPageCount: 12,
          sourceAnchorIds: options.overviewAnchorIds ?? ["source-001:chapter-01"],
          sourceNodeIds: ["source-001:root"],
          chapterRefs: ["chapter 1"],
          conceptIds: ["routing"],
          outputProducts: ["web_lesson", "assessment"]
        },
        {
          id: "unit-topic-01",
          title: "路由与任务分派",
          purpose: "围绕核心 topic 拆课",
          targetPageCount: 10,
          sourceAnchorIds: ["source-001:chapter-02"],
          sourceNodeIds: ["source-001:root"],
          chapterRefs: ["chapter 2"],
          conceptIds: ["routing"],
          outputProducts: ["web_deck", "assessment"]
        }
      ]
    }
  });
  await approvals.approve({
    gate: "curriculum-plan",
    runId,
    artifactId: "curriculum-plan",
    version: "v1",
    decision: "approved"
  });
}
