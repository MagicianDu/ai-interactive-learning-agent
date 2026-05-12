export type CourseIntent = "build_mental_model" | "professor_lecture_deck" | "student_self_study_textbook";

export const courseIntentValues = [
  "build_mental_model",
  "professor_lecture_deck",
  "student_self_study_textbook"
] as const satisfies readonly CourseIntent[];

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
  if (/courseintent\s*[=＝:：]\s*student_self_study_textbook/i.test(normalized)) {
    return "student_self_study_textbook";
  }
  if (/courseintent\s*[=＝:：]\s*build_mental_model/i.test(normalized)) {
    return "build_mental_model";
  }
  if (/courseintent\s*[=＝:：]\s*professor_lecture_deck/i.test(normalized)) {
    return "professor_lecture_deck";
  }
  if (
    /自学|自己看懂|不想读完整本书|不想读完全书|压缩成\s*\d{1,3}\s*页|web\s*教材|web textbook|self-study|self study/i.test(
      normalized
    )
  ) {
    return "student_self_study_textbook";
  }
  if (/教授\s*ppt|教授式|课程讲义|像老师上课|ppt|lecture\s*slides?|lecture\s*deck|professor/i.test(normalized)) {
    return "professor_lecture_deck";
  }
  return defaultCourseIntent;
}

export function courseIntentLabel(intent: CourseIntent): string {
  if (intent === "student_self_study_textbook") {
    return "学生自学 Web 教材";
  }
  if (intent === "professor_lecture_deck") {
    return "教师/课堂 Web Deck";
  }
  return "互动学习课";
}
