import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { CodexAuthoredTrialService } from "./codex-authored-trial.js";

describe("CodexAuthoredTrialService", () => {
  test("publishes a source-grounded Codex-authored trial bundle in an isolated workspace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-authored-trial-"));
    const sourcePath = path.join(root, "source.pdf");

    const result = await new CodexAuthoredTrialService(root).runTrial({
      runId: "trial-book",
      sourcePath,
      sourceKind: "book",
      audience: "有编程基础但缺少智能体系统心智模型的中文学习者",
      unitPages: 8
    });

    expect(result).toMatchObject({
      status: "preview_ready",
      runId: "trial-book",
      coursePackId: "trial-book",
      preview: {
        devCommand: "npm run dev",
        localUrl: "http://127.0.0.1:5173/#/preview/trial-book"
      },
      qualityReport: {
        status: "passed"
      }
    });
    await expect(readFile(path.join(root, "runs", "trial-book", "preview", "lessons", "trial-book-overview.json"), "utf8")).resolves.toContain(
      "sourceContext"
    );
  });

  test("covers every recommended course-plan unit instead of publishing only an overview sample", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-authored-full-plan-"));
    const sourcePath = path.join(root, "agentic-design.md");
    await writeFile(
      sourcePath,
      [
        "# Agentic Design Patterns",
        "Agent loops connect planning, tool use, memory, review, and recovery.",
        "## Core mechanism",
        "A robust agent keeps state, selects tools, observes feedback, and revises the next action.",
        "## Key example",
        "A research agent splits source reading, claim extraction, and lesson generation into separate checks.",
        "## Misconception",
        "More agents do not automatically improve quality without review boundaries.",
        "## Transfer",
        "The same model can evaluate coding agents, tutoring agents, and document analysis agents."
      ].join("\n"),
      "utf8"
    );

    const result = await new CodexAuthoredTrialService(root).runTrial({
      runId: "trial-full-plan",
      sourcePath,
      sourceKind: "book",
      audience: "有编程基础但缺少智能体系统心智模型的中文学习者",
      unitPages: 8
    });

    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") {
      return;
    }
    expect(result.lessonPaths).toHaveLength(5);
    expect(result.publishValidation).toMatchObject({
      status: "passed",
      errorCount: 0
    });

    const coursePack = JSON.parse(await readFile(result.coursePackPath, "utf8")) as {
      units: Array<{ unitId: string; lessonId?: string; targetPageCount: number }>;
    };
    expect(coursePack.units.map((unit) => unit.unitId)).toEqual([
      "unit-overview",
      "unit-topic-01",
      "unit-topic-02",
      "unit-topic-03",
      "unit-topic-04"
    ]);
    expect(new Set(coursePack.units.map((unit) => unit.lessonId)).size).toBe(5);

    const manifest = JSON.parse(await readFile(path.join(root, "runs", "trial-full-plan", "preview", "manifest.json"), "utf8")) as {
      lessonCount: number;
    };
    expect(manifest.lessonCount).toBe(5);

    await expect(readFile(path.join(root, "runs", "trial-full-plan", "artifacts", "authoring-context.v1.json"), "utf8")).resolves.toContain(
      "content-blueprint/v1"
    );

    const lessonTexts = await Promise.all(result.lessonPaths.map((lessonPath) => readFile(lessonPath, "utf8")));
    const joinedLessons = lessonTexts.join("\n");
    for (const marker of ["先修概念", "正式术语", "课堂讨论", "课后作业", "证据链", "局限边界"]) {
      expect(joinedLessons).toContain(marker);
    }
    expect(joinedLessons).not.toContain("本页围绕");
    expect(joinedLessons).not.toContain("课堂 slide");
    expect(joinedLessons).not.toContain("课堂材料需覆盖");
    expect(joinedLessons).not.toContain("focused unit");

    const lessons = lessonTexts.map((text) => JSON.parse(text) as { pages: Array<{ title: string; learningGoal: string; narrative: string }> });
    for (const page of lessons.flatMap((lesson) => lesson.pages)) {
      expect(page.title.length).toBeLessThanOrEqual(42);
      expect(page.learningGoal.length).toBeLessThanOrEqual(72);
    }
  });

  test("publishes paper trials as research-reading seminar lessons", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-authored-paper-trial-"));
    const sourcePath = path.join(root, "talker-reasoner.md");
    await writeFile(
      sourcePath,
      [
        "# Agents Thinking Fast and Slow",
        "The paper proposes a Talker-Reasoner architecture for language agents.",
        "The research question asks how to separate user-facing interaction from internal reasoning.",
        "The method mechanism splits a talker role from a reasoner role.",
        "Experiments and evaluation evidence compare reliability under tool feedback.",
        "Limitations and threats involve feedback quality and transfer to new tasks."
      ].join("\n"),
      "utf8"
    );

    const result = await new CodexAuthoredTrialService(root).runTrial({
      runId: "trial-paper-seminar",
      sourcePath,
      sourceKind: "paper",
      audience: "研究生",
      unitPages: 8
    });

    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") {
      return;
    }
    expect(result.qualityReport).toMatchObject({
      status: "passed",
      requiredFixCount: 0,
      optionalImprovementCount: 0
    });

    const lessonTexts = await Promise.all(result.lessonPaths.map((lessonPath) => readFile(lessonPath, "utf8")));
    const joinedLessons = lessonTexts.join("\n");
    for (const marker of ["研究问题", "论文贡献", "方法机制", "实验/证据", "局限边界", "迁移边界"]) {
      expect(joinedLessons).toContain(marker);
    }
    expect(joinedLessons).not.toContain("本页围绕");
    expect(joinedLessons).not.toContain("课堂 slide");
    expect(joinedLessons).not.toContain("课堂材料需覆盖");
  });

  test("publishes patent and blog trials with source-kind-specific teaching frames", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-authored-source-kind-trial-"));
    const patentPath = path.join(root, "cache-patent.md");
    const blogPath = path.join(root, "agent-blog.md");
    await writeFile(
      patentPath,
      [
        "# 缓存一致性专利",
        "权利要求1描述一种缓存一致性系统。",
        "现有技术问题是边缘节点缓存失效通知延迟。",
        "技术方案通过键映射和失效控制模块完成。",
        "实施例说明在移动网络中的处理流程。"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      blogPath,
      [
        "# Debugging Tool-Using Agents",
        "The practical problem is failed tool calls in production.",
        "The author solution combines tracing, retry policy, and rollout checks.",
        "Implementation path starts from observation capture.",
        "Caveats include missing observations and unsafe retries."
      ].join("\n"),
      "utf8"
    );

    const patentResult = await new CodexAuthoredTrialService(root).runTrial({
      runId: "trial-patent-depth",
      sourcePath: patentPath,
      sourceKind: "patent",
      audience: "技术产品经理",
      unitPages: 8
    });
    const blogResult = await new CodexAuthoredTrialService(root).runTrial({
      runId: "trial-blog-depth",
      sourcePath: blogPath,
      sourceKind: "blog",
      audience: "工程师",
      unitPages: 8
    });

    expect(patentResult.status).toBe("preview_ready");
    expect(blogResult.status).toBe("preview_ready");
    if (patentResult.status !== "preview_ready" || blogResult.status !== "preview_ready") {
      return;
    }
    expect(patentResult.qualityReport).toMatchObject({ status: "passed" });
    expect(blogResult.qualityReport).toMatchObject({ status: "passed" });

    const patentText = (await Promise.all(patentResult.lessonPaths.map((lessonPath) => readFile(lessonPath, "utf8")))).join("\n");
    const blogText = (await Promise.all(blogResult.lessonPaths.map((lessonPath) => readFile(lessonPath, "utf8")))).join("\n");
    for (const marker of ["权利要求边界", "现有技术问题", "技术方案/机制", "实施例", "法律/适用边界", "规避或迁移判断"]) {
      expect(patentText).toContain(marker);
    }
    for (const marker of ["实际问题", "作者方案", "实现路径", "caveat/失败模式", "可操作检查", "迁移边界"]) {
      expect(blogText).toContain(marker);
    }
    expect(`${patentText}\n${blogText}`).not.toContain("本页围绕");
    expect(`${patentText}\n${blogText}`).not.toContain("课堂 slide");
    expect(`${patentText}\n${blogText}`).not.toContain("课堂材料需覆盖");
  });
});
