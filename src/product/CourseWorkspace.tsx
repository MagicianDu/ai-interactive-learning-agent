import { useState } from "react";

import { CourseShell } from "../components/course/CourseShell";
import type { CoursePackRegistryEntry } from "../course-packs/registry";
import type { LessonRegistryEntry } from "../lessons/registry";
import { CanvasMapRenderer } from "../renderers/CanvasMapRenderer";
import { LearningProductRenderer } from "../renderers/LearningProductRenderer";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";
import { CourseHero } from "./CourseHero";
import { ProductModeTabs, productModeTabs, type CourseView } from "./ProductModeTabs";

type CourseWorkspaceProps = {
  lessons: LessonRegistryEntry[];
  coursePacks: CoursePackRegistryEntry[];
};

export function CourseWorkspace({ lessons, coursePacks }: CourseWorkspaceProps) {
  const defaultLesson = lessons[0];
  const defaultCoursePack = coursePacks[0];
  const defaultCoursePackLessonId = defaultCoursePack?.coursePack.units.find((unit) => unit.lessonId)?.lessonId;
  const [selectedCoursePackId, setSelectedCoursePackId] = useState(defaultCoursePack?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState(defaultCoursePackLessonId ?? defaultLesson?.id ?? "");
  const [courseView, setCourseView] = useState<CourseView>("deck");
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId)?.lesson ?? defaultLesson?.lesson;
  const selectedCoursePack = coursePacks.find((entry) => entry.id === selectedCoursePackId)?.coursePack;
  const selectedCoursePackUnits =
    selectedCoursePack?.units
      .map((unit) => ({
        unit,
        lessonAvailable: Boolean(unit.lessonId && lessons.some((entry) => entry.id === unit.lessonId))
      })) ?? [];
  const generatedCount = selectedCoursePackUnits.filter((entry) => entry.lessonAvailable).length;
  const modeLabel = productModeTabs.find((tab) => tab.id === courseView)?.label ?? "学习";

  if (!selectedLesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-center text-white">
        <p className="max-w-md text-sm text-slate-300">没有发现可渲染课程。请先生成或注册一个 lesson。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 text-slate-950 sm:px-8 lg:px-10">
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.35fr)_minmax(18rem,0.35fr)] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">当前课程</p>
            <h2 className="mt-1 truncate text-lg font-bold text-slate-950">{selectedLesson.title}</h2>
          </div>
          {coursePacks.length > 0 && (
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              学习项目
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-400"
                value={selectedCoursePackId}
                onChange={(event) => {
                  const nextCoursePack = coursePacks.find((entry) => entry.id === event.target.value)?.coursePack;
                  setSelectedCoursePackId(event.target.value);
                  const firstUnitLessonId = nextCoursePack?.units.find((unit) => unit.lessonId)?.lessonId;
                  if (firstUnitLessonId) {
                    setSelectedLessonId(firstUnitLessonId);
                    setCourseView("deck");
                  }
                }}
              >
                {coursePacks.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            课程单元
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-400"
              value={selectedLessonId}
              onChange={(event) => setSelectedLessonId(event.target.value)}
            >
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedCoursePack ? (
          <CourseHero
            generatedCount={generatedCount}
            modeLabel={modeLabel}
            sourceKind={selectedCoursePack.sourceKind}
            strategy={selectedCoursePack.strategy}
            title={selectedCoursePack.title}
            unitCount={selectedCoursePackUnits.length}
          />
        ) : null}

        <ProductModeTabs onChange={setCourseView} value={courseView} />

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
      ) : courseView === "assessment" || courseView === "teacher" || courseView === "playground" || courseView === "tutor" ? (
        <LearningProductRenderer lesson={selectedLesson} mode={courseView} />
      ) : (
        <WebDeckRenderer lesson={selectedLesson} />
      )}
    </div>
  );
}
