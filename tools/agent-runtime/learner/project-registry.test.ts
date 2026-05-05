import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { ProjectRegistry } from "./project-registry.js";

describe("ProjectRegistry", () => {
  test("lists learner projects with status and preview metadata", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-projects-"));
    const runDir = path.join(root, "runs", "agentic-book");
    await new ProjectRegistry(root).upsertProject({
      projectId: "agentic-book",
      title: "Agent Workflow Patterns",
      sourceKind: "book",
      sourceRefs: ["/tmp/book.pdf"],
      audience: "有编程基础的中文学习者",
      language: "zh-CN",
      strategy: "overview_plus_topic",
      unitPageCount: 8,
      status: "draft"
    });
    await writeFile(
      path.join(runDir, "learning-preview.json"),
      JSON.stringify({ status: "preview_ready", courseTitle: "Agent Workflow Patterns：课程包", lessonCount: 3 }, null, 2),
      "utf8"
    );

    const projects = await new ProjectRegistry(root).listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      projectId: "agentic-book",
      title: "Agent Workflow Patterns",
      sourceKind: "book",
      status: "preview-ready",
      preview: {
        courseTitle: "Agent Workflow Patterns：课程包",
        lessonCount: 3
      }
    });
  });

  test("reads and archives legacy learner-project manifests without dropping brief fields", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-projects-"));
    const runDir = path.join(root, "runs", "legacy-book");
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "learner-project.json"),
      JSON.stringify(
        {
          runId: "legacy-book",
          request: "请用 /tmp/book.pdf 生成中文课程。",
          brief: {
            topic: "旧书课程",
            sourcePath: "/tmp/book.pdf",
            sourceKind: "book",
            audience: "中文学习者",
            unitPages: 8,
            strategy: "chapter_guided",
            selectedChapters: ["第 1 章"],
            language: "zh-CN"
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const registry = new ProjectRegistry(root);

    await expect(registry.readProject("legacy-book")).resolves.toMatchObject({
      projectId: "legacy-book",
      title: "旧书课程",
      sourceKind: "book",
      sourceRefs: ["/tmp/book.pdf"],
      unitPageCount: 8,
      selectedChapters: ["第 1 章"],
      status: "draft"
    });

    const archived = await registry.archiveProject("legacy-book");
    const manifest = JSON.parse(await readFile(path.join(runDir, "learner-project.json"), "utf8")) as {
      request?: string;
      brief?: unknown;
      project?: { status: string };
    };

    expect(archived.status).toBe("archived");
    expect(manifest.request).toContain("/tmp/book.pdf");
    expect(manifest.brief).toBeDefined();
    expect(manifest.project?.status).toBe("archived");
  });
});
