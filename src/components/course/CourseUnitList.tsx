import { BookOpen, CircleDashed } from "lucide-react";

import type { CoursePackUnit } from "../../schemas/course-pack.schema";
import { CourseStatusBadge } from "./CourseStatusBadge";

export type CourseUnitView = {
  unit: CoursePackUnit;
  lessonAvailable: boolean;
};

type CourseUnitListProps = {
  units: CourseUnitView[];
  selectedLessonId: string;
  onSelectLesson: (lessonId: string) => void;
};

export function CourseUnitList({ units, selectedLessonId, onSelectLesson }: CourseUnitListProps) {
  return (
    <div className="grid gap-2">
      {units.map(({ unit, lessonAvailable }) => {
        const selected = Boolean(unit.lessonId && unit.lessonId === selectedLessonId);
        const disabled = !lessonAvailable || !unit.lessonId;
        const Icon = lessonAvailable ? BookOpen : CircleDashed;

        return (
          <button
            aria-pressed={selected}
            className={[
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3 text-left transition",
              selected
                ? "border-sky-300 bg-sky-50 text-sky-950"
                : "border-slate-200 bg-white text-slate-800",
              disabled ? "cursor-not-allowed opacity-75" : "hover:border-sky-300 hover:bg-sky-50"
            ].join(" ")}
            disabled={disabled}
            key={unit.unitId}
            onClick={() => {
              if (unit.lessonId) {
                onSelectLesson(unit.lessonId);
              }
            }}
            type="button"
          >
            <Icon aria-hidden="true" className="size-5 text-slate-500" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{unit.title}</span>
              <span className="mt-1 block text-xs text-slate-500">
                {unit.kind} · {unit.targetPageCount} 页
              </span>
            </span>
            <CourseStatusBadge generated={lessonAvailable} />
          </button>
        );
      })}
    </div>
  );
}
