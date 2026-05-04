import { useEffect, useMemo, useState } from "react";

import { CourseShell } from "../components/course/CourseShell";
import type { CoursePackRegistryEntry } from "../course-packs/registry";
import type { LessonRegistryEntry } from "../lessons/registry";
import { CanvasMapRenderer } from "../renderers/CanvasMapRenderer";
import { LearningProductRenderer } from "../renderers/LearningProductRenderer";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";
import { LearningSidebar, type WorkspaceView } from "./LearningSidebar";
import { ProjectLibrary } from "./ProjectLibrary";
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
  const [activeView, setActiveView] = useState<WorkspaceView>("deck");
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId)?.lesson ?? defaultLesson?.lesson;
  const selectedCoursePack = coursePacks.find((entry) => entry.id === selectedCoursePackId)?.coursePack;
  const selectedCoursePackUnits =
    selectedCoursePack?.units
      .map((unit) => ({
        unit,
        lessonAvailable: Boolean(unit.lessonId && lessons.some((entry) => entry.id === unit.lessonId))
      })) ?? [];
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

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
    setActiveView("deck");
    updateRoute(selectedCoursePackId, lessonId, pageIndex);
  };

  const selectCoursePack = (coursePackId: string) => {
    const nextCoursePack = coursePacks.find((entry) => entry.id === coursePackId)?.coursePack;
    setSelectedCoursePackId(coursePackId);
    const firstUnitLessonId = nextCoursePack?.units.find((unit) => unit.lessonId)?.lessonId;
    if (firstUnitLessonId) {
      setSelectedLessonId(firstUnitLessonId);
      setSelectedPageIndex(0);
      setActiveView("deck");
      updateRoute(coursePackId, firstUnitLessonId, 0);
    }
  };

  if (!selectedLesson) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 text-center text-white">
        <p className="max-w-md text-sm text-slate-300">没有发现可渲染课程。请先生成或注册一个 lesson。</p>
      </div>
    );
  }

  const safePageIndex = Math.min(selectedPageIndex, Math.max(selectedLesson.pages.length - 1, 0));
  const currentPage = selectedLesson.pages[safePageIndex];
  const currentPageContext = {
    title: currentPage?.title ?? "课程页面",
    learningGoal: currentPage?.learningGoal ?? "继续学习当前单元",
    pageNumber: safePageIndex + 1,
    totalPages: selectedLesson.pages.length,
    sourceAnchorIds: currentPage?.sourceAnchorIds ?? []
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f4f7fb] text-slate-950">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <LearningSidebar
          activeView={activeView}
          coursePacks={coursePacks}
          currentPage={currentPageContext}
          lessonChoices={lessonChoices}
          onSelectCourse={selectCoursePack}
          onSelectLesson={selectLesson}
          onSelectView={setActiveView}
          selectedCoursePackId={selectedCoursePackId}
          selectedLessonId={selectedLessonId}
          title={selectedCoursePack?.title ?? selectedLesson.title}
        />

        <main className="h-full min-h-0 overflow-hidden" data-testid="learning-main-viewport">
          {renderWorkspaceView({
            activeView,
            coursePacks,
            currentPageSourceAnchorIds: currentPageContext.sourceAnchorIds,
            lessons,
            onSelectCourse: selectCoursePack,
            onSelectLesson: selectLesson,
            onPageChange: (pageIndex) => {
              setSelectedPageIndex(pageIndex);
              updateRoute(selectedCoursePackId, selectedLessonId, pageIndex);
            },
            selectedCoursePack,
            selectedCoursePackId,
            selectedCoursePackUnits,
            selectedLesson,
            selectedPageIndex: safePageIndex
          })}
        </main>
      </div>
    </div>
  );
}

type RenderWorkspaceViewInput = {
  activeView: WorkspaceView;
  coursePacks: CoursePackRegistryEntry[];
  currentPageSourceAnchorIds: string[];
  lessons: LessonRegistryEntry[];
  onPageChange: (pageIndex: number) => void;
  onSelectCourse: (coursePackId: string) => void;
  onSelectLesson: (lessonId: string) => void;
  selectedCoursePack: CoursePackRegistryEntry["coursePack"] | undefined;
  selectedCoursePackId: string;
  selectedCoursePackUnits: Array<{ unit: CoursePackRegistryEntry["coursePack"]["units"][number]; lessonAvailable: boolean }>;
  selectedLesson: LessonRegistryEntry["lesson"];
  selectedPageIndex: number;
};

function renderWorkspaceView(input: RenderWorkspaceViewInput) {
  if (input.activeView === "library") {
    return (
      <div className="h-full overflow-y-auto">
        <ProjectLibrary
          coursePacks={input.coursePacks}
          onSelectCourse={input.onSelectCourse}
          selectedCoursePackId={input.selectedCoursePackId}
        />
      </div>
    );
  }

  if (input.activeView === "structure" && input.selectedCoursePack && input.selectedCoursePackUnits.length > 0) {
    return (
      <div className="h-full overflow-y-auto p-5">
        <CourseShell
          coursePack={input.selectedCoursePack}
          onSelectLesson={input.onSelectLesson}
          selectedLessonId={input.selectedLesson.id}
          units={input.selectedCoursePackUnits}
        />
      </div>
    );
  }

  if (input.activeView === "sources") {
    return <SourcePanel anchorIds={input.currentPageSourceAnchorIds} title={input.selectedLesson.title} />;
  }

  if (input.selectedCoursePack && input.activeView === "map") {
    return (
      <div className="h-full overflow-hidden">
        <CanvasMapRenderer
          coursePack={input.selectedCoursePack}
          onSelectLesson={input.onSelectLesson}
          selectedLessonId={input.selectedLesson.id}
        />
      </div>
    );
  }

  if (input.activeView === "assessment" || input.activeView === "teacher" || input.activeView === "playground" || input.activeView === "tutor") {
    return (
      <div className="h-full overflow-y-auto">
        <LearningProductRenderer lesson={input.selectedLesson} mode={input.activeView} />
      </div>
    );
  }

  return (
    <WebDeckRenderer
      initialPageIndex={input.selectedPageIndex}
      lesson={input.selectedLesson}
      onPageChange={input.onPageChange}
    />
  );
}

function SourcePanel({ anchorIds, title }: { anchorIds: string[]; title: string }) {
  return (
    <section className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase text-emerald-700">来源依据</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          来源依据从教学页中移到这里，避免学习页面为了展示锚点而产生纵向滚动。
        </p>
        <div className="mt-4 grid gap-2">
          {anchorIds.length > 0 ? (
            anchorIds.map((anchorId) => (
              <span
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900"
                key={anchorId}
              >
                {anchorId}
              </span>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">
              当前页面没有声明来源锚点。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function pickDefaultCoursePack(coursePacks: CoursePackRegistryEntry[], preferredCourseId: string | undefined): CoursePackRegistryEntry | undefined {
  return coursePacks.find((entry) => entry.id === preferredCourseId) ?? coursePacks.find((entry) => entry.id !== "demo-course-pack") ?? coursePacks[0];
}

function pickDefaultUnit(coursePack: CoursePackRegistryEntry["coursePack"] | undefined, preferredUnitId: string | undefined) {
  return coursePack?.units.find((unit) => unit.unitId === preferredUnitId && unit.lessonId);
}
