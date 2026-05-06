import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ArtifactStore } from "../agent-runtime/artifact-store.js";
import { RunStore } from "../agent-runtime/run-store.js";
import { LearningAgentRuntimeTools } from "./runtime-tools.js";
import { learningAgentToolContracts } from "./tool-contracts.js";

describe("LearningAgentRuntimeTools", () => {
  test("declares stable learning agent tool contracts", () => {
    expect(learningAgentToolContracts.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "learning_agent.create_learning_project",
        "learning_agent.list_learning_projects",
        "learning_agent.archive_learning_project",
        "learning_agent.get_authoring_context",
        "learning_agent.generate_grounded_course",
        "learning_agent.publish_learning_course",
        "learning_agent.get_learning_preview",
        "learning_agent.generate_quick_preview",
        "learning_agent.revise_learning_course",
        "learning_agent.apply_learning_revision",
        "learning_agent.export_learning_course",
        "learning_agent.init_run",
        "learning_agent.plan_run",
        "learning_agent.init_from_plan",
        "learning_agent.status",
        "learning_agent.beta_status",
        "learning_agent.run_until_gate",
        "learning_agent.list_artifacts",
        "learning_agent.read_artifact",
        "learning_agent.submit_artifact",
        "learning_agent.approve_gate",
        "learning_agent.revise_gate",
        "learning_agent.list_units",
        "learning_agent.run_next",
        "learning_agent.run_course",
        "learning_agent.promote_units",
        "learning_agent.promote_lesson"
      ])
    );
  });

  test("plans and initializes a run from natural language through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);

    const planResult = await tools.callTool("learning_agent.plan_run", {
      request: "用哈希表生成 8 页中文课，面向有基础编程经验但缺少数据结构心智模型的学习者。",
      runId: "mcp-nl-plan",
      adapter: "mock"
    });
    const initResult = await tools.callTool("learning_agent.init_from_plan", {
      runId: "mcp-nl-plan",
      approve: true
    });
    const statusResult = await tools.callTool("learning_agent.status", { runId: "mcp-nl-plan" });

    expect(planResult).toMatchObject({
      status: "plan_written",
      runId: "mcp-nl-plan",
      summary: expect.arrayContaining(["unitPages=8", "language=zh-CN"])
    });
    expect(initResult).toMatchObject({ status: "initialized", runId: "mcp-nl-plan" });
    expect(statusResult).toMatchObject({
      runId: "mcp-nl-plan",
      topic: "哈希表",
      pageCount: { target: 8 }
    });
    await expect(readFile(path.join(root, "runs", "mcp-nl-plan", "run.plan.json"), "utf8")).resolves.toContain(
      "\"status\": \"approved\""
    );
    await expect(readFile(path.join(root, "runs", "mcp-nl-plan", "run.config.json"), "utf8")).resolves.toContain(
      "\"adapter\": \"mock\""
    );
  });

  test("initializes and reads run status through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);

    const initResult = await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-smoke"
    });
    const statusResult = await tools.callTool("learning_agent.status", { runId: "mcp-smoke" });

    expect(initResult).toMatchObject({ status: "initialized", runId: "mcp-smoke" });
    expect(statusResult).toMatchObject({
      runId: "mcp-smoke",
      topic: "哈希表",
      pageCount: { target: 8 }
    });
    await expect(readFile(path.join(root, "runs", "mcp-smoke", "run.config.json"), "utf8")).resolves.toContain("哈希表");
  });

  test("applies the latest targeted revision through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    const lesson = buildQualityLesson();
    lesson.pages = (lesson.pages as Array<Record<string, unknown>>).map((page, index) => ({
      ...page,
      narrative: `第${index + 1}页原文`
    }));
    await tools.callTool("learning_agent.publish_learning_course", {
      runId: "mcp-revision",
      lessons: [lesson],
      coursePack: {
        id: "mcp-revision",
        title: "哈希表：课程包",
        parentRunId: "mcp-revision",
        units: [
          {
            unitId: "unit-overview",
            title: "哈希表：总览课",
            kind: "overview",
            lessonId: "hash-table",
            targetPageCount: 8
          }
        ]
      }
    });
    await tools.callTool("learning_agent.revise_learning_course", {
      runId: "mcp-revision",
      feedback: "第 3 页补一个工程排障例子"
    });

    const result = await tools.callTool("learning_agent.apply_learning_revision", { runId: "mcp-revision" });
    const lessonText = await readFile(path.join(root, "runs", "mcp-revision", "preview", "lessons", "hash-table.json"), "utf8");

    expect(result).toMatchObject({
      status: "revision_applied",
      runId: "mcp-revision",
      revisionId: "revision-001",
      changedLessonIds: ["hash-table"],
      preview: {
        coursePackId: "mcp-revision",
        lessonCount: 1
      },
      qualityReport: {
        status: "passed"
      }
    });
    expect(lessonText).toContain('"narrative": "第3页原文\\n\\n修订说明：第 3 页补一个工程排障例子"');
    expect(lessonText.match(/修订说明/g)).toHaveLength(1);
  });

  test("lists and archives learner projects through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);

    await tools.callTool("learning_agent.create_learning_project", {
      request: "请用 /tmp/book.pdf 生成中文学习材料，面向有编程基础的学习者，每个单元 8 页，先总览再按核心 topic 拆课。",
      runId: "mcp-book-project"
    });

    const listResult = await tools.callTool("learning_agent.list_learning_projects", {});

    expect(listResult).toMatchObject({
      status: "projects_ready",
      projects: [
        expect.objectContaining({
          projectId: "mcp-book-project",
          sourceKind: "book",
          sourceRefs: ["/tmp/book.pdf"],
          status: "draft"
        })
      ]
    });

    const archiveResult = await tools.callTool("learning_agent.archive_learning_project", { runId: "mcp-book-project" });
    const manifest = JSON.parse(await readFile(path.join(root, "runs", "mcp-book-project", "learner-project.json"), "utf8")) as {
      request?: string;
      brief?: unknown;
      project?: { status: string };
    };

    expect(archiveResult).toMatchObject({
      status: "project_archived",
      runId: "mcp-book-project",
      project: expect.objectContaining({ status: "archived" })
    });
    expect(manifest.request).toContain("/tmp/book.pdf");
    expect(manifest.brief).toBeDefined();
    expect(manifest.project?.status).toBe("archived");
  });

  test("returns authoring context through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const sourcePath = path.join(root, "source.md");
    await writeFile(sourcePath, "# 工具选择\n先判断任务，再决定是否检索和调用工具。", "utf8");
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.create_learning_project", {
      request: `请用 "${sourcePath}" 生成中文学习网页，面向中文学习者，每个单元 8 页。`,
      runId: "mcp-authoring-context",
      sourcePath,
      sourceKind: "notes",
      audience: "中文学习者",
      unitPages: 8
    });

    const result = await tools.callTool("learning_agent.get_authoring_context", {
      runId: "mcp-authoring-context",
      maxAnchors: 3
    });

    expect(result).toMatchObject({
      status: "authoring_context_ready",
      runId: "mcp-authoring-context",
      source: {
        sourceKind: "notes",
        anchorCount: expect.any(Number)
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course"
      }
    });
  });

  test("exports a preview-ready learning course through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    const runDir = path.join(root, "runs", "mcp-export");
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify({
        status: "preview_ready",
        runId: "mcp-export",
        coursePackId: "mcp-export",
        courseTitle: "导出课程",
        lessonCount: 1,
        lessonPaths: [],
        coursePackPath: path.join(root, "src/course-packs/mcp-export/coursePack.ts")
      }),
      "utf8"
    );

    const result = await tools.callTool("learning_agent.export_learning_course", { runId: "mcp-export" });

    expect(result).toMatchObject({
      status: "export_ready",
      runId: "mcp-export",
      manifestPath: expect.stringContaining("manifest.json")
    });
  });

  test("submits and approves artifacts through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-smoke"
    });
    const artifactPath = path.join(root, "source-map.json");
    await writeFile(artifactPath, JSON.stringify({ artifactId: "source-map", anchors: [] }), "utf8");

    const submitResult = await tools.callTool("learning_agent.submit_artifact", {
      runId: "mcp-smoke",
      artifactId: "source-map",
      filePath: artifactPath
    });
    const approveResult = await tools.callTool("learning_agent.approve_gate", {
      runId: "mcp-smoke",
      gate: "source-map",
      version: "v1",
      notes: "ok"
    });

    expect(submitResult).toMatchObject({ status: "artifact_submitted", artifactId: "source-map", version: "v1" });
    expect(approveResult).toMatchObject({ gate: "source-map", decision: "approved" });
  });

  test("runs the next workflow step through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-smoke"
    });

    const result = await tools.callTool("learning_agent.run_next", { runId: "mcp-smoke" });
    const betaStatus = await tools.callTool("learning_agent.beta_status", { runId: "mcp-smoke" });

    expect(result).toMatchObject({ status: "artifact_written", artifactId: "source-map" });
    expect(betaStatus).toMatchObject({
      status: "beta_status",
      runId: "mcp-smoke",
      parent: {
        currentGate: "source-map",
        nextActions: [expect.stringContaining("Review source-map")]
      },
      operatorHints: {
        reviewQueue: [
          expect.objectContaining({
            gate: "source-map",
            version: "v1",
            artifactPath: "runs/mcp-smoke/artifacts/source-map.v1.json"
          })
        ],
        nextToolCalls: [
          expect.objectContaining({
            toolName: "learning_agent.read_artifact",
            input: { runId: "mcp-smoke", artifactId: "source-map", version: "v1" }
          })
        ],
        readyToPromote: false
      }
    });
    expect(JSON.stringify(betaStatus).length).toBeLessThan(15000);
  });

  test("advances a run until the next approval gate and exposes generated artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-loop"
    });

    const runResult = await tools.callTool("learning_agent.run_until_gate", {
      runId: "mcp-loop",
      maxSteps: 5
    });
    const artifacts = await tools.callTool("learning_agent.list_artifacts", { runId: "mcp-loop" });
    const sourceMap = await tools.callTool("learning_agent.read_artifact", {
      runId: "mcp-loop",
      artifactId: "source-map",
      version: "v1"
    });

    expect(runResult).toMatchObject({
      status: "run_advanced",
      runId: "mcp-loop",
      finalStatus: "approval_required",
      requiredGate: "source-map",
      steps: [
        expect.objectContaining({ status: "artifact_written", artifactId: "source-map" }),
        expect.objectContaining({ status: "approval_required", requiredGate: "source-map" })
      ]
    });
    expect(artifacts).toMatchObject({
      runId: "mcp-loop",
      artifacts: expect.arrayContaining([
        expect.objectContaining({
          artifactId: "source-map",
          versions: expect.arrayContaining(["v1"]),
          aliases: expect.arrayContaining(["draft"])
        })
      ])
    });
    expect(sourceMap).toMatchObject({
      artifactId: "source-map",
      version: "v1",
      payload: expect.objectContaining({
        artifactId: "source-map",
        anchors: expect.any(Array)
      })
    });
  });

  test("promotes an approved lesson through tool handlers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-"));
    const tools = new LearningAgentRuntimeTools(root);
    await tools.callTool("learning_agent.init_run", {
      topic: "哈希表",
      unitPages: "8",
      language: "zh-CN",
      adapter: "mock",
      run: "mcp-smoke"
    });
    const runPath = new RunStore(root).getRunPath("mcp-smoke");
    const artifacts = new ArtifactStore(runPath);
    await artifacts.writeDraft("lesson", buildQualityLesson());
    await tools.callTool("learning_agent.approve_gate", {
      runId: "mcp-smoke",
      gate: "lesson",
      version: "v1"
    });

    const result = await tools.callTool("learning_agent.promote_lesson", { runId: "mcp-smoke" });

    expect(result).toMatchObject({ status: "promoted", lessonId: "hash-table" });
  });

  test("returns clear errors for unknown tools", async () => {
    const tools = new LearningAgentRuntimeTools(await mkdtemp(path.join(tmpdir(), "learning-agent-mcp-")));

    await expect(tools.callTool("learning_agent.missing", {})).rejects.toThrow(/unsupported tool/);
  });
});

function buildQualityLesson(): Record<string, unknown> {
  return {
    id: "hash-table",
    title: "哈希表为什么快",
    audience: "中文学习者",
    config: { targetPageCount: 8, minPageCount: 6, maxPageCount: 10 },
    prerequisites: [],
    learningObjectives: ["解释哈希表访问路径"],
    pages: [
      page("p1", "problem_scene", "visual"),
      page("p2", "intuition_visual", "visual"),
      page("p3", "structure_diagram", "visual"),
      page("p4", "interactive_model", "interaction"),
      page("p5", "interactive_model", "interaction"),
      page("p6", "quiz", "assessment"),
      page("p7", "misconception_check", "assessment"),
      page("p8", "summary_card", "visual")
    ],
    misconceptions: [{ id: "m1", statement: "哈希表永远 O(1)", correction: "冲突严重时会变慢。" }],
    transferTasks: [{ id: "t1", prompt: "迁移到缓存 key 设计", targetMentalModel: "用搜索空间缩小解释加速。" }],
    summary: ["哈希表用 key 缩小搜索空间。"]
  };
}

function page(id: string, type: string, kind: "visual" | "interaction" | "assessment"): Record<string, unknown> {
  const base = {
    id,
    type,
    title: `${id} 中文页`,
    learningGoal: id === "p1" ? "解释哈希表访问路径" : "建立理解",
    narrative: "中文内容"
  };
  if (kind === "visual") {
    return { ...base, visualSpec: { kind: "diagram", description: "中文图示", keyElements: ["元素一"] } };
  }
  if (kind === "interaction") {
    return {
      ...base,
      interactionSpec: {
        kind: "choice",
        learnerAction: "选择路径",
        expectedObservation: "看到变化",
        cognitivePurpose: "理解因果",
        options: [
          {
            id: "a",
            label: "选择 A",
            resultTitle: "结果",
            outcomeId: "a",
            resultTone: "success",
            explanation: "因为候选范围变小。"
          }
        ]
      }
    };
  }
  return {
    ...base,
    assessmentSpec: {
      kind: "multiple_choice",
      prompt: "哪个更好？",
      options: ["中文选项 A", "中文选项 B"],
      correctAnswer: "中文选项 A"
    },
    feedbackSpec: {
      correctFeedback: "正确，因为解释了机制。",
      incorrectFeedback: "不对，需要看机制。"
    }
  };
}
