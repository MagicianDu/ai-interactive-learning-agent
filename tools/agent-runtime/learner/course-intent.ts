export type CourseIntent = "build_mental_model" | "professor_lecture_deck";

export const courseIntentValues = ["build_mental_model", "professor_lecture_deck"] as const satisfies readonly CourseIntent[];

export const defaultCourseIntent: CourseIntent = "build_mental_model";

const courseIntentSet = new Set<CourseIntent>(courseIntentValues);

export function normalizeCourseIntent(value: unknown): CourseIntent | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return courseIntentSet.has(value as CourseIntent) ? (value as CourseIntent) : undefined;
}

export function inferCourseIntent(request: string): CourseIntent {
  const normalized = request.toLocaleLowerCase();
  if (/courseintent\s*[=＝:：]\s*professor_lecture_deck/i.test(normalized)) {
    return "professor_lecture_deck";
  }
  if (/courseintent\s*[=＝:：]\s*build_mental_model/i.test(normalized)) {
    return "build_mental_model";
  }
  if (/教授\s*ppt|教授式|课程讲义|像老师上课|ppt|lecture\s*slides?|lecture\s*deck|professor/i.test(normalized)) {
    return "professor_lecture_deck";
  }
  return defaultCourseIntent;
}

export function courseIntentLabel(intent: CourseIntent): string {
  if (intent === "professor_lecture_deck") {
    return "教授式课程讲义 Web Deck";
  }
  return "互动学习课";
}
