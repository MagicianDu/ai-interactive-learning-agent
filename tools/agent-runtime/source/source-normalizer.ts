import { execFile as execFileCallback } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";

import type {
  ExtractionWarning,
  NormalizedSourceDocument,
  SourceAnchor,
  SourceRecord,
  SourceStructureNode
} from "../corpus-types.js";
import { createSourceAnchor, slugify } from "./source-anchor.js";

const execFile = promisify(execFileCallback);
const pdfExtractionTimeoutMs = 15000;
const pdfExtractionMaxBuffer = 20 * 1024 * 1024;

type PdfTextPage = {
  page: number;
  text: string;
};

type PdfChapterHeading = {
  title: string;
  page: number;
  anchorId: string;
  source: "page-heading" | "toc";
};

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

  if ([".html", ".htm"].includes(extension)) {
    try {
      return normalizeTextSource(source, htmlToPlainText(await readFile(filePath, "utf8")));
    } catch {
      return buildDocument(source, [fileAnchor(source)], [], [
        {
          sourceId: source.id,
          code: "file-read-failed",
          message: `Could not read HTML file: ${filePath}`,
          severity: "warning"
        }
      ]);
    }
  }

  if (extension === ".pdf") {
    const pages = await extractPdfTextPages(filePath);
    if (pages.some((page) => page.text.trim().length > 0)) {
      return normalizePdfSource(source, pages);
    }

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

function normalizePdfSource(source: SourceRecord, pages: PdfTextPage[]): NormalizedSourceDocument {
  const anchors: SourceAnchor[] = [];
  const anchorPages = new Map<string, number>();
  const chapterHeadings: PdfChapterHeading[] = [];
  const chapterKeys = new Set<string>();

  const addAnchor = (anchor: SourceAnchor, pageNumber?: number) => {
    if (anchors.some((existing) => existing.anchorId === anchor.anchorId)) {
      return;
    }
    anchors.push(anchor);
    if (typeof pageNumber === "number") {
      anchorPages.set(anchor.anchorId, pageNumber);
    }
  };

  for (const page of pages) {
    const cleanedPageText = normalizeExtractedText(page.text);
    if (!cleanedPageText) {
      continue;
    }

    for (const title of detectPdfPageChapterHeadings(cleanedPageText)) {
      const headingAnchor = createSourceAnchor({
        sourceId: source.id,
        label: title,
        locator: { kind: "heading", headingPath: [title] },
        quote: cleanedPageText.slice(0, 240),
        notes: `Detected PDF chapter heading on page ${page.page}.`
      });
      addAnchor(headingAnchor, page.page);
      const key = chapterKey(title);
      if (!chapterKeys.has(key)) {
        chapterHeadings.push({ title, page: page.page, anchorId: headingAnchor.anchorId, source: "page-heading" });
        chapterKeys.add(key);
      }
    }

    addAnchor(
      createSourceAnchor({
        sourceId: source.id,
        label: `Page ${page.page}`,
        locator: { kind: "page", page: page.page },
        quote: cleanedPageText.slice(0, 240),
        notes: "Extracted from PDF text."
      }),
      page.page
    );

    splitPdfParagraphs(cleanedPageText).forEach((paragraph, index) => {
      addAnchor(
        createSourceAnchor({
          sourceId: source.id,
          label: `Page ${page.page} Paragraph ${index + 1}`,
          locator: { kind: "paragraph", paragraphId: `page-${page.page}-${index + 1}` },
          quote: paragraph.slice(0, 240),
          notes: `Extracted from PDF page ${page.page}.`
        }),
        page.page
      );
    });
  }

  for (const entry of detectPdfTocChapterEntries(pages)) {
    const key = chapterKey(entry.title);
    if (chapterKeys.has(key)) {
      continue;
    }
    const headingAnchor = createSourceAnchor({
      sourceId: source.id,
      label: entry.title,
      locator: { kind: "heading", headingPath: [entry.title] },
      quote: entry.title,
      notes: `Detected PDF table-of-contents entry on page ${entry.page}.`
    });
    addAnchor(headingAnchor, entry.page);
    chapterHeadings.push({ title: entry.title, page: entry.page, anchorId: headingAnchor.anchorId, source: "toc" });
    chapterKeys.add(key);
  }

  return chapterHeadings.length > 0 ? buildPdfDocument(source, anchors, chapterHeadings, anchorPages) : buildDocument(source, anchors, [], []);
}

async function extractPdfTextPages(filePath: string): Promise<PdfTextPage[]> {
  const pythonPages = await extractPdfTextWithPython(filePath);
  if (pythonPages.some((page) => page.text.trim().length > 0)) {
    return pythonPages;
  }

  return extractPdfTextWithLiteralFallback(filePath);
}

async function extractPdfTextWithPython(filePath: string): Promise<PdfTextPage[]> {
  const script = [
    "import json, sys",
    "from pypdf import PdfReader",
    "reader = PdfReader(sys.argv[1])",
    "pages = []",
    "for index, page in enumerate(reader.pages):",
    "    text = (page.extract_text() or '').strip()",
    "    pages.append({'page': index + 1, 'text': text[:2000]})",
    "print(json.dumps(pages, ensure_ascii=False))"
  ].join("\n");

  try {
    const { stdout } = await execFile("python3", ["-c", script, filePath], {
      timeout: pdfExtractionTimeoutMs,
      maxBuffer: pdfExtractionMaxBuffer
    });
    const parsed = JSON.parse(stdout) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      if (!isRecord(item) || typeof item.page !== "number" || typeof item.text !== "string") {
        return [];
      }
      if (!isReadableExtractedText(item.text)) {
        return [];
      }
      return [{ page: item.page, text: item.text }];
    });
  } catch {
    return [];
  }
}

async function extractPdfTextWithLiteralFallback(filePath: string): Promise<PdfTextPage[]> {
  let rawPdf: string;
  try {
    rawPdf = await readFile(filePath, "binary");
  } catch {
    return [];
  }

  const literals = extractPdfLiteralText(rawPdf);
  const text = normalizeExtractedText(literals.join("\n"));
  return isReadableExtractedText(text) ? [{ page: 1, text }] : [];
}

function extractPdfLiteralText(rawPdf: string): string[] {
  const streams = [...rawPdf.matchAll(/<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/gu)];
  if (streams.length === 0) {
    return extractPdfTextOperators(rawPdf);
  }

  return streams.flatMap((match) => {
    const dictionary = match[1] ?? "";
    const streamBody = match[2] ?? "";
    if (/\/Filter\s*\/FlateDecode/u.test(dictionary)) {
      try {
        return extractPdfTextOperators(inflateSync(Buffer.from(streamBody, "binary")).toString("binary"));
      } catch {
        return [];
      }
    }
    return extractPdfTextOperators(streamBody);
  });
}

function extractPdfTextOperators(pdfContent: string): string[] {
  return [...pdfContent.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/gu)].map((match) => decodePdfLiteral(match[1] ?? ""));
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/gu, "\n")
    .replace(/\\r/gu, "\n")
    .replace(/\\t/gu, "\t")
    .replace(/\\\(/gu, "(")
    .replace(/\\\)/gu, ")")
    .replace(/\\\\/gu, "\\");
}

function normalizeExtractedText(value: string): string {
  return value
    .split("\u0000")
    .join("")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function splitPdfParagraphs(text: string): string[] {
  const paragraphBlocks = text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  const mergedParagraphs: string[] = [];
  for (const paragraph of paragraphBlocks) {
    const previous = mergedParagraphs.at(-1);
    if (previous && shouldMergePdfParagraphFragment(previous, paragraph)) {
      mergedParagraphs[mergedParagraphs.length - 1] = `${previous} ${paragraph}`.replace(/\s+/gu, " ").trim();
      continue;
    }
    mergedParagraphs.push(paragraph);
  }
  return mergedParagraphs.length > 0 ? mergedParagraphs : [text];
}

function shouldMergePdfParagraphFragment(previous: string, current: string): boolean {
  const previousLooksOpen = !/[.!?。！？]$/u.test(previous) && previous.length < 320;
  const currentLooksLikeFragment = current.length < 48 || /^[a-z,;:)\]}]/u.test(current);
  return previousLooksOpen || currentLooksLikeFragment;
}

function detectPdfPageChapterHeadings(text: string): string[] {
  const lines = text
    .split(/\n+/u)
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
  const headings: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = mergeWrappedChapterHeadingLine(lines[index] ?? "", lines[index + 1] ?? "");
    const title = normalizeChapterTitle(/^(?:\d+\.\s*)?(Chapter\s+\d+\s*:\s*[^,;\n]{2,120})/iu.exec(line)?.[1] ?? "");
    if (title) {
      headings.push(title);
      break;
    }
  }
  return headings;
}

function mergeWrappedChapterHeadingLine(currentLine: string, nextLine: string): string {
  if (!/^(?:\d+\.\s*)?Chapter\s+\d+\s*:/iu.test(currentLine)) {
    return currentLine;
  }
  const trimmedNextLine = nextLine.trim();
  const currentEndsWithConnector = /\b(?:and|or|of|for|to|with|in|on|the)\s*$/iu.test(currentLine);
  const nextLooksLikeTitleFragment =
    trimmedNextLine.length > 0 && trimmedNextLine.length <= 60 && !/[.!?。！？]$/u.test(trimmedNextLine) && trimmedNextLine.split(/\s+/u).length <= 6;
  return currentEndsWithConnector && nextLooksLikeTitleFragment ? `${currentLine} ${trimmedNextLine}` : currentLine;
}

function detectPdfTocChapterEntries(pages: PdfTextPage[]): Array<{ title: string; page: number }> {
  const entries: Array<{ title: string; page: number }> = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const text = normalizeExtractedText(page.text);
    if (!/\b(?:table\s+of\s+contents|contents)\b/iu.test(text.slice(0, 1200))) {
      continue;
    }
    const matches = text.matchAll(/(?:^|\s)(?:\d+\.\s*)?(Chapter\s+\d+\s*:\s*[^,\n]{2,120})/giu);
    for (const match of matches) {
      const title = normalizeChapterTitle(match[1] ?? "");
      if (!title || seen.has(title)) {
        continue;
      }
      entries.push({ title, page: page.page });
      seen.add(title);
    }
  }
  return entries;
}

function normalizeChapterTitle(value: string): string {
  const title = value
    .replace(/\s*\(code\)\s*/giu, "")
    .replace(/\s*\[[^\]]+\]\s*/gu, "")
    .replace(/\s+\d+\s+pages?.*$/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.,;:，；：]+$/u, "")
    .trim();
  const overview = /^(Chapter\s+\d+\s*:\s*)(.+?)\s+Pattern\s+Overview\b.*$/iu.exec(title);
  if (overview?.[1] && overview[2]) {
    return `${overview[1]}${dedupeRepeatedTitleStem(overview[2])}`.trim();
  }
  return dedupeRepeatedChapterTitle(title);
}

function dedupeRepeatedChapterTitle(title: string): string {
  const match = /^(Chapter\s+\d+\s*:\s*)(.+)$/iu.exec(title);
  if (!match?.[1] || !match[2]) {
    return title;
  }
  return `${match[1]}${dedupeRepeatedTitleStem(match[2])}`.trim();
}

function dedupeRepeatedTitleStem(value: string): string {
  const trimmed = value.trim();
  const parentheticalWithRepeatedSuffix = /^(.+\([^)]*\))\s+(.+)$/u.exec(trimmed);
  if (parentheticalWithRepeatedSuffix?.[1] && parentheticalWithRepeatedSuffix[2]) {
    const titleWithoutParenthetical = parentheticalWithRepeatedSuffix[1].replace(/\s*\([^)]*\)\s*$/u, "").trim();
    const repeatedSuffix = parentheticalWithRepeatedSuffix[2].trim();
    if (sameTitleWords(titleWithoutParenthetical, repeatedSuffix)) {
      return parentheticalWithRepeatedSuffix[1].trim();
    }
  }
  const words = trimmed.split(/\s+/u).filter(Boolean);
  if (words.length >= 2 && words.length % 2 === 0) {
    const mid = words.length / 2;
    if (sameTitleWords(words.slice(0, mid).join(" "), words.slice(mid).join(" "))) {
      return words.slice(0, mid).join(" ");
    }
  }
  return trimmed;
}

function sameTitleWords(left: string, right: string): boolean {
  return left.replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase() === right.replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
}

function chapterKey(title: string): string {
  const chapterNumber = /chapter\s+(?<chapter>\d+)/iu.exec(title)?.groups?.chapter;
  return chapterNumber ? `chapter-${chapterNumber}` : title.toLowerCase();
}

function buildPdfDocument(
  source: SourceRecord,
  anchors: SourceAnchor[],
  chapterHeadings: PdfChapterHeading[],
  anchorPages: Map<string, number>
): NormalizedSourceDocument {
  const sortedChapters = [...chapterHeadings].sort((left, right) => left.page - right.page || left.title.localeCompare(right.title));
  const chapterNodes: SourceStructureNode[] = sortedChapters.map((chapter, index) => {
    const nextChapter = sortedChapters[index + 1];
    const chapterAnchorIds = anchors
      .filter((anchor) => {
        if (anchor.anchorId === chapter.anchorId) {
          return true;
        }
        const page = anchorPages.get(anchor.anchorId);
        if (typeof page !== "number" || chapter.source === "toc") {
          return false;
        }
        return page >= chapter.page && (!nextChapter || page < nextChapter.page);
      })
      .map((anchor) => anchor.anchorId);
    return {
      id: `${source.id}:chapter-node-${slugify(chapter.title)}`,
      sourceId: source.id,
      type: "chapter",
      title: chapter.title,
      anchorIds: chapterAnchorIds.length > 0 ? chapterAnchorIds : [chapter.anchorId],
      children: []
    };
  });
  const rootNode: SourceStructureNode = {
    id: `${source.id}:root`,
    sourceId: source.id,
    type: "document",
    title: source.title,
    anchorIds: anchors.map((anchor) => anchor.anchorId),
    children: chapterNodes.map((node) => node.id)
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
    nodes: [rootNode, ...chapterNodes, ...anchorNodes],
    anchors,
    extractionWarnings: []
  };
}

function isReadableExtractedText(value: string): boolean {
  const normalized = normalizeExtractedText(value);
  if (normalized.length < 12) {
    return false;
  }

  const visibleChars = Array.from(normalized).filter((char) => !/\s/u.test(char));
  if (visibleChars.length === 0) {
    return false;
  }

  const readableChars = visibleChars.filter(isReadableTextChar);
  return readableChars.length / visibleChars.length >= 0.7;
}

function isReadableTextChar(char: string): boolean {
  return /[A-Za-z0-9\u3400-\u9fff]/u.test(char) || ".,;:!?\"'()[]{}<>/@#%&+=_*|\\-".includes(char);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function normalizeFolderSource(source: SourceRecord): Promise<NormalizedSourceDocument> {
  const folderPath = source.uri ?? source.value ?? "";
  let files: Array<{ filePath: string; relativePath: string }>;
  try {
    files = await collectFolderFiles(folderPath);
  } catch {
    return buildDocument(source, [fileAnchor(source)], [], [
      {
        sourceId: source.id,
        code: "folder-read-failed",
        message: `Could not read folder: ${folderPath}`,
        severity: "warning"
      }
    ]);
  }

  const childDocuments: NormalizedSourceDocument[] = [];
  const extractionWarnings: ExtractionWarning[] = [];

  for (const file of files) {
    const extension = path.extname(file.filePath).toLowerCase();
    if (!isSupportedFolderFile(extension)) {
      extractionWarnings.push({
        sourceId: source.id,
        code: "unsupported-folder-file",
        message: `Skipped unsupported folder file: ${file.relativePath}`,
        severity: "warning"
      });
      continue;
    }

    const childSource: SourceRecord = {
      ...source,
      id: `${source.id}-${slugify(file.relativePath)}`,
      type: "file",
      title: file.relativePath,
      uri: file.filePath,
      value: file.filePath,
      metadata: {
        ...(source.metadata ?? {}),
        parentSourceId: source.id,
        relativePath: file.relativePath
      }
    };
    childDocuments.push(await normalizeFileSource(childSource));
  }

  const childRootIds = childDocuments
    .map((document) => document.nodes.find((node) => node.id.endsWith(":root"))?.id)
    .filter((id): id is string => Boolean(id));
  const anchors = childDocuments.flatMap((document) => document.anchors);
  const rootNode: SourceStructureNode = {
    id: `${source.id}:root`,
    sourceId: source.id,
    type: "document",
    title: source.title,
    anchorIds: anchors.map((anchor) => anchor.anchorId),
    children: childRootIds
  };

  if (childDocuments.length === 0) {
    extractionWarnings.push({
      sourceId: source.id,
      code: "folder-no-supported-files",
      message: `No supported text, markdown, HTML, or PDF files were found in folder: ${folderPath}`,
      severity: "warning"
    });
  }

  return {
    source,
    nodes: [rootNode, ...childDocuments.flatMap((document) => document.nodes)],
    anchors,
    extractionWarnings: [...extractionWarnings, ...childDocuments.flatMap((document) => document.extractionWarnings)]
  };
}

async function normalizeUrlSource(source: SourceRecord): Promise<NormalizedSourceDocument> {
  const url = source.uri ?? source.value ?? source.title;
  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get("content-type") ?? source.contentType ?? "";
    const body = await response.text();
    if (/html|xml/u.test(contentType) || /<h[1-6]|<p[\s>]/iu.test(body)) {
      return normalizeTextSource(source, htmlToPlainText(body));
    }
    return normalizeTextSource(source, body);
  } catch {
    const anchor = createSourceAnchor({
      sourceId: source.id,
      label: source.title,
      locator: { kind: "url_fragment", url },
      notes: "URL content could not be fetched by the local normalizer."
    });
    return buildDocument(source, [anchor], [], [
      {
        sourceId: source.id,
        code: "url-fetch-failed",
        message: `Could not fetch URL content: ${url}`,
        severity: "warning"
      }
    ]);
  }
}

function normalizeTextSource(source: SourceRecord, text: string): NormalizedSourceDocument {
  const anchors = extractTextAnchors(source, text);
  if (anchors.length > 0) {
    return buildDocument(source, anchors, [], []);
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
  let paragraphCount = 0;

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

    const figure = trimmed.match(/^(?:Figure|Fig\.?|图|附图)\s*(\d+)[:：.\s]/iu);
    if (figure?.[1]) {
      anchors.push(
        createSourceAnchor({
          sourceId: source.id,
          label: `Figure ${figure[1]}`,
          locator: { kind: "figure", figureNumber: figure[1] },
          quote: trimmed.slice(0, 240)
        })
      );
      continue;
    }

    const table = trimmed.match(/^(?:Table|表)\s*(\d+)[:：.\s]/iu);
    if (table?.[1]) {
      anchors.push(
        createSourceAnchor({
          sourceId: source.id,
          label: `Table ${table[1]}`,
          locator: { kind: "table", tableNumber: table[1] },
          quote: trimmed.slice(0, 240)
        })
      );
      continue;
    }

    if (isSectionHeading(trimmed)) {
      anchors.push(
        createSourceAnchor({
          sourceId: source.id,
          label: trimmed,
          locator: { kind: "heading", headingPath: [trimmed] },
          quote: trimmed
        })
      );
      continue;
    }

    paragraphCount += 1;
    anchors.push(
      createSourceAnchor({
        sourceId: source.id,
        label: `Paragraph ${paragraphCount}`,
        locator: { kind: "paragraph", paragraphId: String(paragraphCount) },
        quote: trimmed.slice(0, 240)
      })
    );
  }

  return anchors;
}

async function collectFolderFiles(folderPath: string, currentPath = folderPath): Promise<Array<{ filePath: string; relativePath: string }>> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const files: Array<{ filePath: string; relativePath: string }> = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFolderFiles(folderPath, entryPath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    files.push({
      filePath: entryPath,
      relativePath: path.relative(folderPath, entryPath).split(path.sep).join("/")
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isSupportedFolderFile(extension: string): boolean {
  return [".txt", ".md", ".markdown", ".html", ".htm", ".pdf"].includes(extension);
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/giu, "\n")
      .replace(/<style[\s\S]*?<\/style>/giu, "\n")
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/giu, "\n# $1\n")
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/giu, "\n## $1\n")
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/giu, "\n### $1\n")
      .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/giu, "\n#### $1\n")
      .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/giu, "\n##### $1\n")
      .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/giu, "\n###### $1\n")
      .replace(/<\/(?:p|li|div|section|article)>/giu, "\n")
      .replace(/<br\s*\/?>/giu, "\n")
      .replace(/<[^>]+>/gu, "")
      .replace(/[ \t]+\n/gu, "\n")
      .replace(/\n{3,}/gu, "\n\n")
      .trim()
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`URL returned HTTP ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
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

function isSectionHeading(value: string): boolean {
  return /^(abstract|introduction|method|methods|experiment|experiments|results|discussion|limitations|references|conclusion|摘要|引言|方法|实验|结果|讨论|局限|参考文献|结论|背景技术|现有技术|具体实施方式|实施例\s*\d*)$/iu.test(
    value
  ) || /^(?:chapter\s+\d+|第\s*[一二三四五六七八九十\d]+\s*[章节部篇].*)$/iu.test(value);
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
