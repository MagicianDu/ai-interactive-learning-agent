import { Layers3 } from "lucide-react";

import type { CoursePack } from "../../schemas/course-pack.schema";
import { CourseUnitList, type CourseUnitView } from "./CourseUnitList";
import { SourceMappingPanel } from "./SourceMappingPanel";

type CourseShellProps = {
  coursePack: CoursePack;
  units: CourseUnitView[];
  selectedLessonId: string;
  onSelectLesson: (lessonId: string) => void;
};

export function CourseShell({ coursePack, units, selectedLessonId, onSelectLesson }: CourseShellProps) {
  const generatedCount = units.filter((entry) => entry.lessonAvailable).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.45fr)]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#0e2f57] text-white">
              <Layers3 aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-slate-500">课程包</p>
              <h1 className="mt-1 truncate text-xl font-bold text-slate-950">{coursePack.title}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {coursePack.sourceKind ? <span className="rounded-full bg-white px-2 py-1">{coursePack.sourceKind}</span> : null}
                {coursePack.strategy ? <span className="rounded-full bg-white px-2 py-1">{coursePack.strategy}</span> : null}
                <span className="rounded-full bg-white px-2 py-1">
                  {generatedCount}/{units.length} 已生成
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <CourseUnitList onSelectLesson={onSelectLesson} selectedLessonId={selectedLessonId} units={units} />
          </div>
        </div>

        <SourceMappingPanel coursePack={coursePack} />
      </div>
    </section>
  );
}
