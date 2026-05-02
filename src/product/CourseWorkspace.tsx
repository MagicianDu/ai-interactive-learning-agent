import { useMemo, useState } from "react";

import { CourseShell } from "../components/course/CourseShell";
import type { CoursePackRegistryEntry } from "../course-packs/registry";
import type { LessonRegistryEntry } from "../lessons/registry";
import { CanvasMapRenderer } from "../renderers/CanvasMapRenderer";
import { LearningProductRenderer } from "../renderers/LearningProductRenderer";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";
import { productModeTabs, type CourseView } from "./ProductModeTabs";
import { buildProductRoute, parseProductRoute } from "./product-route";

type CourseWorkspaceProps = {
  lessons: LessonRegistryEntry[];
  coursePacks: CoursePackRegistryEntry[];
};

export function CourseWorkspace({ lessons, coursePacks }: CourseWorkspaceProps) {
  const initialRoute = parseProductRoute(typeof window === "undefined" ? "" : window.location.hash);
  const defaultLesson = lessons[0];
  const defaultCoursePack = pickDefaultCoursePack(coursePacks, initialRoute.courseId);
  const defaultUnit = pickDefaultUnit(defaultCoursePack?.coursePack, initialRoute.unitId);
  const defaultCoursePackLessonId = defaultUnit?.lessonId ?? defaultCoursePack?.coursePack.units.find((unit) => unit.lessonId)?.lessonId;
  const [selectedCoursePackId, setSelectedCoursePackId] = useState(defaultCoursePack?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState(defaultCoursePackLessonId ?? defaultLesson?.id ?? "");
  const [selectedPageIndex, setSelectedPageIndex] = useState(initialRoute.pageIndex ?? 0);
  const [courseView, setCourseView] = useState<CourseView>("deck");
  const [showStructure, setShowStructure] = useState(false);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId)?.lesson ?? defaultLesson?.lesson;
  const selectedCoursePack = coursePacks.find((entry) => entry.id === selectedCoursePackId)?.coursePack;
  const selectedCoursePackUnits =
    selectedCoursePack?.units
      .map((unit) => ({
        unit,
        lessonAvailable: Boolean(unit.lessonId && lessons.some((entry) => entry.id === unit.lessonId))
      })) ?? [];
  const modeLabel = productModeTabs.find((tab) => tab.id === courseView)?.label ?? "学习";
  const lessonChoices = useMemo(
    () =>
      selectedCoursePackUnits
        .filter(({ unit, lessonAvailable }) => unit.lessonId && lessonAvailable)
        .map(({ unit }) => ({
          id: unit.lessonId as string,
          label: unit.title
        })),
    [selectedCoursePackUnits]
  );

  const updateRoute = (courseId: string, lessonId: string, pageIndex: number) => {
    const coursePack = coursePacks.find((entry) => entry.id === courseId)?.coursePack;
    const unitId = coursePack?.units.find((unit) => unit.lessonId === lessonId)?.unitId;
    const nextRoute = buildProductRoute({ courseId, unitId, pageIndex });
    if (typeof window !== "undefined" && window.location.hash !== nextRoute) {
      window.history.replaceState(null, "", nextRoute);
    }
  };

  const selectLesson = (lessonId: string, pageIndex = 0) => {
    setSelectedLessonId(lessonId);
    setSelectedPageIndex(pageIndex);
    setCourseView("deck");
    updateRoute(selectedCoursePackId, lessonId, pageIndex);
  };

  const selectCoursePack = (coursePackId: string) => {
    const nextCoursePack = coursePacks.find((entry) => entry.id === coursePackId)?.coursePack;
    setSelectedCoursePackId(coursePackId);
    const firstUnitLessonId = nextCoursePack?.units.find((unit) => unit.lessonId)?.lessonId;
    if (firstUnitLessonId) {
      setSelectedLessonId(firstUnitLessonId);
      setSelectedPageIndex(0);
      setCourseView("deck");
      updateRoute(coursePackId, firstUnitLessonId, 0);
    }
  };

  if (!selectedLesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-center text-white">
        <p className="max-w-md text-sm text-slate-300">没有发现可渲染课程。请先生成或注册一个 lesson。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 px-4 py-3 text-slate-950 shadow-sm backdrop-blur sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-slate-500">学习中</p>
            <h1 className="mt-1 truncate text-xl font-bold text-slate-950">{selectedCoursePack?.title ?? selectedLesson.title}</h1>
            <p className="mt-1 truncate text-sm font-medium text-slate-500">
              {selectedLesson.title} · {modeLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {coursePacks.length > 1 ? (
              <label className="grid min-w-48 gap-1 text-xs font-bold text-slate-600">
                学习项目
                <select
                  aria-label="选择学习项目"
                  className="h-9 max-w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-sky-400"
                  value={selectedCoursePackId}
                  onChange={(event) => selectCoursePack(event.target.value)}
                >
                  {coursePacks.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {lessonChoices.length > 1 ? (
              <label className="grid min-w-44 gap-1 text-xs font-bold text-slate-600">
                课程单元
                <select
                  aria-label="选择课程单元"
                  className="h-9 max-w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-sky-400"
                  value={selectedLessonId}
                  onChange={(event) => selectLesson(event.target.value)}
                >
                  {lessonChoices.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex gap-2">
              <button
                aria-pressed={courseView === "deck"}
                className={modeButtonClass(courseView === "deck")}
                onClick={() => setCourseView("deck")}
                type="button"
              >
                学习
              </button>
              <button
                aria-pressed={courseView === "map"}
                className={modeButtonClass(courseView === "map")}
                onClick={() => setCourseView("map")}
                type="button"
              >
                知识地图
              </button>
              <button
                aria-expanded={showStructure}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:text-sky-800"
                onClick={() => setShowStructure((current) => !current)}
                type="button"
              >
                课程结构
              </button>
            </div>
          </div>
        </div>
      </header>

      {showStructure && selectedCoursePack && selectedCoursePackUnits.length > 0 ? (
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-8 lg:px-10">
          <CourseShell
            coursePack={selectedCoursePack}
            onSelectLesson={(lessonId) => {
              selectLesson(lessonId);
            }}
            selectedLessonId={selectedLessonId}
            units={selectedCoursePackUnits}
          />
        </div>
      ) : null}

      {selectedCoursePack && courseView === "map" ? (
        <CanvasMapRenderer
          coursePack={selectedCoursePack}
          onSelectLesson={(lessonId) => {
            selectLesson(lessonId);
          }}
          selectedLessonId={selectedLessonId}
        />
      ) : courseView === "assessment" || courseView === "teacher" || courseView === "playground" || courseView === "tutor" ? (
        <LearningProductRenderer lesson={selectedLesson} mode={courseView} />
      ) : (
        <WebDeckRenderer
          initialPageIndex={selectedPageIndex}
          lesson={selectedLesson}
          onPageChange={(pageIndex) => {
            setSelectedPageIndex(pageIndex);
            updateRoute(selectedCoursePackId, selectedLessonId, pageIndex);
          }}
        />
      )}
    </div>
  );
}

function pickDefaultCoursePack(coursePacks: CoursePackRegistryEntry[], preferredCourseId: string | undefined): CoursePackRegistryEntry | undefined {
  return coursePacks.find((entry) => entry.id === preferredCourseId) ?? coursePacks.find((entry) => entry.id !== "demo-course-pack") ?? coursePacks[0];
}

function pickDefaultUnit(coursePack: CoursePackRegistryEntry["coursePack"] | undefined, preferredUnitId: string | undefined) {
  return coursePack?.units.find((unit) => unit.unitId === preferredUnitId && unit.lessonId);
}

function modeButtonClass(active: boolean): string {
  return [
    "h-9 rounded-md border px-3 text-sm font-bold transition",
    active ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-800"
  ].join(" ");
}
