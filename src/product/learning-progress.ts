export type PageFeedbackOption = "too_abstract" | "needs_examples" | "unclear_source" | "harder" | "simpler";

export type PageFeedbackRevisionBrief = {
  courseId: string;
  unitId?: string;
  lessonId: string;
  pageId: string;
  pageNumber: number;
  option: PageFeedbackOption;
  scope: "page";
  focus: "abstraction" | "examples" | "source" | "difficulty";
  feedback: string;
  recommendedTool: "learning_agent.revise_learning_course";
  createdAt: string;
};

export type QuizAttemptRecord = {
  courseId: string;
  lessonId: string;
  pageId: string;
  correct: boolean;
  createdAt: string;
};

export type LearningProgressState = {
  currentCourseId?: string;
  currentUnitId?: string;
  currentLessonId?: string;
  currentPageIndex?: number;
  completedPages: string[];
  quizAttempts: QuizAttemptRecord[];
  feedbackBriefs: PageFeedbackRevisionBrief[];
};

export const learningProgressStorageKey = "ai-interactive-learning-agent:learning-progress:v1";

const feedbackCopy: Record<PageFeedbackOption, { label: string; focus: PageFeedbackRevisionBrief["focus"]; feedback: string }> = {
  harder: {
    label: "想要更难",
    focus: "difficulty",
    feedback: "这页可以更有挑战，请增加更高阶的问题、边界条件或迁移任务。"
  },
  needs_examples: {
    label: "例子不够",
    focus: "examples",
    feedback: "这页例子不够，请补充更具体、更贴近真实场景的中文例子。"
  },
  simpler: {
    label: "想要更简单",
    focus: "difficulty",
    feedback: "这页对当前学习者偏难，请降低术语密度，增加更简单的中文解释。"
  },
  too_abstract: {
    label: "太抽象",
    focus: "abstraction",
    feedback: "这页太抽象，请增加直观模型、步骤化解释或新手行动提示。"
  },
  unclear_source: {
    label: "来源依据不清楚",
    focus: "source",
    feedback: "这页来源依据不清楚，请补充或解释对应 sourceAnchorIds 支持了哪个说法。"
  }
};

export const pageFeedbackOptions: Array<{ id: PageFeedbackOption; label: string }> = [
  { id: "too_abstract", label: feedbackCopy.too_abstract.label },
  { id: "needs_examples", label: feedbackCopy.needs_examples.label },
  { id: "unclear_source", label: feedbackCopy.unclear_source.label },
  { id: "harder", label: feedbackCopy.harder.label },
  { id: "simpler", label: feedbackCopy.simpler.label }
];

export function loadLearningProgress(storage: Storage | undefined = browserStorage()): LearningProgressState {
  if (!storage) {
    return emptyProgress();
  }
  const raw = storage.getItem(learningProgressStorageKey);
  if (!raw) {
    return emptyProgress();
  }
  try {
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}

export function saveLearningProgress(state: LearningProgressState, storage: Storage | undefined = browserStorage()): void {
  storage?.setItem(learningProgressStorageKey, JSON.stringify(normalizeProgress(state)));
}

export function recordPageVisit(
  state: LearningProgressState,
  input: {
    courseId: string;
    unitId?: string;
    lessonId: string;
    pageId: string;
    pageIndex: number;
  }
): LearningProgressState {
  const pageKey = buildPageKey(input.courseId, input.lessonId, input.pageId);
  return normalizeProgress({
    ...state,
    currentCourseId: input.courseId,
    currentUnitId: input.unitId,
    currentLessonId: input.lessonId,
    currentPageIndex: input.pageIndex,
    completedPages: unique([...state.completedPages, pageKey])
  });
}

export function createPageFeedbackRevisionBrief(input: {
  courseId: string;
  unitId?: string;
  lessonId: string;
  pageId: string;
  pageNumber: number;
  option: PageFeedbackOption;
  now?: Date;
}): PageFeedbackRevisionBrief {
  const copy = feedbackCopy[input.option];
  return {
    courseId: input.courseId,
    unitId: input.unitId,
    lessonId: input.lessonId,
    pageId: input.pageId,
    pageNumber: input.pageNumber,
    option: input.option,
    scope: "page",
    focus: copy.focus,
    feedback: `课程 ${input.courseId}，单元 ${input.unitId ?? "未标注"}，第 ${input.pageNumber} 页：${copy.feedback}`,
    recommendedTool: "learning_agent.revise_learning_course",
    createdAt: (input.now ?? new Date()).toISOString()
  };
}

export function addFeedbackBrief(state: LearningProgressState, brief: PageFeedbackRevisionBrief): LearningProgressState {
  return normalizeProgress({
    ...state,
    feedbackBriefs: [brief, ...state.feedbackBriefs].slice(0, 20)
  });
}

export function completedPageCountForCourse(state: LearningProgressState, courseId: string): number {
  return state.completedPages.filter((pageKey) => pageKey.startsWith(`${courseId}:`)).length;
}

export function buildPageKey(courseId: string, lessonId: string, pageId: string): string {
  return `${courseId}:${lessonId}:${pageId}`;
}

function normalizeProgress(value: unknown): LearningProgressState {
  if (!isRecord(value)) {
    return emptyProgress();
  }
  return {
    currentCourseId: stringOrUndefined(value.currentCourseId),
    currentUnitId: stringOrUndefined(value.currentUnitId),
    currentLessonId: stringOrUndefined(value.currentLessonId),
    currentPageIndex: typeof value.currentPageIndex === "number" ? value.currentPageIndex : undefined,
    completedPages: stringArray(value.completedPages),
    quizAttempts: Array.isArray(value.quizAttempts) ? value.quizAttempts.filter(isQuizAttemptRecord) : [],
    feedbackBriefs: Array.isArray(value.feedbackBriefs) ? value.feedbackBriefs.filter(isFeedbackBrief) : []
  };
}

function emptyProgress(): LearningProgressState {
  return {
    completedPages: [],
    quizAttempts: [],
    feedbackBriefs: []
  };
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const candidate = window.localStorage as Storage | undefined;
  return candidate && typeof candidate.getItem === "function" && typeof candidate.setItem === "function" ? candidate : undefined;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isFeedbackBrief(value: unknown): value is PageFeedbackRevisionBrief {
  return isRecord(value) && typeof value.courseId === "string" && typeof value.lessonId === "string" && typeof value.feedback === "string";
}

function isQuizAttemptRecord(value: unknown): value is QuizAttemptRecord {
  return isRecord(value) && typeof value.courseId === "string" && typeof value.lessonId === "string" && typeof value.correct === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
