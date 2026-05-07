export type RevisionTarget =
  | { scope: "course"; requestedChange: string }
  | { scope: "unit"; unitId?: string; requestedChange: string }
  | { scope: "page"; pageIndex: number; requestedChange: string }
  | { scope: "interaction"; pageIndex?: number; requestedChange: string }
  | { scope: "assessment"; pageIndex?: number; requestedChange: string }
  | { scope: "source"; requestedChange: string };

export type RevisionFeedbackCategory =
  | "too_abstract"
  | "too_dense"
  | "example_missing"
  | "source_unclear"
  | "interaction_weak"
  | "feedback_unhelpful"
  | "too_easy"
  | "too_hard"
  | "suspicious_claim"
  | "more_practice"
  | "structure_change"
  | "style_change"
  | "quality_gap";

export type RevisionTargetV2 = {
  scope: "course" | "unit" | "page" | "interaction" | "assessment" | "source" | "style";
  requestedChange: string;
  categories: RevisionFeedbackCategory[];
  confidence: "high" | "medium" | "low";
  clarificationQuestion?: string;
  courseId?: string;
  unitId?: string;
  lessonId?: string;
  pageId?: string;
  pageIndex?: number;
  pageNumber?: number;
};

export type RevisionTargetContext = {
  currentCourseId?: string;
  currentUnitId?: string;
  currentLessonId?: string;
  currentPageId?: string;
  currentPageIndex?: number;
};

export function parseRevisionTarget(feedback: string, focus?: string): RevisionTarget {
  const requestedChange = feedback.trim();
  const targetText = `${focus ?? ""} ${feedback}`;
  const page = /第\s*(?<page>[0-9一二三四五六七八九十]+)\s*页/u.exec(targetText)?.groups?.page;
  if (page) {
    return { scope: "page", pageIndex: chineseNumberToIndex(page), requestedChange };
  }
  if (/结构|章节|topic|单元|路径/iu.test(targetText)) {
    return { scope: "course", requestedChange };
  }
  if (/互动|操作|选择|实验/iu.test(targetText)) {
    return { scope: "interaction", requestedChange };
  }
  if (/测验|题|评估/iu.test(targetText)) {
    return { scope: "assessment", requestedChange };
  }
  if (/来源|引用|锚点/iu.test(targetText)) {
    return { scope: "source", requestedChange };
  }
  return { scope: "unit", requestedChange };
}

export function parseRevisionTargetV2(feedback: string, contextOrFocus?: RevisionTargetContext | string): RevisionTargetV2 {
  const requestedChange = feedback.trim();
  const focusText = typeof contextOrFocus === "string" ? contextOrFocus : "";
  const context = typeof contextOrFocus === "object" && contextOrFocus !== null ? contextOrFocus : {};
  const targetText = `${focusText} ${feedback}`;
  const categories = classifyFeedback(targetText);
  const explicitPage = /第\s*(?<page>[0-9一二三四五六七八九十]+)\s*页/u.exec(targetText)?.groups?.page;
  const contextualPageMention = /这页|这一页|当前页|本页/u.test(targetText);

  if (explicitPage) {
    const pageNumber = chineseNumberToNumber(explicitPage);
    return compactTarget({
      scope: "page",
      requestedChange,
      categories,
      confidence: "high",
      pageIndex: Math.max(0, pageNumber - 1),
      pageNumber,
      courseId: context.currentCourseId,
      unitId: context.currentUnitId,
      lessonId: context.currentLessonId,
      pageId: context.currentPageId
    });
  }

  if (contextualPageMention) {
    if (Number.isInteger(context.currentPageIndex)) {
      const pageIndex = context.currentPageIndex as number;
      return compactTarget({
        scope: "page",
        requestedChange,
        categories,
        confidence: "high",
        pageIndex,
        pageNumber: pageIndex + 1,
        courseId: context.currentCourseId,
        unitId: context.currentUnitId,
        lessonId: context.currentLessonId,
        pageId: context.currentPageId
      });
    }
    return {
      scope: "page",
      requestedChange,
      categories,
      confidence: "low",
      clarificationQuestion: "你想修改哪一页？请告诉我页码，或先打开要修改的页面。"
    };
  }

  const scope = inferScope(targetText);
  return compactTarget({
    scope,
    requestedChange,
    categories,
    confidence: scope === "unit" ? "medium" : "high",
    courseId: context.currentCourseId,
    unitId: context.currentUnitId,
    lessonId: context.currentLessonId
  });
}

function classifyFeedback(value: string): RevisionFeedbackCategory[] {
  const categories: RevisionFeedbackCategory[] = [];
  addCategory(categories, /抽象|不直观|看不懂|心智模型/iu.test(value), "too_abstract");
  addCategory(categories, /太多|太密|信息量|塞满|读不完|滚动/iu.test(value), "too_dense");
  addCategory(categories, /例子|案例|工程|真实|生活化/iu.test(value), "example_missing");
  addCategory(categories, /来源|引用|锚点|依据|证据/iu.test(value), "source_unclear");
  addCategory(categories, /互动|操作|实验|拖拽|选择|动手/iu.test(value), "interaction_weak");
  addCategory(categories, /反馈|解释不清|只说对错|为什么/iu.test(value), "feedback_unhelpful");
  addCategory(categories, /太简单|太浅|更难|挑战/iu.test(value), "too_easy");
  addCategory(categories, /太难|难度|术语|看不懂|降低/iu.test(value), "too_hard");
  addCategory(categories, /不对|可疑|幻觉|错误|不准确|有问题/iu.test(value), "suspicious_claim");
  addCategory(categories, /练习|题|作业|巩固|更多实践/iu.test(value), "more_practice");
  addCategory(categories, /结构|章节|topic|单元|路径|顺序/iu.test(value), "structure_change");
  addCategory(categories, /风格|语气|中文|严谨|口语|简洁/iu.test(value), "style_change");
  return categories.length > 0 ? categories : ["style_change"];
}

function addCategory(categories: RevisionFeedbackCategory[], condition: boolean, category: RevisionFeedbackCategory): void {
  if (condition && !categories.includes(category)) {
    categories.push(category);
  }
}

function inferScope(value: string): RevisionTargetV2["scope"] {
  if (/整体|全局|这一段|这部分|这个单元|本单元/iu.test(value)) {
    return "unit";
  }
  if (/结构|章节|topic|单元|路径|顺序/iu.test(value)) {
    return "course";
  }
  if (/互动|操作|选择|实验|拖拽/iu.test(value)) {
    return "interaction";
  }
  if (/测验|题|评估|作业|练习/iu.test(value)) {
    return "assessment";
  }
  if (/来源|引用|锚点|证据|依据/iu.test(value)) {
    return "source";
  }
  if (/风格|语气|中文|严谨|口语|简洁/iu.test(value)) {
    return "style";
  }
  return "unit";
}

function compactTarget(target: RevisionTargetV2): RevisionTargetV2 {
  return Object.fromEntries(Object.entries(target).filter(([, value]) => value !== undefined)) as RevisionTargetV2;
}

function chineseNumberToIndex(value: string): number {
  return Math.max(0, chineseNumberToNumber(value) - 1);
}

function chineseNumberToNumber(value: string): number {
  const direct = Number(value);
  if (Number.isInteger(direct) && direct > 0) {
    return direct;
  }

  const digitMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };
  if (value === "十") {
    return 10;
  }
  if (value.includes("十")) {
    const [tensText, onesText] = value.split("十");
    const tens = tensText.length > 0 ? digitMap[tensText] ?? 1 : 1;
    const ones = onesText.length > 0 ? digitMap[onesText] ?? 0 : 0;
    return tens * 10 + ones;
  }

  return digitMap[value] ?? 1;
}
