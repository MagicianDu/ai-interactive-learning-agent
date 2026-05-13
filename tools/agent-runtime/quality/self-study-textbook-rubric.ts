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

type LessonPageRecord = {
  lessonId: string;
  pageId: string;
  page: Record<string, unknown>;
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

const scaffoldTitleRoles = new Set([
  "先看失败",
  "直观模型",
  "结构与术语",
  "机制链路",
  "何时使用",
  "来源证据",
  "误区边界",
  "最小接口",
  "自检判断",
  "迁移总结",
  "学习问题",
  "结构板书",
  "关键链路"
]);

const authoringScaffoldPatterns = [
  /本页围绕.+讲一个可自学知识片段/u,
  /本页从.+入手，把来源命题改写为学生可以直接使用的判断结构/u,
  /把来源命题改写为学生可以直接使用/u,
  /来源锚点.+用来约束本页结论/u,
  /：为什么(?:先看失败|直观模型|结构与术语|机制链路|何时使用|来源证据|误区边界|最小接口|自检判断|迁移总结)/u
];

const exampleEvidenceBoundaryPattern = /例子|例如|反例|证据|来源|边界|不适用|失败|局限|case|example|evidence|boundary/i;

export function evaluateSelfStudyTextbookRubric(lessons: unknown[]): SelfStudyTextbookRubricResult {
  const pageRecords = lessons.flatMap(collectLessonPageRecords);
  const repeatedPageRoleTitleIds = findRepeatedPageRoleTitleIds(pageRecords);
  const pageResults = lessons.flatMap((lesson) => evaluateLessonPages(lesson, repeatedPageRoleTitleIds));
  const failedPageCount = pageResults.filter((page) => page.status === "failed").length;

  return {
    status: failedPageCount > 0 ? "failed" : "passed",
    requiredPageCount: pageResults.length,
    satisfiedPageCount: pageResults.length - failedPageCount,
    failedPageCount,
    pageResults
  };
}

function collectLessonPageRecords(lesson: unknown): LessonPageRecord[] {
  if (!isRecord(lesson) || !Array.isArray(lesson.pages)) {
    return [];
  }
  const lessonId = typeof lesson.id === "string" && lesson.id.trim().length > 0 ? lesson.id : "unknown-lesson";
  return lesson.pages.filter(isRecord).map((page, index) => ({
    page,
    lessonId,
    pageId: typeof page.id === "string" && page.id.trim().length > 0 ? page.id : `page-${index + 1}`
  }));
}

function evaluateLessonPages(lesson: unknown, repeatedPageRoleTitleIds: Set<string>): SelfStudyTextbookPageResult[] {
  const pages = collectLessonPageRecords(lesson);
  if (pages.length === 0) {
    return [];
  }
  const lessonId = pages[0]!.lessonId;
  const repeatedBoardPageIds = findRepeatedBoardPageIds(pages);
  return pages.map(({ page, pageId }) =>
    evaluatePage(lessonId, page, pageId, repeatedBoardPageIds.has(pageId), repeatedPageRoleTitleIds.has(pageResultKey(lessonId, pageId)))
  );
}

function evaluatePage(
  lessonId: string,
  page: Record<string, unknown>,
  pageId: string,
  hasRepeatedBoardContent: boolean,
  hasRepeatedPageRoleTitle: boolean
): SelfStudyTextbookPageResult {
  const boardIssues = evaluateKnowledgeBoard(page.knowledgeBoard);
  if (hasRepeatedBoardContent) {
    boardIssues.push({ kind: "weak", item: "repeated knowledgeBoard content" });
  }
  if (hasAuthoringScaffoldLanguage(page)) {
    boardIssues.push({ kind: "weak", item: "authoring scaffold language" });
  }
  if (hasRepeatedPageRoleTitle) {
    boardIssues.push({ kind: "weak", item: "repeated page-role title pattern" });
  }
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

function findRepeatedBoardPageIds(pages: LessonPageRecord[]): Set<string> {
  const pageIdsBySignature = new Map<string, string[]>();
  for (const { page, pageId } of pages) {
    const signature = boardSignature(page.knowledgeBoard);
    if (!signature) {
      continue;
    }
    const pageIds = pageIdsBySignature.get(signature) ?? [];
    pageIds.push(pageId);
    pageIdsBySignature.set(signature, pageIds);
  }
  return new Set(
    Array.from(pageIdsBySignature.values())
      .filter((pageIds) => pageIds.length > 1)
      .flat()
  );
}

function findRepeatedPageRoleTitleIds(pages: LessonPageRecord[]): Set<string> {
  const pagesByRole = new Map<string, LessonPageRecord[]>();
  for (const record of pages) {
    const role = extractScaffoldTitleRole(record.page.title);
    if (!role) {
      continue;
    }
    const key = `${record.pageId}:${role}`;
    const matches = pagesByRole.get(key) ?? [];
    matches.push(record);
    pagesByRole.set(key, matches);
  }

  return new Set(
    Array.from(pagesByRole.values())
      .filter((matches) => new Set(matches.map((match) => match.lessonId)).size >= 3)
      .flatMap((matches) => matches.map((match) => pageResultKey(match.lessonId, match.pageId)))
  );
}

function extractScaffoldTitleRole(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const role = value.split(/[：:]/u).pop()?.trim();
  return role && scaffoldTitleRoles.has(role) ? role : undefined;
}

function hasAuthoringScaffoldLanguage(page: Record<string, unknown>): boolean {
  const text = [
    page.title,
    page.narrative,
    isRecord(page.knowledgeBoard) ? page.knowledgeBoard.headline : undefined,
    isRecord(page.knowledgeBoard) ? page.knowledgeBoard.coreProposition : undefined
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  return authoringScaffoldPatterns.some((pattern) => pattern.test(text));
}

function pageResultKey(lessonId: string, pageId: string): string {
  return `${lessonId}:${pageId}`;
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

function boardSignature(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const text = [
    ...collectBoardText(value.headline),
    ...collectBoardText(value.coreProposition),
    ...collectBoardText(value.leftColumn),
    ...collectBoardText(value.rightColumn),
    ...collectBoardText(value.bottomLine)
  ].join("\n");
  const normalized = normalizeBoardText(text);
  return normalized.length >= 80 ? normalized : undefined;
}

function normalizeBoardText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\bsource-\d+:[^\s，。；、,.!?！？:;'"“”‘’()[\]（）【】《》<>]+/giu, "source-anchor")
    .replace(/\bbook:p\d+\b/giu, "source-anchor")
    .replace(/[\s，。；：、,.!?！？:;'"“”‘’()[\]（）【】《》<>]/gu, "");
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
