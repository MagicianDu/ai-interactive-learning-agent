import { Search, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";

import type { CoursePack } from "../../schemas/course-pack.schema";
import { CourseCoveragePanel } from "./CourseCoveragePanel";
import { CourseUnitList, type CourseUnitView } from "./CourseUnitList";
import { SourceMappingPanel } from "./SourceMappingPanel";

type CourseShellProps = {
  coursePack: CoursePack;
  units: CourseUnitView[];
  selectedLessonId: string;
  onSelectLesson: (lessonId: string) => void;
};

type GenerationFilter = "all" | "generated" | "pending";

export function CourseShell({ coursePack, units, selectedLessonId, onSelectLesson }: CourseShellProps) {
  const [searchText, setSearchText] = useState("");
  const [generationFilter, setGenerationFilter] = useState<GenerationFilter>("all");
  const generatedCount = units.filter((entry) => entry.lessonAvailable).length;
  const normalizedSearchText = searchText.trim().toLowerCase();
  const filteredUnits = useMemo(
    () =>
      units.filter(({ unit, lessonAvailable }) => {
        if (generationFilter === "generated" && !lessonAvailable) {
          return false;
        }

        if (generationFilter === "pending" && lessonAvailable) {
          return false;
        }

        if (!normalizedSearchText) {
          return true;
        }

        const searchableText = [unit.title, unit.kind, ...unit.conceptIds, ...(unit.chapterRefs ?? [])]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearchText);
      }),
    [generationFilter, normalizedSearchText, units]
  );

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.45fr)]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#0e2f57] text-white">
              <Layers3 aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-slate-500">学习项目</p>
              <h1 className="mt-1 truncate text-xl font-bold text-slate-950">{coursePack.title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">先用总览课建立全局地图，再进入核心 topic。</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {coursePack.sourceKind ? <span className="rounded-full bg-white px-2 py-1">{coursePack.sourceKind}</span> : null}
                {coursePack.strategy ? <span className="rounded-full bg-white px-2 py-1">{coursePack.strategy}</span> : null}
                <span className="rounded-full bg-white px-2 py-1">
                  {generatedCount}/{units.length} 已生成
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <label className="relative block min-w-0">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label="搜索课程单元"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="搜索标题、章节或概念"
                  type="search"
                  value={searchText}
                />
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="课程生成状态过滤">
                <button
                  className={[
                    "h-9 rounded-md border px-3 text-xs font-semibold transition",
                    generationFilter === "all"
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                  ].join(" ")}
                  onClick={() => setGenerationFilter("all")}
                  type="button"
                >
                  全部
                </button>
                <button
                  aria-label="已生成"
                  className={[
                    "h-9 rounded-md border px-3 text-xs font-semibold transition",
                    generationFilter === "generated"
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                  ].join(" ")}
                  onClick={() => setGenerationFilter("generated")}
                  type="button"
                >
                  已生成
                </button>
                <button
                  aria-label="待生成"
                  className={[
                    "h-9 rounded-md border px-3 text-xs font-semibold transition",
                    generationFilter === "pending"
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                  ].join(" ")}
                  onClick={() => setGenerationFilter("pending")}
                  type="button"
                >
                  待生成
                </button>
              </div>
            </div>
            {filteredUnits.length > 0 ? (
              <CourseUnitList onSelectLesson={onSelectLesson} selectedLessonId={selectedLessonId} units={filteredUnits} />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                没有匹配的课程单元
              </p>
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <CourseCoveragePanel coursePack={coursePack} />
          <SourceMappingPanel coursePack={coursePack} />
        </div>
      </div>
    </section>
  );
}
