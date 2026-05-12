import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { LearnerProjectService } from "./learner-project-service.js";
import { AuthoringContextService } from "./authoring-context-service.js";

describe("AuthoringContextService", () => {
  test("returns source-backed context for Codex-authored publishing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-"));
    const sourcePath = path.join(root, "agentic-rag.md");
    await writeFile(
      sourcePath,
      [
        "# Agentic RAG",
        "Agentic RAG starts from a practical question, decides whether retrieval is needed, and then chooses tools.",
        "The learner should compare when a fixed RAG pipeline is enough and when agentic routing is useful."
      ].join("\n\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 生成中文互动学习网页，面向有 RAG 基础的中文学习者，教学难度定位为大学高年级/研究生课程，每个单元 8 页，按任务组织。`,
      runId: "context-blog",
      sourcePath,
      sourceKind: "blog",
      audience: "有 RAG 基础的中文学习者",
      unitPages: 8,
      strategy: "task_guided",
      selectedTopics: ["任务判断", "工具选择"]
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "context-blog", maxAnchors: 4 });

    expect(context).toMatchObject({
      status: "authoring_context_ready",
      runId: "context-blog",
      brief: {
        sourceKind: "blog",
        strategy: "task_guided",
        difficultyLevel: "upper_undergraduate_or_graduate",
        unitPages: 8
      },
      source: {
        sourceKind: "blog",
        anchorCount: expect.any(Number),
        anchors: expect.arrayContaining([
          expect.objectContaining({
            anchorId: expect.stringContaining("source-001")
          })
        ])
      },
      sourceSemantics: {
        keyTerms: expect.arrayContaining([expect.objectContaining({ term: expect.any(String) })]),
        sourceSpecificTeachingMoves: expect.arrayContaining([expect.any(String)])
      },
      coursePlan: {
        strategy: "task_guided",
        strategyReason: expect.stringContaining("任务"),
        unitPages: 8,
        acceptanceExpectations: expect.arrayContaining([
          expect.objectContaining({
            id: "overview-plus-focused-units",
            required: true
          }),
          expect.objectContaining({
            id: "task-transfer-ready",
            required: true
          })
        ]),
        recommendedUnits: expect.arrayContaining([
          expect.objectContaining({ unitId: "unit-overview", kind: "overview", targetPageCount: 8 }),
          expect.objectContaining({
            kind: "task",
            targetPageCount: 8,
            taskLabel: expect.stringContaining("任务："),
            transferExpectation: expect.stringContaining("迁移"),
            expectedInteractions: expect.arrayContaining(["debugging", "comparison"]),
            expectedAssessments: expect.arrayContaining(["misconception_check", "transfer_challenge"])
          })
        ])
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course",
        language: "zh-CN"
      },
      contentBlueprint: {
        version: "content-blueprint/v1",
        units: expect.arrayContaining([
          expect.objectContaining({
            unitId: "unit-overview",
            lessonId: "context-blog-overview",
            targetPageCount: 8,
            sourceRequirement: expect.stringContaining("sourceAnchorIds"),
            pageBlueprints: expect.arrayContaining([
              expect.objectContaining({
                pageNumber: 1,
                pageType: "problem_scene",
                learnerAction: expect.stringContaining("判断")
              }),
              expect.objectContaining({
                pageType: "interactive_model",
                feedbackRequirement: expect.stringContaining("因果")
              }),
              expect.objectContaining({
                pageType: "transfer_challenge",
                mustInclude: expect.arrayContaining([expect.stringContaining("迁移")])
              })
            ])
          })
        ])
      }
    });
    expect(context.codexInstruction).toContain("请由 Codex 创作 coursePack 和 lessons");
    expect(context.codexInstruction).toContain("learning_agent.publish_learning_course");
    expect(context.codexInstruction).toContain("contentBlueprint.units[*].pageBlueprints");
    expect(context.source.anchors.length).toBeLessThanOrEqual(4);
    expect(context.qualityContract).toMatchObject({
      language: "zh-CN",
      academicRigor: {
        positioning: "upper_undergraduate_or_graduate",
        label: "大学高年级/研究生课程",
        requirements: expect.arrayContaining([expect.stringContaining("大学高年级/研究生课程")]),
        assessmentExpectations: expect.arrayContaining([expect.stringContaining("案例判断"), expect.stringContaining("边界判断")])
      },
      requiredPageTypes: expect.arrayContaining(["problem_scene", "interactive_model", "quiz", "misconception_check", "transfer_challenge"]),
      requiredLearningActions: expect.arrayContaining(["predict", "manipulate", "explain", "transfer"]),
      sourceKindGuidance: expect.objectContaining({
        sourceKind: "blog"
      }),
      supportedStrategies: expect.arrayContaining(["overview_plus_topic", "chapter_guided", "topic_guided", "task_guided", "hybrid"])
    });
    expect(context.codexInstruction).toContain("大学高年级/研究生课程");
    expect(context.codexInstruction).toContain("教学难度层级");
    expect(context.qualityContract.feedbackRules.join("\n")).toContain("为什么");
    expect(context.qualityContract.groundingRules.join("\n")).toContain("sourceAnchorIds");
    expect(context.learnerClarificationHints).toEqual(
      expect.arrayContaining([expect.stringContaining("学习目标"), expect.stringContaining("课程组织"), expect.stringContaining("难度层级")])
    );
    expect(context.artifacts).toMatchObject({
      coursePlanPath: expect.stringContaining("course-plan"),
      unitPlanPath: expect.stringContaining("unit-plan"),
      authoringContextPath: expect.stringContaining("authoring-context")
    });
    await expect(readFile(context.artifacts.coursePlanPath, "utf8")).resolves.toContain("acceptanceExpectations");
    await expect(readFile(context.artifacts.unitPlanPath, "utf8")).resolves.toContain("expectedInteractions");
    await expect(readFile(context.artifacts.authoringContextPath, "utf8")).resolves.toContain("content-blueprint/v1");
    await expect(readFile(context.artifacts.authoringContextPath, "utf8")).resolves.toContain("sourceSemantics");
  });

  test("returns topic-only context without requiring source approval artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-"));
    await new LearnerProjectService(root).createProject({
      request: "请生成哈希表中文互动学习网页，面向有编程基础的学习者，教学难度为本科核心课程，每个单元 8 页。",
      runId: "context-topic",
      audience: "有编程基础的学习者",
      unitPages: 8
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "context-topic" });

    expect(context).toMatchObject({
      status: "authoring_context_ready",
      runId: "context-topic",
      brief: {
        sourceKind: "topic",
        difficultyLevel: "undergraduate_core",
        unitPages: 8,
        language: "zh-CN"
      },
      source: {
        sourceKind: "topic",
        anchorCount: 1
      },
      authoringContract: {
        defaultTool: "learning_agent.publish_learning_course"
      }
    });
    expect(context.coursePlan.recommendedUnits[0]?.title).toContain("哈希表");
    expect(context.qualityContract.sourceKindGuidance.sourceKind).toBe("topic");
    expect(context.qualityContract.sourceKindGuidance.authoringFocus.join("\n")).toContain("心智模型");
    expect(context.contentBlueprint.units[0]?.pageBlueprints[0]?.sourceRequirement).toContain("不要伪造 sourceAnchorIds");
  });

  test("adds a paper research-reading contract for research-level authoring", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-paper-research-context-"));
    const sourcePath = path.join(root, "talker-reasoner-paper.md");
    await writeFile(
      sourcePath,
      [
        "# Agents Thinking Fast and Slow",
        "The paper proposes a Talker-Reasoner architecture for language agents.",
        "The research question asks how to separate user-facing interaction from internal reasoning.",
        "Experiments evaluate reliability under tool feedback and multi-step reasoning.",
        "Limitations include assumptions about feedback quality and transfer to new tasks."
      ].join("\n\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 生成中文论文精读课，面向研究生，教学难度为研究论文精读，每个单元 8 页。`,
      runId: "context-paper-research",
      sourcePath,
      sourceKind: "paper",
      audience: "研究生",
      difficultyLevel: "research",
      unitPages: 8
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "context-paper-research", maxAnchors: 8 });

    expect(context.qualityContract.researchReadingContract).toMatchObject({
      requiredMoves: expect.arrayContaining([
        "研究问题",
        "论文贡献",
        "方法机制",
        "实验/证据",
        "局限/威胁",
        "迁移判断"
      ]),
      avoid: expect.arrayContaining([expect.stringContaining("普通博客")])
    });
    expect(context.codexInstruction).toContain("论文精读课");
    expect(context.codexInstruction).toContain("研究问题、论文贡献、方法机制、实验/证据、局限/威胁、迁移判断");
    expect(context.contentBlueprint.globalRules.join("\n")).toContain("论文精读");
    expect(context.contentBlueprint.units[0]?.pageBlueprints[0]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("论文贡献")]));
    expect(context.contentBlueprint.units[0]?.pageBlueprints[4]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("实验/证据")]));
    expect(context.contentBlueprint.units[0]?.pageBlueprints[5]?.mustInclude).toEqual(expect.arrayContaining([expect.stringContaining("局限")]));
  });

  test("adds source-kind depth contracts for patent and blog authoring", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-source-kind-depth-context-"));
    const patentPath = path.join(root, "cache-patent.md");
    const blogPath = path.join(root, "agent-workflow-blog.md");
    await writeFile(
      patentPath,
      [
        "# 缓存系统专利",
        "权利要求1：一种缓存系统，包括键映射模块和失效控制模块。",
        "现有技术问题在于缓存一致性和命中率之间难以权衡。",
        "实施例说明该系统如何在边缘节点处理失效通知。"
      ].join("\n\n"),
      "utf8"
    );
    await writeFile(
      blogPath,
      [
        "# Agent Workflow in Production",
        "The post explains a production workflow for tool-using agents.",
        "The practical problem is debugging failed tool calls.",
        "Caveats include retries, missing observations, and rollout safety checks."
      ].join("\n\n"),
      "utf8"
    );

    await new LearnerProjectService(root).createProject({
      request: `请用 "${patentPath}" 生成中文专利解读课程，面向技术产品经理，教学难度为大学高年级课程，每个单元 8 页。`,
      runId: "context-patent-depth",
      sourcePath: patentPath,
      sourceKind: "patent",
      audience: "技术产品经理",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8
    });
    await new LearnerProjectService(root).createProject({
      request: `请用 "${blogPath}" 生成中文实践案例课程，面向工程师，教学难度为大学高年级课程，每个单元 8 页。`,
      runId: "context-blog-depth",
      sourcePath: blogPath,
      sourceKind: "blog",
      audience: "工程师",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8
    });

    const patentContext = await new AuthoringContextService(root).getContext({ runId: "context-patent-depth", maxAnchors: 8 });
    const blogContext = await new AuthoringContextService(root).getContext({ runId: "context-blog-depth", maxAnchors: 8 });

    expect(patentContext.qualityContract.sourceKindDepthContract).toMatchObject({
      sourceKind: "patent",
      requiredMoves: expect.arrayContaining(["权利要求边界", "现有技术问题", "技术方案/机制", "实施例", "法律/适用边界", "规避或迁移判断"])
    });
    expect(patentContext.codexInstruction).toContain("专利解读课");
    expect(patentContext.codexInstruction).toContain("权利要求边界、现有技术问题、技术方案/机制、实施例、法律/适用边界、规避或迁移判断");

    expect(blogContext.qualityContract.sourceKindDepthContract).toMatchObject({
      sourceKind: "blog",
      requiredMoves: expect.arrayContaining(["实际问题", "作者方案", "实现路径", "caveat/失败模式", "可操作检查", "迁移边界"])
    });
    expect(blogContext.codexInstruction).toContain("实践案例课");
    expect(blogContext.codexInstruction).toContain("实际问题、作者方案、实现路径、caveat/失败模式、可操作检查、迁移边界");
  });

  test("returns professor lecture deck intent and authoring guidance", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-context-professor-"));
    const sourcePath = path.join(root, "lecture-book.md");
    await writeFile(
      sourcePath,
      [
        "# Agentic Design Patterns",
        "This chapter introduces planning, tool use, reflection, and evaluation.",
        "A graduate course should compare agent orchestration patterns and assign homework."
      ].join("\n"),
      "utf8"
    );
    const project = await new LearnerProjectService(root).createProject({
      request:
        `请用 "${sourcePath}" 生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。`,
      runId: "professor-authoring",
      courseIntent: "professor_lecture_deck"
    });
    expect(project.status).toBe("project_ready");

    const context = await new AuthoringContextService(root).getContext({ runId: "professor-authoring" });

    expect(context.brief.courseIntent).toBe("professor_lecture_deck");
    expect(context.contentBlueprint.courseIntent).toBe("professor_lecture_deck");
    expect(context.contentBlueprint.globalRules.join("\n")).toContain("教材式知识链路 Web Deck");
    expect(context.contentBlueprint.units[0]?.pageBlueprints.some((page) => page.lectureRole === "worked_example")).toBe(true);
    expect(context.qualityContract.courseIntent).toBe("professor_lecture_deck");
    expect(context.qualityContract.requiredPageTypes).toEqual([
      "problem_scene",
      "structure_diagram",
      "intuition_visual",
      "interactive_model",
      "code_walkthrough",
      "misconception_check",
      "quiz",
      "transfer_challenge",
      "summary_card"
    ]);
    expect(context.qualityContract.requiredLearningActions).toEqual([
      "map_knowledge_nodes",
      "explain_key_links",
      "define_terms",
      "work_example",
      "compare_boundaries",
      "summarize_structure"
    ]);
    expect(context.qualityContract.publishChecklist.join("\n")).toContain("interactionSpec 和 assessmentSpec 是可选内部结构");
    expect(context.qualityContract.publishChecklist.join("\n")).toContain("学生侧页面应像教材课件");
    expect(context.authoringContract.requirements.join("\n")).toContain("knowledgeBoard");
    expect(context.authoringContract.requirements.join("\n")).toContain("原文命题");
    expect(context.authoringContract.requirements.join("\n")).toContain("左栏");
    expect(context.authoringContract.requirements.join("\n")).toContain("右栏");
    expect(context.codexInstruction).toContain("教材式知识链路 Web Deck");
    expect(context.codexInstruction).toContain("knowledgeBoard");
    expect(context.codexInstruction).toContain("原文命题");
    expect(context.codexInstruction).toContain("左栏");
    expect(context.codexInstruction).toContain("右栏");
  });

  test("matches professor required page types to the requested 8-page blueprint", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-context-professor-8-"));
    const sourcePath = path.join(root, "lecture-book.md");
    await writeFile(
      sourcePath,
      [
        "# Agentic Design Patterns",
        "This chapter introduces planning, tool use, reflection, and evaluation.",
        "A graduate course should compare agent orchestration patterns and assign homework."
      ].join("\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 生成教授式中文 Web Deck，面向研究生，教学难度为大学高年级/研究生课程，每个单元 8 页。`,
      runId: "professor-authoring-8",
      sourcePath,
      sourceKind: "book",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 8,
      courseIntent: "professor_lecture_deck"
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "professor-authoring-8" });
    const blueprintPageTypes = context.contentBlueprint.units[0]?.pageBlueprints.map((page) => page.pageType) ?? [];
    const uniqueBlueprintPageTypes = Array.from(new Set(blueprintPageTypes));

    expect(context.qualityContract.requiredPageTypes).toEqual(uniqueBlueprintPageTypes);
    expect(context.qualityContract.requiredPageTypes).toEqual([
      "problem_scene",
      "structure_diagram",
      "interactive_model",
      "code_walkthrough",
      "misconception_check",
      "quiz",
      "summary_card"
    ]);
    expect(context.qualityContract.requiredPageTypes).not.toContain("intuition_visual");
    expect(context.qualityContract.requiredPageTypes).not.toContain("transfer_challenge");
  });

  test("exposes self-study textbook total page budget to Codex authoring context", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-context-self-study-"));
    const sourcePath = path.join(root, "agentic-book.md");
    await writeFile(
      sourcePath,
      [
        "# Agentic Design Patterns",
        "Prompt chaining decomposes a complex task into sequential steps.",
        "Routing chooses the next path based on the input and intermediate state."
      ].join("\n\n"),
      "utf8"
    );
    const project = await new LearnerProjectService(root).createProject({
      request:
        `请用 "${sourcePath}" 做成学生自学 Web 教材，总共 80 页，每个单元 8 页，面向研究生，教学难度为大学高年级/研究生课程。`,
      runId: "self-study-authoring",
      sourcePath,
      sourceKind: "book"
    });
    expect(project.status).toBe("project_ready");

    const context = await new AuthoringContextService(root).getContext({ runId: "self-study-authoring" });

    expect(context.brief).toMatchObject({
      courseIntent: "student_self_study_textbook",
      targetTotalPages: 80,
      totalPagesSpecified: true
    });
    expect(context.coursePlan).toMatchObject({
      targetTotalPages: 80,
      estimatedTotalPages: expect.any(Number),
      pageBudgetReminder: "学习者指定总页数约 80 页。"
    });
    expect(context.codexInstruction).toContain("总页数预算：约 80 页");
    expect(context.codexInstruction).toContain("这是用户指定值");
  });

  test("matches professor required page types to the requested 7-page blueprint", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "authoring-context-professor-7-"));
    const sourcePath = path.join(root, "lecture-book.md");
    await writeFile(
      sourcePath,
      [
        "# Agentic Design Patterns",
        "This chapter introduces planning, tool use, reflection, and evaluation.",
        "A graduate course should compare agent orchestration patterns and assign homework."
      ].join("\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 生成教授式中文 Web Deck，面向研究生，教学难度为大学高年级/研究生课程，每个单元 7 页。`,
      runId: "professor-authoring-7",
      sourcePath,
      sourceKind: "book",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 7,
      courseIntent: "professor_lecture_deck"
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "professor-authoring-7" });
    const blueprintPageTypes = context.contentBlueprint.units[0]?.pageBlueprints.map((page) => page.pageType) ?? [];
    const uniqueBlueprintPageTypes = Array.from(new Set(blueprintPageTypes));

    expect(context.contentBlueprint.units[0]?.pageBlueprints).toHaveLength(7);
    expect(context.qualityContract.requiredPageTypes).toEqual(uniqueBlueprintPageTypes);
    expect(context.qualityContract.requiredPageTypes).toEqual([
      "problem_scene",
      "structure_diagram",
      "interactive_model",
      "code_walkthrough",
      "misconception_check",
      "summary_card"
    ]);
    expect(context.qualityContract.requiredPageTypes).not.toContain("quiz");
    expect(context.qualityContract.requiredPageTypes).not.toContain("transfer_challenge");
  });

  test("samples long book anchors from content pages instead of front matter", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-"));
    const sourcePath = path.join(root, "agentic-book.md");
    await writeFile(
      sourcePath,
      [
        "# Table of Contents",
        "Agentic Design Patterns Table of Contents total 424 pages Dedication Acknowledgment Foreword.",
        "# Dedication",
        "To my son Bruno and family.",
        "# Acknowledgment",
        "Thanks to reviewers and friends.",
        "# Preface",
        "Agentic systems evolve from reactive programs to autonomous systems.",
        "# What makes an AI system an Agent?",
        "An agent perceives its environment and takes actions to achieve a goal.",
        "# Why Patterns Matter in Agent Development",
        "Patterns help designers address state, tool use, communication, and feedback challenges.",
        "# Tool Use",
        "Tool use connects reasoning to external APIs and observable actions."
      ].join("\n\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request: `请用 "${sourcePath}" 这本书生成中文互动学习网页，面向中文学习者，教学难度为大学高年级/研究生课程，每个单元 4 页，先总览再按核心 topic 拆课。`,
      runId: "context-long-book",
      sourcePath,
      sourceKind: "book",
      audience: "中文学习者",
      unitPages: 4,
      strategy: "overview_plus_topic",
      selectedTopics: ["tool use"]
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "context-long-book", maxAnchors: 4 });
    const quoteText = context.source.anchors.map((anchor) => anchor.quote ?? anchor.label).join("\n");

    expect(context.source.anchors).toHaveLength(4);
    expect(context.source.anchors[0]?.quote).toMatch(/Tool use/iu);
    expect(quoteText).toContain("Patterns help designers");
    expect(quoteText).not.toContain("Table of Contents total 424 pages");
    expect(context.coursePlan.recommendedUnits[0]?.sourceAnchorIds).toContain(context.source.anchors[0]?.anchorId);
    expect(context.contentBlueprint.units[0]?.sourceAnchorIds).toContain(context.source.anchors[0]?.anchorId);
  });

  test("surfaces source chapters and plans professor book units from chapter-level patterns", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-chapters-"));
    const sourcePath = path.join(root, "Agentic Design Patterns.md");
    await writeFile(
      sourcePath,
      [
        "# Table of Contents",
        "1. Chapter 1: Prompt Chaining",
        "2. Chapter 2: Routing",
        "3. Chapter 3: Parallelization",
        "# Chapter 1: Prompt Chaining",
        "Prompt chaining breaks complex tasks into sequential, inspectable LLM steps.",
        "# Chapter 2: Routing",
        "Routing classifies requests and dispatches each request to a suitable model or workflow.",
        "# Chapter 3: Parallelization",
        "Parallelization runs independent subtasks concurrently and combines outputs."
      ].join("\n\n"),
      "utf8"
    );
    await new LearnerProjectService(root).createProject({
      request:
        `请用 "${sourcePath}" 生成教授式中文 Web Deck，像大学/研究生课程讲义一样组织，面向研究生，教学难度为大学高年级/研究生课程，每个单元 10 页。先总览，再按核心 pattern 拆课。`,
      runId: "context-professor-chapters",
      sourcePath,
      sourceKind: "book",
      audience: "研究生",
      difficultyLevel: "upper_undergraduate_or_graduate",
      unitPages: 10,
      strategy: "overview_plus_topic",
      courseIntent: "professor_lecture_deck"
    });

    const context = await new AuthoringContextService(root).getContext({ runId: "context-professor-chapters", maxAnchors: 6 });

    expect(context.source.chapters.map((chapter) => chapter.title)).toEqual([
      "Chapter 1: Prompt Chaining",
      "Chapter 2: Routing",
      "Chapter 3: Parallelization"
    ]);
    expect(context.source.anchors.map((anchor) => anchor.anchorId)).toEqual(
      expect.arrayContaining(["source-001:chapter-1-prompt-chaining", "source-001:chapter-2-routing", "source-001:chapter-3-parallelization"])
    );
    expect(context.coursePlan.recommendedUnits.slice(1).map((unit) => unit.title)).toEqual([
      "Agentic Design Patterns：Chapter 1: Prompt Chaining",
      "Agentic Design Patterns：Chapter 2: Routing",
      "Agentic Design Patterns：Chapter 3: Parallelization"
    ]);
    expect(context.coursePlan.recommendedUnits[1]).toMatchObject({
      sourceAnchorIds: expect.arrayContaining(["source-001:chapter-1-prompt-chaining"]),
      chapterRefs: ["Chapter 1: Prompt Chaining"]
    });
    expect(context.contentBlueprint.units[1]?.focusConcepts).toEqual(["Chapter 1: Prompt Chaining"]);
  });

  test.each([
    ["book", "章节映射"],
    ["paper", "研究问题"],
    ["patent", "权利要求"],
    ["blog", "实现模式"],
    ["notes", "用户原始结构"]
  ])("adds source-kind guidance for %s projects", async (sourceKind, expectedFocus) => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-authoring-context-"));
    await new LearnerProjectService(root).createProject({
      request: `请生成 ${sourceKind} 中文互动学习网页，面向中文学习者，教学难度为研究生课程，每个单元 8 页。`,
      runId: `context-${sourceKind}`,
      sourceKind,
      audience: "中文学习者",
      unitPages: 8
    });

    const context = await new AuthoringContextService(root).getContext({ runId: `context-${sourceKind}` });

    expect(context.qualityContract.sourceKindGuidance).toMatchObject({
      sourceKind,
      authoringFocus: expect.arrayContaining([expect.stringContaining(expectedFocus)])
    });
  });
});
