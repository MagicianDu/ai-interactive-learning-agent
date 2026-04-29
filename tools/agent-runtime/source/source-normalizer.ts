import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  ExtractionWarning,
  NormalizedSourceDocument,
  SourceAnchor,
  SourceRecord,
  SourceStructureNode
} from "../corpus-types.js";
import { createSourceAnchor, slugify } from "./source-anchor.js";

export type NormalizedSources = {
  structure: SourceStructureNode[];
  anchors: SourceAnchor[];
  extractionWarnings: ExtractionWarning[];
};

export async function normalizeSources(sources: SourceRecord[]): Promise<NormalizedSources> {
  const normalized = await Promise.all(sources.map((source) => normalizeSourceRecord(source)));
  return {
    structure: normalized.flatMap((source) => source.nodes),
    anchors: normalized.flatMap((source) => source.anchors),
    extractionWarnings: normalized.flatMap((source) => source.extractionWarnings)
  };
}

export async function normalizeSourceRecord(source: SourceRecord): Promise<NormalizedSourceDocument> {
  if (source.type === "topic") {
    return normalizeTopicSource(source);
  }

  if (source.type === "text") {
    return normalizeTextSource(source, source.value ?? "");
  }

  if (source.type === "url") {
    return normalizeUrlSource(source);
  }

  if (source.type === "file") {
    return normalizeFileSource(source);
  }

  if (source.type === "folder") {
    return normalizeFolderSource(source);
  }

  return normalizeTopicSource(source);
}

function normalizeTopicSource(source: SourceRecord): NormalizedSourceDocument {
  const anchor = createSourceAnchor({
    sourceId: source.id,
    label: source.title,
    locator: { kind: "heading", headingPath: [source.title] },
    quote: source.value ?? source.title,
    notes: "Topic-only source anchor."
  });
  return buildDocument(source, [{ ...anchor, anchorId: `${source.id}:topic` }], [], []);
}

async function normalizeFileSource(source: SourceRecord): Promise<NormalizedSourceDocument> {
  const filePath = source.uri ?? source.value ?? "";
  const extension = path.extname(filePath).toLowerCase();

  if ([".txt", ".md", ".markdown"].includes(extension)) {
    try {
      return normalizeTextSource(source, await readFile(filePath, "utf8"));
    } catch {
      return buildDocument(source, [fileAnchor(source)], [], [
        {
          sourceId: source.id,
          code: "file-read-failed",
          message: `Could not read text file: ${filePath}`,
          severity: "warning"
        }
      ]);
    }
  }

  if (extension === ".pdf") {
    return buildDocument(source, [
      createSourceAnchor({
        sourceId: source.id,
        label: "Page 1",
        locator: { kind: "page", page: 1 },
        notes: "PDF placeholder anchor; full text extraction is not implemented in this slice."
      })
    ], [], [
      {
        sourceId: source.id,
        code: "pdf-text-extraction-unavailable",
        message: "PDF page-level placeholder anchor was created; full PDF text extraction remains future work.",
        severity: "warning"
      }
    ]);
  }

  return buildDocument(source, [fileAnchor(source)], [], [
    {
      sourceId: source.id,
      code: "unsupported-file-format",
      message: `No parser is available for ${extension || "this file"} yet.`,
      severity: "warning"
    }
  ]);
}

function normalizeFolderSource(source: SourceRecord): NormalizedSourceDocument {
  return buildDocument(source, [fileAnchor(source)], [], [
    {
      sourceId: source.id,
      code: "folder-expansion-unavailable",
      message: "Folder source expansion is not implemented in this slice.",
      severity: "warning"
    }
  ]);
}

function normalizeUrlSource(source: SourceRecord): NormalizedSourceDocument {
  const anchor = createSourceAnchor({
    sourceId: source.id,
    label: source.title,
    locator: { kind: "url_fragment", url: source.uri ?? source.value ?? source.title },
    notes: "URL content was not fetched by the local normalizer."
  });
  return buildDocument(source, [anchor], [], [
    {
      sourceId: source.id,
      code: "url-fetch-unavailable",
      message: "URL fetch and HTML extraction are not implemented in this slice.",
      severity: "warning"
    }
  ]);
}

function normalizeTextSource(source: SourceRecord, text: string): NormalizedSourceDocument {
  const anchors = extractTextAnchors(source, text);
  if (anchors.length > 0) {
    return buildDocument(source, anchors, [], []);
  }

  const paragraphAnchors = text
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) =>
      createSourceAnchor({
        sourceId: source.id,
        label: `Paragraph ${index + 1}`,
        locator: { kind: "paragraph", paragraphId: String(index + 1) },
        quote: paragraph.slice(0, 240)
      })
    );

  if (paragraphAnchors.length > 0) {
    return buildDocument(source, paragraphAnchors, [], []);
  }

  return buildDocument(source, [fileAnchor(source)], [], [
    {
      sourceId: source.id,
      code: "empty-text-source",
      message: "Text source was empty; only a document-level anchor was created.",
      severity: "warning"
    }
  ]);
}

function extractTextAnchors(source: SourceRecord, text: string): SourceAnchor[] {
  const anchors: SourceAnchor[] = [];
  const headingStack: string[] = [];

  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const markdownHeading = trimmed.match(/^(#{1,6})\s+(.+)$/u);
    if (markdownHeading) {
      const depth = markdownHeading[1]?.length ?? 1;
      const label = markdownHeading[2]?.trim() ?? trimmed;
      headingStack.splice(depth - 1);
      headingStack[depth - 1] = label;
      anchors.push(
        createSourceAnchor({
          sourceId: source.id,
          label,
          locator: { kind: "heading", headingPath: headingStack.filter(Boolean) },
          quote: label
        })
      );
      continue;
    }

    const claim = trimmed.match(/^(?:权利要求|Claim)\s*(\d+)[:：.\s]/iu);
    if (claim?.[1]) {
      anchors.push(
        createSourceAnchor({
          sourceId: source.id,
          label: `权利要求 ${claim[1]}`,
          locator: { kind: "claim", claimNumber: claim[1] },
          quote: trimmed.slice(0, 240)
        })
      );
      continue;
    }

    if (isPaperSectionHeading(trimmed)) {
      anchors.push(
        createSourceAnchor({
          sourceId: source.id,
          label: trimmed,
          locator: { kind: "heading", headingPath: [trimmed] },
          quote: trimmed
        })
      );
    }
  }

  return anchors;
}

function buildDocument(
  source: SourceRecord,
  anchors: SourceAnchor[],
  children: string[],
  extractionWarnings: ExtractionWarning[]
): NormalizedSourceDocument {
  const rootNode: SourceStructureNode = {
    id: `${source.id}:root`,
    sourceId: source.id,
    type: "document",
    title: source.title,
    anchorIds: anchors.map((anchor) => anchor.anchorId),
    children: children.length > 0 ? children : anchors.map((anchor) => anchor.anchorId)
  };
  const anchorNodes: SourceStructureNode[] = anchors.map((anchor) => ({
    id: anchor.anchorId,
    sourceId: source.id,
    type: nodeTypeForAnchor(anchor),
    title: anchor.label,
    anchorIds: [anchor.anchorId],
    children: []
  }));

  return {
    source,
    nodes: [rootNode, ...anchorNodes],
    anchors,
    extractionWarnings
  };
}

function fileAnchor(source: SourceRecord): SourceAnchor {
  return createSourceAnchor({
    sourceId: source.id,
    label: source.title,
    locator: { kind: "heading", headingPath: [source.title] },
    notes: "Document-level fallback anchor."
  });
}

function isPaperSectionHeading(value: string): boolean {
  return /^(abstract|introduction|method|methods|experiment|experiments|results|discussion|limitations|conclusion|摘要|引言|方法|实验|结果|讨论|局限|结论)$/iu.test(
    value
  );
}

function nodeTypeForAnchor(anchor: SourceAnchor): SourceStructureNode["type"] {
  if (anchor.locator.kind === "claim") {
    return "claim";
  }
  if (anchor.locator.kind === "paragraph") {
    return "paragraph";
  }
  if (anchor.locator.kind === "figure") {
    return "figure";
  }
  if (anchor.locator.kind === "table") {
    return "table";
  }
  if (anchor.locator.kind === "url_fragment") {
    return "url";
  }
  const slug = slugify(anchor.label);
  if (/chapter|zhang|第/u.test(slug)) {
    return "chapter";
  }
  return "section";
}
