import { isRecord } from "./validation-result.js";

export type SelfStudyTextbookRubricStatus = "passed" | "failed";

export type SelfStudyTextbookPageResult = {
  lessonId: string;
  pageId: string;
  status: SelfStudyTextbookRubricStatus;
  missingItems: string[];
  weakItems: string[];
};

export type SelfStudyTextbookRubricResult = {
  status: SelfStudyTextbookRubricStatus;
  requiredPageCount: number;
  satisfiedPageCount: number;
  failedPageCount: number;
  pageResults: SelfStudyTextbookPageResult[];
};

type BoardIssue = {
  kind: "missing" | "weak";
  item: string;
};

const forbiddenTeacherPhrases = [
  "本讲定位",
  "课堂讨论",
  "教授讲义",
  "课后作业",
  "教学目标",
  "教学设计",
  "识别本页中的作用",
  "这一页应该讲",
  "lecture purpose",
  "teaching move",
  "homework path"
];

const exampleEvidenceBoundaryPattern = /例子|例如|反例|证据|来源|边界|不适用|失败|局限|case|example|evidence|boundary/i;

export function evaluateSelfStudyTextbookRubric(lessons: unknown[]): SelfStudyTextbookRubricResult {
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

function evaluateLessonPages(lesson: unknown): SelfStudyTextbookPageResult[] {
  if (!isRecord(lesson) || !Array.isArray(lesson.pages)) {
    return [];
  }
  const lessonId = typeof lesson.id === "string" && lesson.id.trim().length > 0 ? lesson.id : "unknown-lesson";
  return lesson.pages.filter(isRecord).map((page, index) => evaluatePage(lessonId, page, index));
}

function evaluatePage(lessonId: string, page: Record<string, unknown>, index: number): SelfStudyTextbookPageResult {
  const pageId = typeof page.id === "string" && page.id.trim().length > 0 ? page.id : `page-${index + 1}`;
  const boardIssues = evaluateKnowledgeBoard(page.knowledgeBoard);
  const missingItems = boardIssues.filter((issue) => issue.kind === "missing").map((issue) => issue.item);
  const weakItems = boardIssues.filter((issue) => issue.kind === "weak").map((issue) => issue.item);

  return {
    lessonId,
    pageId,
    status: missingItems.length > 0 || weakItems.length > 0 ? "failed" : "passed",
    missingItems,
    weakItems
  };
}

function evaluateKnowledgeBoard(value: unknown): BoardIssue[] {
  if (!isRecord(value)) {
    return [{ kind: "missing", item: "knowledgeBoard" }];
  }

  const issues: BoardIssue[] = [];
  requireBoardText(value, "headline", issues, 1);
  requireBoardText(value, "coreProposition", issues, 24);
  requireBoardText(value, "bottomLine", issues, 12);
  requireBoardColumn(value, "leftColumn", issues);
  requireBoardColumn(value, "rightColumn", issues);
  requireSourceTrace(value, issues);

  const boardText = collectBoardText(value).join("\n");
  if (forbiddenTeacherPhrases.some((phrase) => boardText.includes(phrase))) {
    issues.push({ kind: "weak", item: "teacher-facing language" });
  }
  const rightColumnText = collectBoardText(value.rightColumn).join("\n");
  if (!exampleEvidenceBoundaryPattern.test(rightColumnText)) {
    issues.push({ kind: "weak", item: "example/evidence/boundary" });
  }
  if (boardText.trim().length < 160) {
    issues.push({ kind: "weak", item: "concrete explanation" });
  }
  if (boardText.length > 2200) {
    issues.push({ kind: "weak", item: "one-screen density" });
  }
  return issues;
}

function requireBoardText(
  board: Record<string, unknown>,
  field: "headline" | "coreProposition" | "bottomLine",
  issues: BoardIssue[],
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

function requireBoardColumn(board: Record<string, unknown>, field: "leftColumn" | "rightColumn", issues: BoardIssue[]): void {
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
    return label.length > 0 && items.length >= 2 && items.join("").trim().length >= 24;
  });
  if (validSections.length === 0) {
    issues.push({ kind: "missing", item: `knowledgeBoard.${field}.items` });
    return;
  }
  if (validSections.length < column.length) {
    issues.push({ kind: "weak", item: `knowledgeBoard.${field}.items` });
  }
}

function requireSourceTrace(board: Record<string, unknown>, issues: BoardIssue[]): void {
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
  } else if (validTraces.length < sourceTrace.length) {
    issues.push({ kind: "weak", item: "knowledgeBoard.sourceTrace" });
  }
}

function collectBoardText(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectBoardText);
  }
  if (!isRecord(value)) {
    return [];
  }
  return Object.values(value).flatMap(collectBoardText);
}
