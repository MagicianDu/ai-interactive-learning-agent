import { mkdtemp, writeFile } from "node:fs/promises";
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
