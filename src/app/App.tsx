import { useState } from "react";

import { CourseShell } from "../components/course/CourseShell";
import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { CanvasMapRenderer } from "../renderers/CanvasMapRenderer";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";

export function App() {
  const defaultLesson = lessonRegistry[0];
  const defaultCoursePack = coursePackRegistry[0];
  const defaultCoursePackLessonId = defaultCoursePack?.coursePack.units.find((unit) => unit.lessonId)?.lessonId;
  const [selectedCoursePackId, setSelectedCoursePackId] = useState(defaultCoursePack?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState(defaultCoursePackLessonId ?? defaultLesson?.id ?? "");
  const [courseView, setCourseView] = useState<"deck" | "map">("deck");
  const selectedLesson = lessonRegistry.find((lesson) => lesson.id === selectedLessonId)?.lesson ?? defaultLesson?.lesson;
  const selectedCoursePack = coursePackRegistry.find((entry) => entry.id === selectedCoursePackId)?.coursePack;
  const selectedCoursePackUnits =
    selectedCoursePack?.units
      .map((unit) => ({
        unit,
        lessonAvailable: Boolean(unit.lessonId && lessonRegistry.some((entry) => entry.id === unit.lessonId))
      })) ?? [];

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
                    const firstUnitLessonId = nextCoursePack?.units.find((unit) => unit.lessonId)?.lessonId;
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
            {selectedCoursePack ? (
              <div className="flex rounded-md border border-slate-700 bg-slate-900 p-1 text-sm">
                <button
                  className={`rounded px-3 py-1.5 font-semibold ${courseView === "deck" ? "bg-sky-600 text-white" : "text-slate-300"}`}
                  onClick={() => setCourseView("deck")}
                  type="button"
                >
                  Web Deck
                </button>
                <button
                  className={`rounded px-3 py-1.5 font-semibold ${courseView === "map" ? "bg-sky-600 text-white" : "text-slate-300"}`}
                  onClick={() => setCourseView("map")}
                  type="button"
                >
                  知识地图
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {selectedCoursePack && selectedCoursePackUnits.length > 0 && (
          <CourseShell
            coursePack={selectedCoursePack}
            onSelectLesson={setSelectedLessonId}
            selectedLessonId={selectedLessonId}
            units={selectedCoursePackUnits}
          />
        )}
      </div>
      {selectedCoursePack && courseView === "map" ? (
        <CanvasMapRenderer
          coursePack={selectedCoursePack}
          onSelectLesson={(lessonId) => {
            setSelectedLessonId(lessonId);
            setCourseView("deck");
          }}
          selectedLessonId={selectedLessonId}
        />
      ) : (
        <WebDeckRenderer lesson={selectedLesson} />
      )}
    </div>
  );
}
