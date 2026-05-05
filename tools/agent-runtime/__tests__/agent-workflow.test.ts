import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { MockRuntimeAdapter } from "../adapters/mock-adapter.js";
import { ApprovalService } from "../approval-service.js";
import { ArtifactStore, type ArtifactVersion } from "../artifact-store.js";
import { RunStore } from "../run-store.js";
import type { ApprovalGateId, RunConfig } from "../types.js";
import { AgentWorkflow } from "../workflow/agent-workflow.js";

const tempRoots: string[] = [];

function baseConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    runId: "database-index-001",
    topic: "为什么数据库索引能让查询更快",
    source: { type: "topic", value: "为什么数据库索引能让查询更快" },
    sources: [
      {
        id: "source-001",
        type: "topic",
        title: "为什么数据库索引能让查询更快",
        value: "为什么数据库索引能让查询更快",
        language: "zh-CN"
      }
    ],
    audience: "具备基础 SQL 经验的学习者",
    userLearningProfile: {
      level: "basic",
      readingHabit: "visual_first",
      goal: "understand",
      preferredPageCountPerUnit: 10
    },
    curriculumPlanningMode: "hybrid",
    coveragePolicy: {
      requiredCoverage: "core_concepts",
      allowOmission: true,
      omissionRules: ["topic-only runs may omit source coverage beyond generated concept anchors"]
    },
    outputLanguage: "zh-CN",
    targetOutput: "web_deck",
    pageCount: { target: 10, min: 8, max: 12 },
    runtime: { adapter: "mock", mode: "interactive" },
    models: { defaultModel: { provider: "mock", model: "mock-learning-agent", temperature: 0.2 } },
    modelFallbackPolicy: "require_approval",
    approvalGates: ["source-map", "concept-map", "curriculum-plan", "learning-architecture", "lesson", "critic-report", "publish-package"],
    ...overrides
  };
}

async function createHarness(config: RunConfig = baseConfig()) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "agent-runtime-workflow-"));
  tempRoots.push(workspaceRoot);
  const runStore = new RunStore(workspaceRoot);
  const runPath = await runStore.createRun(config);
  const artifactStore = new ArtifactStore(runPath);
  const approvalService = new ApprovalService(runPath, artifactStore);
  const workflow = new AgentWorkflow(runStore, artifactStore, approvalService, new MockRuntimeAdapter());

  return { workspaceRoot, runPath, runStore, artifactStore, approvalService, workflow };
}

async function approveCorpusGates(
  workflow: AgentWorkflow,
  approvalService: ApprovalService,
  runId: string,
  gates: ApprovalGateId[] = ["source-map", "concept-map", "curriculum-plan"]
): Promise<void> {
  for (const gate of gates) {
    await expect(workflow.runNext(runId)).resolves.toMatchObject({
      status: "artifact_written",
      artifactId: gate
    });
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "approval_required",
      requiredGate: gate
    });
    await approveGate(approvalService, runId, gate);
  }
}

async function advanceToLearningArchitecture(
  workflow: AgentWorkflow,
  approvalService: ApprovalService,
  runId: string
): Promise<void> {
  await approveCorpusGates(workflow, approvalService, runId);
  await expect(workflow.runNext(runId)).resolves.toMatchObject({
    status: "artifact_written",
    artifactId: "source-ingest",
    version: "v1"
  });
  await expect(workflow.runNext(runId)).resolves.toEqual({
    status: "artifact_written",
    artifactId: "learning-architecture",
    version: "v1",
    createsGate: "learning-architecture"
  });
}

async function approveGate(
  approvalService: ApprovalService,
  runId: string,
  gate: ApprovalGateId,
  version: ArtifactVersion = "v1"
): Promise<void> {
  await approvalService.approve({
    gate,
    runId,
    artifactId: gate,
    version,
    decision: "approved"
  });
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("AgentWorkflow", () => {
  test("runs corpus planning gates, writes source-ingest and learning-architecture", async () => {
    const { approvalService, artifactStore, workflow } = await createHarness();
    const runId = "database-index-001";

    await expect(workflow.runNext(runId)).resolves.toMatchObject({
      status: "artifact_written",
      artifactId: "source-map",
      version: "v1",
      createsGate: "source-map"
    });
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "approval_required",
      requiredGate: "source-map"
    });
    await approveGate(approvalService, runId, "source-map");

    await expect(workflow.runNext(runId)).resolves.toMatchObject({
      status: "artifact_written",
      artifactId: "concept-map",
      version: "v1",
      createsGate: "concept-map"
    });
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "approval_required",
      requiredGate: "concept-map"
    });
    await approveGate(approvalService, runId, "concept-map");

    await expect(workflow.runNext(runId)).resolves.toMatchObject({
      status: "artifact_written",
      artifactId: "curriculum-plan",
      version: "v1",
      createsGate: "curriculum-plan"
    });
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "approval_required",
      requiredGate: "curriculum-plan"
    });
    await approveGate(approvalService, runId, "curriculum-plan");

    const sourceIngest = await workflow.runNext(runId);
    expect(sourceIngest).toMatchObject({
      status: "artifact_written",
      artifactId: "source-ingest",
      version: "v1"
    });
    await expect(artifactStore.readDraft("source-ingest")).resolves.toMatchObject({
      language: "zh-CN",
      concepts: expect.arrayContaining(["全表扫描", "索引查找", "选择性"])
    });

    const learningArchitecture = await workflow.runNext(runId);
    expect(learningArchitecture).toMatchObject({
      status: "artifact_written",
      artifactId: "learning-architecture",
      version: "v1",
      createsGate: "learning-architecture"
    });
    await expect(artifactStore.readDraft("learning-architecture")).resolves.toMatchObject({
      pageCount: { planned: 10, target: 10 },
      pageSequence: expect.arrayContaining(["问题场景：1000 万行查询"])
    });

    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "approval_required",
      requiredGate: "learning-architecture"
    });
  });

  test("learning-architecture preserves requested page count", async () => {
    const { artifactStore, approvalService, workflow } = await createHarness(
      baseConfig({
        runId: "hash-table-8-pages",
        topic: "哈希表",
        source: { type: "topic", value: "哈希表" },
        pageCount: { target: 8, min: 6, max: 10 },
        sources: [
          {
            id: "source-001",
            type: "topic",
            title: "哈希表",
            value: "哈希表",
            language: "zh-CN"
          }
        ]
      })
    );

    await advanceToLearningArchitecture(workflow, approvalService, "hash-table-8-pages");
    await expect(artifactStore.readDraft("learning-architecture")).resolves.toMatchObject({
      pageCount: { planned: 8, target: 8 },
      pageSequence: expect.arrayContaining(["问题场景：1000 万行查询"])
    });
    const artifact = await artifactStore.readDraft<{ pageSequence: string[] }>("learning-architecture");
    expect(artifact.pageSequence).toHaveLength(8);
  });

  test("curriculum-plan gives overview full source coverage and topic units focused source slices", async () => {
    const sourceText = [
      "# 第一章 智能体总览",
      "智能体系统需要围绕目标、观察、计划、行动和反馈建立循环。",
      "工具调用扩大动作空间，但每次调用都需要可验证结果。",
      "审核点让多步任务保持质量边界。",
      "# 第二章 多智能体协作",
      "拆分任务前要先判断边界是否清晰。",
      "并行智能体必须通过结构化产物汇合。",
      "评审步骤用于发现遗漏、冲突和错误假设。",
      "# 第三章 运行时集成",
      "MCP 适合把能力暴露给 Codex 或 Claude 这类入口。",
      "运行状态需要压缩成可读的下一步动作。",
      "课程单元应保留来源锚点，方便后续复核。"
    ].join("\n\n");
    const { approvalService, artifactStore, workflow } = await createHarness(
      baseConfig({
        runId: "agentic-course",
        topic: "Agent Workflow Patterns",
        sourceKind: "book",
        source: { type: "text", value: sourceText },
        sources: [
          {
            id: "source-001",
            type: "text",
            kind: "book",
            title: "Agent Workflow Patterns",
            value: sourceText,
            language: "zh-CN"
          }
        ],
        coursePack: {
          strategy: "overview_plus_topic",
          includeOverview: true,
          preserveSourceMapping: true,
          unitPageCount: 8,
          preferredUnitCount: 4,
          selectedTopics: ["执行循环", "工具调用", "多智能体审核"],
          outputProducts: ["web_lesson", "assessment"]
        }
      })
    );

    await approveCorpusGates(workflow, approvalService, "agentic-course");

    const plan = await artifactStore.readDraft<{
      coursePack: {
        units: Array<{ id: string; sourceAnchorIds: string[]; conceptIds: string[] }>;
        conceptCoverage: Array<{ conceptId: string; unitIds: string[] }>;
        chapterMapping: Array<{ anchorIds: string[]; unitIds: string[] }>;
      };
    }>("curriculum-plan");
    const units = plan.coursePack.units;
    const overview = requireUnit(units, "unit-overview");
    const topic01 = requireUnit(units, "unit-topic-01");
    const topic02 = requireUnit(units, "unit-topic-02");
    const topic03 = requireUnit(units, "unit-topic-03");

    expect(overview.sourceAnchorIds.length).toBeGreaterThanOrEqual(12);
    expect(topic01.sourceAnchorIds.length).toBeGreaterThan(0);
    expect(topic01.sourceAnchorIds.length).toBeLessThan(overview.sourceAnchorIds.length);
    expect(topic01.sourceAnchorIds).not.toEqual(topic02.sourceAnchorIds);
    expect(topic02.sourceAnchorIds).not.toEqual(topic03.sourceAnchorIds);
    expect(new Set([topic01.conceptIds[0], topic02.conceptIds[0], topic03.conceptIds[0]]).size).toBe(3);
    expect(plan.coursePack.conceptCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ conceptId: "agent-loop", unitIds: ["unit-overview", "unit-topic-01"] }),
        expect.objectContaining({ conceptId: "tool-use", unitIds: ["unit-overview", "unit-topic-02"] }),
        expect.objectContaining({ conceptId: "multi-agent-review", unitIds: ["unit-overview", "unit-topic-03"] })
      ])
    );
    expect(plan.coursePack.chapterMapping[0]).toMatchObject({
      unitIds: ["unit-overview", "unit-topic-01", "unit-topic-02", "unit-topic-03"]
    });
    expect(plan.coursePack.chapterMapping[0]?.anchorIds).toEqual(overview.sourceAnchorIds);
  });

  test("writes visual-plan after learning-architecture is approved through ApprovalService", async () => {
    const { approvalService, workflow } = await createHarness();
    const runId = "database-index-001";

    await advanceToLearningArchitecture(workflow, approvalService, runId);
    await approveGate(approvalService, runId, "learning-architecture");

    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "artifact_written",
      artifactId: "visual-plan",
      version: "v1"
    });
  });

  test("regenerates current gate artifact when revision is requested for the current version", async () => {
    const { approvalService, workflow } = await createHarness();
    const runId = "database-index-001";

    await advanceToLearningArchitecture(workflow, approvalService, runId);
    await approvalService.approve({
      gate: "learning-architecture",
      runId,
      artifactId: "learning-architecture",
      version: "v1",
      decision: "revision_requested",
      operatorNotes: "Need a stronger problem-first path."
    });

    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "artifact_written",
      artifactId: "learning-architecture",
      version: "v2",
      createsGate: "learning-architecture"
    });
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "approval_required",
      requiredGate: "learning-architecture"
    });
  });

  test("invalidates downstream drafts when a revised upstream gate is regenerated", async () => {
    const { approvalService, runPath, workflow } = await createHarness();
    const runId = "database-index-001";

    await advanceToLearningArchitecture(workflow, approvalService, runId);
    await approveGate(approvalService, runId, "learning-architecture");
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "artifact_written",
      artifactId: "visual-plan",
      version: "v1"
    });
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "artifact_written",
      artifactId: "interaction-plan",
      version: "v1"
    });

    await approvalService.approve({
      gate: "learning-architecture",
      runId,
      artifactId: "learning-architecture",
      version: "v1",
      decision: "revision_requested",
      operatorNotes: "The approved architecture needs another revision."
    });

    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "artifact_written",
      artifactId: "learning-architecture",
      version: "v2",
      createsGate: "learning-architecture"
    });

    await expect(stat(path.join(runPath, "artifacts", "source-ingest.draft.json"))).resolves.toBeTruthy();
    await expect(stat(path.join(runPath, "artifacts", "visual-plan.draft.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(stat(path.join(runPath, "artifacts", "visual-plan.v1.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(stat(path.join(runPath, "artifacts", "interaction-plan.draft.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(stat(path.join(runPath, "artifacts", "interaction-plan.v1.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });

    await approveGate(approvalService, runId, "learning-architecture", "v2");
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "artifact_written",
      artifactId: "visual-plan",
      version: "v1"
    });
  });

  test("requires approval when learning-architecture approval points to an older artifact version", async () => {
    const { approvalService, artifactStore, workflow } = await createHarness();
    const runId = "database-index-001";

    await advanceToLearningArchitecture(workflow, approvalService, runId);
    await approveGate(approvalService, runId, "learning-architecture", "v1");
    await artifactStore.writeDraft("learning-architecture", {
      pageSequence: ["重写后的学习路径"],
      reason: "A later draft invalidates the earlier approval."
    });

    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "approval_required",
      requiredGate: "learning-architecture"
    });
  });

  test("regenerates learning-architecture when a later revision request exists for the current version", async () => {
    const { approvalService, workflow } = await createHarness();
    const runId = "database-index-001";

    await advanceToLearningArchitecture(workflow, approvalService, runId);
    await approveGate(approvalService, runId, "learning-architecture", "v1");
    await approvalService.approve({
      gate: "learning-architecture",
      runId,
      artifactId: "learning-architecture",
      version: "v1",
      decision: "revision_requested",
      operatorNotes: "The approved architecture needs another revision."
    });

    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "artifact_written",
      artifactId: "learning-architecture",
      version: "v2",
      createsGate: "learning-architecture"
    });
  });

  test("regenerates learning-architecture when it has only a current revision decision record", async () => {
    const { approvalService, runPath, workflow } = await createHarness();
    const runId = "database-index-001";

    await advanceToLearningArchitecture(workflow, approvalService, runId);
    await approvalService.approve({
      gate: "learning-architecture",
      runId,
      artifactId: "learning-architecture",
      version: "v1",
      decision: "revision_requested",
      operatorNotes: "Need clearer problem-first sequence."
    });

    await expect(stat(path.join(runPath, "approvals", "learning-architecture.decision.json"))).resolves.toBeTruthy();
    await expect(stat(path.join(runPath, "approvals", "learning-architecture.approved.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(workflow.runNext(runId)).resolves.toEqual({
      status: "artifact_written",
      artifactId: "learning-architecture",
      version: "v2",
      createsGate: "learning-architecture"
    });
  });

  test("returns complete when all artifacts and required approvals are present", async () => {
    const { approvalService, workflow } = await createHarness();
    const runId = "database-index-001";
    let lastResult = await workflow.runNext(runId);
    let guard = 0;

    while (lastResult.status !== "complete" && guard < 20) {
      guard += 1;
      if (lastResult.status === "approval_required") {
        await approveGate(approvalService, runId, lastResult.requiredGate);
      }
      lastResult = await workflow.runNext(runId);
    }

    expect(lastResult).toEqual({ status: "complete" });
    expect(guard).toBeLessThan(20);
  });

  test("mock lesson-assembly writes a promotion-ready lesson object using target page count", async () => {
    const { approvalService, artifactStore, workflow } = await createHarness(
      baseConfig({ pageCount: { target: 8, min: 6, max: 10 } })
    );
    const runId = "database-index-001";
    let lastResult = await workflow.runNext(runId);
    let guard = 0;

    while (!(lastResult.status === "artifact_written" && lastResult.artifactId === "lesson") && guard < 20) {
      guard += 1;
      if (lastResult.status === "approval_required") {
        await approveGate(approvalService, runId, lastResult.requiredGate);
      }
      lastResult = await workflow.runNext(runId);
    }

    expect(lastResult).toMatchObject({
      status: "artifact_written",
      artifactId: "lesson",
      createsGate: "lesson"
    });
    await expect(artifactStore.readDraft("lesson")).resolves.toMatchObject({
      id: "database-index-lesson",
      title: expect.stringContaining("数据库索引"),
      audience: "具备基础 SQL 经验的学习者",
      config: {
        targetPageCount: 8,
        minPageCount: 6,
        maxPageCount: 10
      },
      prerequisites: expect.arrayContaining(["会读简单 SELECT 查询"]),
      learningObjectives: expect.arrayContaining(["解释索引如何减少查询需要检查的数据范围"]),
      misconceptions: [
        expect.objectContaining({
          id: expect.any(String),
          statement: expect.any(String),
          correction: expect.any(String)
        }),
        expect.any(Object),
        expect.any(Object)
      ],
      transferTasks: [
        expect.objectContaining({
          id: expect.any(String),
          prompt: expect.any(String),
          targetMentalModel: expect.any(String)
        }),
        expect.any(Object)
      ],
      summary: expect.arrayContaining(["索引通过缩小搜索空间提升读取效率"])
    });
    const lesson = await artifactStore.readDraft<{ pages: Array<Record<string, unknown>>; targetPageCount?: unknown }>(
      "lesson"
    );
    const allowedPageTypes = new Set([
      "problem_scene",
      "intuition_visual",
      "structure_diagram",
      "process_animation",
      "interactive_model",
      "code_walkthrough",
      "quiz",
      "misconception_check",
      "transfer_challenge",
      "summary_card"
    ]);
    expect("targetPageCount" in lesson).toBe(false);
    expect(lesson.pages).toHaveLength(8);
    lesson.pages.forEach((page) => {
      expect(page).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        title: expect.any(String),
        learningGoal: expect.any(String),
        narrative: expect.any(String)
      });
      expect(allowedPageTypes.has(String(page.type))).toBe(true);
    });
  });

  test("mock lesson-critic writes a real quality report after lesson approval", async () => {
    const { approvalService, artifactStore, workflow } = await createHarness(
      baseConfig({ pageCount: { target: 8, min: 6, max: 10 } })
    );
    const runId = "database-index-001";
    let lastResult = await workflow.runNext(runId);
    let guard = 0;

    while (!(lastResult.status === "artifact_written" && lastResult.artifactId === "lesson") && guard < 20) {
      guard += 1;
      if (lastResult.status === "approval_required") {
        await approveGate(approvalService, runId, lastResult.requiredGate);
      }
      lastResult = await workflow.runNext(runId);
    }
    await approveGate(approvalService, runId, "lesson");

    await expect(workflow.runNext(runId)).resolves.toMatchObject({
      status: "artifact_written",
      artifactId: "critic-report",
      createsGate: "critic-report"
    });
    await expect(artifactStore.readDraft("critic-report")).resolves.toMatchObject({
      status: "passed",
      score: expect.any(Number),
      blockingFixes: [],
      optionalImprovements: expect.any(Array),
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "lesson-quality", ok: true }),
        expect.objectContaining({ name: "chinese-first", ok: true }),
        expect.objectContaining({ name: "source-grounding", ok: true })
      ])
    });
  });

  test("rejects unsafe runId through RunStore before reading outside runs", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "agent-runtime-workflow-"));
    tempRoots.push(workspaceRoot);
    const outsideRunPath = path.join(workspaceRoot, "outside");
    await mkdir(outsideRunPath, { recursive: true });
    await writeFile(path.join(outsideRunPath, "run.config.json"), `${JSON.stringify(baseConfig())}\n`);

    const runPath = await new RunStore(workspaceRoot).createRun(baseConfig());
    const artifactStore = new ArtifactStore(runPath);
    const workflow = new AgentWorkflow(
      new RunStore(workspaceRoot),
      artifactStore,
      new ApprovalService(runPath, artifactStore),
      new MockRuntimeAdapter()
    );

    await expect(workflow.runNext("../outside")).rejects.toThrow(/runId must match/);
    await expect(readFile(path.join(outsideRunPath, "run.config.json"), "utf8")).resolves.toContain(
      "database-index-001"
    );
  });
});

function requireUnit<T extends { id: string }>(units: T[], unitId: string): T {
  const unit = units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    throw new Error(`missing unit ${unitId}`);
  }
  return unit;
}
