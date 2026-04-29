import { useState } from "react";

import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";

export function App() {
  const defaultLesson = lessonRegistry[0];
  const defaultCoursePack = coursePackRegistry[0];
  const defaultCoursePackLessonId = defaultCoursePack?.coursePack.units[0]?.lessonId;
  const [selectedCoursePackId, setSelectedCoursePackId] = useState(defaultCoursePack?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState(defaultCoursePackLessonId ?? defaultLesson?.id ?? "");
  const selectedLesson = lessonRegistry.find((lesson) => lesson.id === selectedLessonId)?.lesson ?? defaultLesson?.lesson;
  const selectedCoursePack = coursePackRegistry.find((entry) => entry.id === selectedCoursePackId)?.coursePack;
  const selectedCoursePackUnits =
    selectedCoursePack?.units
      .map((unit) => ({
        unit,
        lesson: lessonRegistry.find((entry) => entry.id === unit.lessonId)
      }))
      .filter((entry) => entry.lesson !== undefined) ?? [];

  if (!selectedLesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-center text-white">
        <p className="max-w-md text-sm text-slate-300">没有发现可渲染课程。请先生成或注册一个 lesson。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">课程</p>
            <h1 className="text-lg font-semibold">{selectedLesson.title}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {coursePackRegistry.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <span className="font-medium">资料包</span>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                  value={selectedCoursePackId}
                  onChange={(event) => {
                    const nextCoursePack = coursePackRegistry.find((entry) => entry.id === event.target.value)?.coursePack;
                    setSelectedCoursePackId(event.target.value);
                    const firstUnitLessonId = nextCoursePack?.units[0]?.lessonId;
                    if (firstUnitLessonId) {
                      setSelectedLessonId(firstUnitLessonId);
                    }
                  }}
                >
                  {coursePackRegistry.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <span className="font-medium">课程</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                value={selectedLessonId}
                onChange={(event) => setSelectedLessonId(event.target.value)}
              >
                {lessonRegistry.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {selectedCoursePackUnits.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedCoursePackUnits.map(({ unit, lesson }) => (
              <button
                key={unit.unitId}
                className={`min-w-40 rounded-md border px-3 py-2 text-left text-xs transition ${
                  selectedLessonId === unit.lessonId
                    ? "border-sky-400 bg-sky-950 text-sky-100"
                    : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600"
                }`}
                type="button"
                onClick={() => lesson && setSelectedLessonId(unit.lessonId)}
              >
                <span className="block text-[11px] uppercase text-slate-500">{unit.kind}</span>
                <span className="block truncate font-medium">{unit.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <WebDeckRenderer lesson={selectedLesson} />
    </div>
  );
}
