import type { CoursePack } from "../schemas/course-pack.schema";

type CoursePackModule = {
  generatedCoursePack?: CoursePack;
};

export type CoursePackRegistryEntry = {
  id: string;
  label: string;
  coursePack: CoursePack;
  modulePath: string;
  projectStatus: "preview-ready" | "generated" | "sample";
  sourceKind?: string;
  strategy?: string;
  unitCount: number;
};

const coursePackModules = import.meta.glob<CoursePackModule>("./*/coursePack.ts", { eager: true });

export const coursePackRegistry = Object.entries(coursePackModules)
  .map(([modulePath, module]): CoursePackRegistryEntry | undefined => {
    if (!module.generatedCoursePack) {
      return undefined;
    }

    return {
      id: module.generatedCoursePack.id,
      label: module.generatedCoursePack.title,
      coursePack: module.generatedCoursePack,
      modulePath,
      projectStatus: module.generatedCoursePack.parentRunId?.startsWith("demo") ? "sample" : "preview-ready",
      sourceKind: module.generatedCoursePack.sourceKind,
      strategy: module.generatedCoursePack.strategy,
      unitCount: module.generatedCoursePack.units.length
    };
  })
  .filter((entry): entry is CoursePackRegistryEntry => entry !== undefined)
  .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
