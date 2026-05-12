import { isRecord } from "./validation-result.js";

export type KnowledgeBoardRubricStatus = "passed" | "failed";

export type KnowledgeBoardPageResult = {
  lessonId: string;
  pageId: string;
  status: KnowledgeBoardRubricStatus;
  missingItems: string[];
  weakItems: string[];
};

export type KnowledgeBoardRubricResult = {
  status: KnowledgeBoardRubricStatus;
  requiredPageCount: number;
  satisfiedPageCount: number;
  failedPageCount: number;
  pageResults: KnowledgeBoardPageResult[];
};

type BoardFieldIssue = {
  kind: "missing" | "weak";
  item: string;
};

const knowledgeBoardKinds = new Set([
  "definition_board",
  "mechanism_board",
  "evidence_board",
  "example_board",
  "comparison_board",
  "boundary_board",
  "synthesis_board"
]);

export function evaluateKnowledgeBoardRubric(lessons: unknown[]): KnowledgeBoardRubricResult {
  const pageResults = lessons.flatMap((lesson) => evaluateLessonPages(lesson));
  const failedPageCount = pageResults.filter((page) => page.status === "failed").length;

  return {
    status: failedPageCount > 0 ? "failed" : "passed",
    requiredPageCount: pageResults.length,
    satisfiedPageCount: pageResults.length - failedPageCount,
    failedPageCount,
    pageResults
  };
}

function evaluateLessonPages(lesson: unknown): KnowledgeBoardPageResult[] {
  if (!isRecord(lesson) || !Array.isArray(lesson.pages)) {
    return [];
  }
  const lessonId = typeof lesson.id === "string" && lesson.id.trim().length > 0 ? lesson.id : "unknown-lesson";
  return lesson.pages.filter(isRecord).map((page, index) => evaluatePage(lessonId, page, index));
}

function evaluatePage(lessonId: string, page: Record<string, unknown>, index: number): KnowledgeBoardPageResult {
  const pageId = typeof page.id === "string" && page.id.trim().length > 0 ? page.id : `page-${index + 1}`;
  const pageSourceAnchorIds = Array.isArray(page.sourceAnchorIds) ? page.sourceAnchorIds.filter((anchorId) => typeof anchorId === "string") : [];
  const fieldIssues = evaluateKnowledgeBoard(page.knowledgeBoard, pageSourceAnchorIds);
  const missingItems = fieldIssues.filter((issue) => issue.kind === "missing").map((issue) => issue.item);
  const weakItems = fieldIssues.filter((issue) => issue.kind === "weak").map((issue) => issue.item);

  return {
    lessonId,
    pageId,
    status: missingItems.length > 0 || weakItems.length > 0 ? "failed" : "passed",
    missingItems,
    weakItems
  };
}

function evaluateKnowledgeBoard(value: unknown, pageSourceAnchorIds: string[]): BoardFieldIssue[] {
  if (!isRecord(value)) {
    return [{ kind: "missing", item: "knowledgeBoard" }];
  }

  const issues: BoardFieldIssue[] = [];
  requireBoardKind(value, issues);
  requireBoardText(value, "headline", issues, 1);
  requireBoardText(value, "coreProposition", issues, 12);
  requireBoardText(value, "bottomLine", issues, 8);
  requireBoardColumn(value, "leftColumn", issues);
  requireBoardColumn(value, "rightColumn", issues);
  requireSourceTrace(value, pageSourceAnchorIds, issues);
  return issues;
}

function requireBoardKind(board: Record<string, unknown>, issues: BoardFieldIssue[]): void {
  const value = board.boardKind;
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ kind: "missing", item: "knowledgeBoard.boardKind" });
    return;
  }
  if (!knowledgeBoardKinds.has(value.trim())) {
    issues.push({ kind: "weak", item: "knowledgeBoard.boardKind" });
  }
}

function requireBoardText(
  board: Record<string, unknown>,
  field: "headline" | "coreProposition" | "bottomLine",
  issues: BoardFieldIssue[],
  minimumLength: number
): void {
  const value = board[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ kind: "missing", item: `knowledgeBoard.${field}` });
    return;
  }
  if (value.trim().length < minimumLength) {
    issues.push({ kind: "weak", item: `knowledgeBoard.${field}` });
  }
}

function requireBoardColumn(
  board: Record<string, unknown>,
  field: "leftColumn" | "rightColumn",
  issues: BoardFieldIssue[]
): void {
  const column = board[field];
  if (!Array.isArray(column) || column.length === 0) {
    issues.push({ kind: "missing", item: `knowledgeBoard.${field}` });
    return;
  }
  const validSections = column.filter((section) => {
    if (!isRecord(section)) {
      return false;
    }
    const label = typeof section.label === "string" ? section.label.trim() : "";
    const items = Array.isArray(section.items) ? section.items.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
    return label.length > 0 && items.length >= 2 && items.join("").trim().length >= 12;
  });
  if (validSections.length === 0) {
    issues.push({ kind: "missing", item: `knowledgeBoard.${field}.items` });
    return;
  }
  if (validSections.length < column.length) {
    issues.push({ kind: "weak", item: `knowledgeBoard.${field}.items` });
  }
}

function requireSourceTrace(board: Record<string, unknown>, pageSourceAnchorIds: string[], issues: BoardFieldIssue[]): void {
  const sourceTrace = board.sourceTrace;
  if (!Array.isArray(sourceTrace) || sourceTrace.length === 0) {
    issues.push({ kind: "missing", item: "knowledgeBoard.sourceTrace" });
    return;
  }
  const validTraces = sourceTrace.filter((trace) => {
    if (!isRecord(trace)) {
      return false;
    }
    const anchorId = typeof trace.anchorId === "string" ? trace.anchorId.trim() : "";
    const supports = typeof trace.supports === "string" ? trace.supports.trim() : "";
    return anchorId.length > 0 && supports.length > 0;
  });
  if (validTraces.length === 0) {
    issues.push({ kind: "missing", item: "knowledgeBoard.sourceTrace" });
    return;
  }
  const traceAnchorIds = validTraces
    .map((trace) => (isRecord(trace) && typeof trace.anchorId === "string" ? trace.anchorId.trim() : ""))
    .filter((anchorId) => anchorId.length > 0);
  const alignedToPageAnchor = pageSourceAnchorIds.length === 0 || traceAnchorIds.some((anchorId) => pageSourceAnchorIds.includes(anchorId));
  if (validTraces.length < sourceTrace.length || !alignedToPageAnchor) {
    issues.push({ kind: "weak", item: "knowledgeBoard.sourceTrace" });
  }
}
