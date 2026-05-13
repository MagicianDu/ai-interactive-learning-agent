import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";

import { describe, expect, test } from "vitest";

import { normalizeSourceRecord, normalizeSources } from "./source-normalizer.js";
import type { SourceRecord } from "../corpus-types.js";

describe("source normalizer", () => {
  test("normalizes markdown text into heading anchors", async () => {
    const source: SourceRecord = {
      id: "source-001",
      type: "text",
      kind: "book",
      title: "Agent Workflow Patterns",
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

  test("extracts page and paragraph anchors from readable PDF files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-pdf-source-"));
    const filePath = path.join(root, "book.pdf");
    await writeFile(filePath, minimalPdfWithText("Agentic loop uses tools and feedback."), "binary");

    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "file",
      kind: "book",
      title: "Book",
      uri: filePath,
      value: filePath,
      language: "zh-CN"
    });

    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: "source-001:page-1",
          locator: { kind: "page", page: 1 },
          quote: expect.stringContaining("Agentic loop")
        }),
        expect.objectContaining({
          anchorId: "source-001:paragraph-page-1-1",
          locator: { kind: "paragraph", paragraphId: "page-1-1" },
          quote: "Agentic loop uses tools and feedback."
        })
      ])
    );
    expect(normalized.extractionWarnings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "pdf-text-extraction-unavailable" })])
    );
  });

  test("extracts PDF table-of-contents chapter entries into chapter source nodes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-pdf-toc-source-"));
    const filePath = path.join(root, "book-with-toc.pdf");
    await writeFile(
      filePath,
      minimalPdfWithText(
        [
          "Table of Contents",
          "1. Chapter 1: Prompt Chaining (code), 12 pages",
          "2. Chapter 2: Routing (code), 13 pages",
          "3. Chapter 3: Parallelization (code), 15 pages",
          "5. Chapter 5: Tool Use (Function Calling) Tool Use Pattern Overview, 20 pages"
        ].join("\n")
      ),
      "binary"
    );

    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "file",
      kind: "book",
      title: "Agentic Design Patterns",
      uri: filePath,
      value: filePath,
      language: "zh-CN"
    });

    expect(normalized.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "chapter",
          title: "Chapter 1: Prompt Chaining",
          anchorIds: expect.arrayContaining(["source-001:chapter-1-prompt-chaining"])
        }),
        expect.objectContaining({
          type: "chapter",
          title: "Chapter 2: Routing",
          anchorIds: expect.arrayContaining(["source-001:chapter-2-routing"])
        }),
        expect.objectContaining({
          type: "chapter",
          title: "Chapter 3: Parallelization",
          anchorIds: expect.arrayContaining(["source-001:chapter-3-parallelization"])
        }),
        expect.objectContaining({
          type: "chapter",
          title: "Chapter 5: Tool Use (Function Calling)",
          anchorIds: expect.arrayContaining(["source-001:chapter-5-tool-use-function-calling"])
        })
      ])
    );
    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: "source-001:chapter-1-prompt-chaining",
          label: "Chapter 1: Prompt Chaining",
          locator: { kind: "heading", headingPath: ["Chapter 1: Prompt Chaining"] }
        }),
        expect.objectContaining({
          anchorId: "source-001:chapter-5-tool-use-function-calling",
          label: "Chapter 5: Tool Use (Function Calling)",
          locator: { kind: "heading", headingPath: ["Chapter 5: Tool Use (Function Calling)"] }
        })
      ])
    );
  });

  test("repairs wrapped PDF chapter headings before building chapter nodes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-pdf-wrapped-heading-"));
    const filePath = path.join(root, "wrapped-heading.pdf");
    await writeFile(
      filePath,
      minimalPdfWithText(["Chapter 12: Exception Handling and", "Recovery", "Agents must detect, handle, and recover from failures."].join("\n")),
      "binary"
    );

    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "file",
      kind: "book",
      title: "Agentic Design Patterns",
      uri: filePath,
      value: filePath,
      language: "zh-CN"
    });

    expect(normalized.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "chapter",
          title: "Chapter 12: Exception Handling and Recovery",
          anchorIds: expect.arrayContaining(["source-001:chapter-12-exception-handling-and-recovery"])
        })
      ])
    );
  });

  test("extracts readable text from compressed PDF streams through the Python extractor", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-compressed-pdf-source-"));
    const filePath = path.join(root, "compressed-book.pdf");
    await writeFile(filePath, compressedPdfWithText("Compressed PDF text requires pypdf extraction."), "binary");

    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "file",
      kind: "book",
      title: "Compressed Book",
      uri: filePath,
      value: filePath,
      language: "zh-CN"
    });

    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: "source-001:paragraph-page-1-1",
          quote: "Compressed PDF text requires pypdf extraction."
        })
      ])
    );
    expect(normalized.extractionWarnings).toEqual([]);
  });

  test("extracts compressed PDF text when the Python extractor is unavailable", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-compressed-pdf-no-python-"));
    const fakeBin = path.join(root, "bin");
    await mkdir(fakeBin);
    const fakePython = path.join(fakeBin, "python3");
    await writeFile(fakePython, "#!/bin/sh\nexit 127\n", "utf8");
    await chmod(fakePython, 0o755);

    const filePath = path.join(root, "compressed-book.pdf");
    await writeFile(filePath, compressedPdfWithText("Compressed PDF text still needs source anchors."), "binary");

    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeBin}${path.delimiter}${previousPath ?? ""}`;
    try {
      const normalized = await normalizeSourceRecord({
        id: "source-001",
        type: "file",
        kind: "book",
        title: "Compressed Book",
        uri: filePath,
        value: filePath,
        language: "zh-CN"
      });

      expect(normalized.anchors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            anchorId: "source-001:paragraph-page-1-1",
            quote: "Compressed PDF text still needs source anchors."
          })
        ])
      );
      expect(normalized.extractionWarnings).toEqual([]);
    } finally {
      process.env.PATH = previousPath;
    }
  });

  test("merges PDF line-fragment paragraphs into readable evidence anchors", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "learning-agent-fragmented-pdf-source-"));
    const filePath = path.join(root, "fragmented-book.pdf");
    await writeFile(filePath, compressedPdfWithText("The system will\n\ndefine\n\nour\n\ntomorrow through reliable agent loops."), "binary");

    const normalized = await normalizeSourceRecord({
      id: "source-001",
      type: "file",
      kind: "book",
      title: "Fragmented Book",
      uri: filePath,
      value: filePath,
      language: "zh-CN"
    });

    expect(normalized.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: "source-001:paragraph-page-1-1",
          quote: "The system will define our tomorrow through reliable agent loops."
        })
      ])
    );
    expect(normalized.anchors.filter((anchor) => anchor.locator.kind === "paragraph")).toHaveLength(1);
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

function minimalPdfWithText(text: string): string {
  const stream = `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  return pdfWithContentStream(stream);
}

function compressedPdfWithText(text: string): string {
  const stream = `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  const compressedStream = deflateSync(Buffer.from(stream, "binary")).toString("binary");
  return pdfWithContentStream(compressedStream, "/Filter /FlateDecode ");
}

function pdfWithContentStream(stream: string, streamOptions = ""): string {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< ${streamOptions}/Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function escapePdfText(value: string): string {
  return value.replace(/[\\()]/gu, "\\$&");
}
