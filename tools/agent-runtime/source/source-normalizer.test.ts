import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { normalizeSourceRecord, normalizeSources } from "./source-normalizer.js";
import type { SourceRecord } from "../corpus-types.js";

describe("source normalizer", () => {
  test("normalizes markdown text into heading anchors", async () => {
    const source: SourceRecord = {
      id: "source-001",
      type: "text",
      kind: "book",
      title: "Agentic Design Patterns",
      value: "# Overview\nAgents combine planning and tools.\n\n## Tool Use\nTools extend action space.",
      language: "zh-CN"
    };

    const normalized = await normalizeSourceRecord(source);

    expect(normalized.nodes.map((node) => node.id)).toContain("source-001:overview");
    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: "source-001:overview",
          locator: { kind: "heading", headingPath: ["Overview"] }
        }),
        expect.objectContaining({
          anchorId: "source-001:tool-use",
          locator: { kind: "heading", headingPath: ["Overview", "Tool Use"] }
        })
      ])
    );
    expect(normalized.extractionWarnings).toEqual([]);
  });

  test("adds paragraph anchors under heading-based text sources", async () => {
    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "text",
      kind: "book",
      title: "系统设计",
      value: "# 第一章 可控系统\n智能体系统需要中间产物。\n\n## 审核点\n审核点让错误更早暴露。",
      language: "zh-CN"
    });

    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: "source-001:paragraph-1",
          locator: { kind: "paragraph", paragraphId: "1" },
          quote: "智能体系统需要中间产物。"
        }),
        expect.objectContaining({
          anchorId: "source-001:paragraph-2",
          locator: { kind: "paragraph", paragraphId: "2" },
          quote: "审核点让错误更早暴露。"
        })
      ])
    );
  });

  test("extracts patent claim anchors from pasted patent text", async () => {
    const source: SourceRecord = {
      id: "source-001",
      type: "text",
      kind: "patent",
      title: "缓存系统专利",
      value: "说明书\n\n权利要求1：一种缓存系统，包括键映射模块。\n\n权利要求2：根据权利要求1所述的系统。",
      language: "zh-CN"
    };

    const normalized = await normalizeSourceRecord(source);

    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ anchorId: "source-001:claim-1", locator: { kind: "claim", claimNumber: "1" } }),
        expect.objectContaining({ anchorId: "source-001:claim-2", locator: { kind: "claim", claimNumber: "2" } })
      ])
    );
  });

  test("extracts paper section anchors from pasted paper text", async () => {
    const source: SourceRecord = {
      id: "source-001",
      type: "text",
      kind: "paper",
      title: "Retrieval Study",
      value: "Abstract\nWe study retrieval.\n\nMethod\nWe build an index.\n\nResults\nLatency improves.",
      language: "zh-CN"
    };

    const normalized = await normalizeSourceRecord(source);

    expect(normalized.anchors.map((anchor) => anchor.anchorId)).toEqual(
      expect.arrayContaining(["source-001:abstract", "source-001:method", "source-001:results"])
    );
  });

  test("extracts figures, tables, limitations, and references from paper text", async () => {
    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "text",
      kind: "paper",
      title: "Agent Evaluation",
      value: "Abstract\nWe evaluate agents.\n\nFigure 1: Agent loop.\n\nTable 2. Ablation results.\n\nLimitations\nSmall benchmark.\n\nReferences\n[1] Prior work.",
      language: "zh-CN"
    });

    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ anchorId: "source-001:figure-1", locator: { kind: "figure", figureNumber: "1" } }),
        expect.objectContaining({ anchorId: "source-001:table-2", locator: { kind: "table", tableNumber: "2" } }),
        expect.objectContaining({ anchorId: "source-001:limitations" }),
        expect.objectContaining({ anchorId: "source-001:references" })
      ])
    );
  });

  test("reads local markdown files and records source nodes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-source-"));
    const filePath = path.join(root, "notes.md");
    await writeFile(filePath, "# 第一章\n内容。\n\n## 第二节\n更多内容。", "utf8");

    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "file",
      kind: "notes",
      title: "notes",
      uri: filePath,
      value: filePath,
      language: "zh-CN"
    });

    expect(normalized.anchors.map((anchor) => anchor.anchorId)).toContain("source-001:di-yi-zhang");
    expect(normalized.extractionWarnings).toEqual([]);
  });

  test("expands folders into supported child source documents", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-folder-source-"));
    await mkdir(path.join(root, "notes"));
    await writeFile(path.join(root, "notes", "overview.md"), "# 总览\n资料拆成课程包。", "utf8");
    await writeFile(path.join(root, "blog.html"), "<h1>博客标题</h1><p>第一段。</p><h2>设计细节</h2><p>第二段。</p>", "utf8");
    await writeFile(path.join(root, "image.png"), "not text", "utf8");

    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "folder",
      kind: "mixed",
      title: "资料夹",
      uri: root,
      value: root,
      language: "zh-CN"
    });

    expect(normalized.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "source-001:root", children: expect.arrayContaining(["source-001-notes-overview-md:root", "source-001-blog-html:root"]) }),
        expect.objectContaining({ id: "source-001-notes-overview-md:zong-lan" }),
        expect.objectContaining({ id: "source-001-blog-html:bo-ke-biao-ti" }),
        expect.objectContaining({ id: "source-001-blog-html:she-ji-xi-jie" })
      ])
    );
    expect(normalized.extractionWarnings).toEqual([
      expect.objectContaining({ code: "unsupported-folder-file", severity: "warning" })
    ]);
  });

  test("extracts headings and paragraphs from local HTML files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-html-source-"));
    const filePath = path.join(root, "post.html");
    await writeFile(filePath, "<article><h1>RAG 工作流</h1><p>先检索再生成。</p><h2>评估</h2><p>检查引用。</p></article>", "utf8");

    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "file",
      kind: "blog",
      title: "RAG post",
      uri: filePath,
      value: filePath,
      language: "zh-CN"
    });

    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ anchorId: "source-001:rag-gong-zuo-liu" }),
        expect.objectContaining({ anchorId: "source-001:ping-gu" }),
        expect.objectContaining({ anchorId: "source-001:paragraph-1", quote: "先检索再生成。" }),
        expect.objectContaining({ anchorId: "source-001:paragraph-2", quote: "检查引用。" })
      ])
    );
  });

  test("fetches HTML URL sources into heading and paragraph anchors", async () => {
    const html = encodeURIComponent("<main><h1>文档标题</h1><p>第一段。</p><h2>操作步骤</h2><p>第二段。</p></main>");
    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "url",
      kind: "documentation",
      title: "在线文档",
      uri: `data:text/html,${html}`,
      value: `data:text/html,${html}`,
      language: "zh-CN"
    });

    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ anchorId: "source-001:wen-dang-biao-ti" }),
        expect.objectContaining({ anchorId: "source-001:cao-zuo-bu-zhou" }),
        expect.objectContaining({ anchorId: "source-001:paragraph-1", quote: "第一段。" }),
        expect.objectContaining({ anchorId: "source-001:paragraph-2", quote: "第二段。" })
      ])
    );
    expect(normalized.extractionWarnings).toEqual([]);
  });

  test("normalizes PDF sources with an explicit extraction warning", async () => {
    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "file",
      kind: "book",
      title: "Book",
      uri: "/tmp/book.pdf",
      value: "/tmp/book.pdf",
      language: "zh-CN"
    });

    expect(normalized.anchors).toEqual([
      expect.objectContaining({
        anchorId: "source-001:page-1",
        locator: { kind: "page", page: 1 }
      })
    ]);
    expect(normalized.extractionWarnings).toEqual([
      expect.objectContaining({
        code: "pdf-text-extraction-unavailable",
        severity: "warning"
      })
    ]);
  });

  test("normalizes multiple sources into a source-map payload", async () => {
    const result = await normalizeSources([
      {
        id: "source-001",
        type: "topic",
        kind: "unknown",
        title: "哈希表",
        value: "哈希表",
        language: "zh-CN"
      }
    ]);

    expect(result.structure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "source-001:root" }),
        expect.objectContaining({ id: "source-001:topic" })
      ])
    );
    expect(result.anchors).toEqual([
      expect.objectContaining({
        anchorId: "source-001:topic",
        locator: { kind: "heading", headingPath: ["哈希表"] }
      })
    ]);
    expect(result.extractionWarnings).toEqual([]);
  });
});
