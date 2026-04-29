import type { Lesson } from "../schemas/lesson.schema";

type LessonModule = {
  databaseIndexLesson?: Lesson;
  generatedLesson?: Lesson;
};

export type LessonRegistryEntry = {
  id: string;
  label: string;
  lesson: Lesson;
  modulePath: string;
};

const lessonModules = import.meta.glob<LessonModule>("./*/lesson.ts", { eager: true });

export const lessonRegistry = Object.entries(lessonModules)
  .map(([modulePath, module]) => {
    const lesson = module.generatedLesson ?? module.databaseIndexLesson;
    if (!lesson) {
      return undefined;
    }

    return {
      id: lesson.id,
      label: lesson.title,
      lesson,
      modulePath
    };
  })
  .filter((entry): entry is LessonRegistryEntry => entry !== undefined)
  .sort((left, right) => lessonSortKey(left).localeCompare(lessonSortKey(right), "zh-CN"));

function lessonSortKey(entry: LessonRegistryEntry): string {
  if (entry.id === "database-index-speed") {
    return "0";
  }
  return `1-${entry.label}`;
}
