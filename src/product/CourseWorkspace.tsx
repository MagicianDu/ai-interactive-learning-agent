import { useEffect, useMemo, useState } from "react";

import { CourseShell } from "../components/course/CourseShell";
import type { CoursePackRegistryEntry } from "../course-packs/registry";
import type { LessonRegistryEntry } from "../lessons/registry";
import { CanvasMapRenderer } from "../renderers/CanvasMapRenderer";
import { LearningProductRenderer } from "../renderers/LearningProductRenderer";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";
import { fetchGeneratedPreview, type GeneratedPreviewLoadResult } from "./generated-preview";
import {
  loadLearningProgress,
  recordPageVisit,
  saveLearningProgress
} from "./learning-progress";
import { LearningSidebar, type WorkspaceView } from "./LearningSidebar";
import { ProjectLibrary } from "./ProjectLibrary";
import { buildProductRoute, parseProductRoute } from "./product-route";

type CourseWorkspaceProps = {
  lessons: LessonRegistryEntry[];
  coursePacks: CoursePackRegistryEntry[];
};

export function CourseWorkspace({ lessons, coursePacks }: CourseWorkspaceProps) {
  const [currentRoute, setCurrentRoute] = useState(() => readCurrentProductRoute());
  const [generatedPreview, setGeneratedPreview] = useState<GeneratedPreviewLoadResult | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(Boolean(currentRoute.previewRunId));
  const workspaceLessons = useMemo(
    () => mergeLessons(lessons, generatedPreview?.lessonEntries ?? []),
    [generatedPreview?.lessonEntries, lessons]
  );
  const workspaceCoursePacks = useMemo(
    () => mergeCoursePacks(coursePacks, generatedPreview ? [generatedPreview.coursePackEntry] : []),
    [coursePacks, generatedPreview]
  );
  const defaultLesson = workspaceLessons[0];
  const defaultCoursePack = pickDefaultCoursePack(workspaceCoursePacks, currentRoute.courseId ?? currentRoute.previewRunId);
  const defaultUnit = pickDefaultUnit(defaultCoursePack?.coursePack, currentRoute.unitId);
  const defaultCoursePackLessonId = defaultUnit?.lessonId ?? defaultCoursePack?.coursePack.units.find((unit) => unit.lessonId)?.lessonId;
  const [selectedCoursePackId, setSelectedCoursePackId] = useState(defaultCoursePack?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState(defaultCoursePackLessonId ?? defaultLesson?.id ?? "");
  const [selectedPageIndex, setSelectedPageIndex] = useState(currentRoute.pageIndex ?? 0);
  const [activeView, setActiveView] = useState<WorkspaceView>("deck");
  const [, setLearningProgress] = useState(() => loadLearningProgress());
  const selectedLesson = workspaceLessons.find((lesson) => lesson.id === selectedLessonId)?.lesson ?? defaultLesson?.lesson;
  const selectedCoursePack = workspaceCoursePacks.find((entry) => entry.id === selectedCoursePackId)?.coursePack;
  const selectedCoursePackUnits =
    selectedCoursePack?.units
      .map((unit) => ({
        unit,
        lessonAvailable: Boolean(unit.lessonId && workspaceLessons.some((entry) => entry.id === unit.lessonId))
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

  useEffect(() => {
    const syncRoute = () => setCurrentRoute(readCurrentProductRoute());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    const previewRunId = currentRoute.previewRunId;
    if (!previewRunId) {
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    fetchGeneratedPreview(previewRunId)
      .then((preview) => {
        if (cancelled) {
          return;
        }
        setGeneratedPreview(preview);
        setPreviewError(undefined);
        const nextCoursePack = preview.coursePackEntry.coursePack;
        const nextUnit = pickDefaultUnit(nextCoursePack, currentRoute.unitId) ?? nextCoursePack.units.find((unit) => unit.lessonId);
        const nextLessonId = nextUnit?.lessonId ?? preview.lessonEntries[0]?.id;
        setSelectedCoursePackId(nextCoursePack.id);
        if (nextLessonId) {
          setSelectedLessonId(nextLessonId);
        }
        setSelectedPageIndex(currentRoute.pageIndex ?? 0);
        setActiveView("deck");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setPreviewError(error instanceof Error ? error.message : "generated preview load failed");
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentRoute.pageIndex, currentRoute.previewRunId, currentRoute.unitId]);

  const updateRoute = (courseId: string, lessonId: string, pageIndex: number) => {
    const coursePack = workspaceCoursePacks.find((entry) => entry.id === courseId)?.coursePack;
    const unitId = coursePack?.units.find((unit) => unit.lessonId === lessonId)?.unitId;
    const nextRoute =
      generatedPreview?.coursePackEntry.id === courseId
        ? buildProductRoute({ previewRunId: generatedPreview.previewRunId, unitId, pageIndex })
        : buildProductRoute({ courseId, unitId, pageIndex });
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
    const nextCoursePack = workspaceCoursePacks.find((entry) => entry.id === coursePackId)?.coursePack;
    setSelectedCoursePackId(coursePackId);
    const firstUnitLessonId = nextCoursePack?.units.find((unit) => unit.lessonId)?.lessonId;
    if (firstUnitLessonId) {
      setSelectedLessonId(firstUnitLessonId);
      setSelectedPageIndex(0);
      setActiveView("deck");
      updateRoute(coursePackId, firstUnitLessonId, 0);
    }
  };

  const safePageIndex = selectedLesson ? Math.min(selectedPageIndex, Math.max(selectedLesson.pages.length - 1, 0)) : 0;
  const currentPage = selectedLesson?.pages[safePageIndex];
  const currentPageContext = {
    title: currentPage?.title ?? "课程页面",
    learningGoal: currentPage?.learningGoal ?? "继续学习当前单元",
    pageNumber: safePageIndex + 1,
    totalPages: selectedLesson?.pages.length ?? 0,
    sourceAnchorIds: currentPage?.sourceAnchorIds ?? []
  };
  const selectedCoursePackUnit = selectedCoursePack?.units.find((unit) => unit.lessonId === selectedLesson?.id);
  const selectedGeneratedPreview = generatedPreview?.coursePackEntry.id === selectedCoursePackId ? generatedPreview : undefined;

  useEffect(() => {
    if (!selectedCoursePackId || !selectedLesson?.id || !currentPage?.id) {
      return;
    }
    setLearningProgress((previous) => {
      const next = recordPageVisit(previous, {
        courseId: selectedCoursePackId,
        unitId: selectedCoursePackUnit?.unitId,
        lessonId: selectedLesson.id,
        pageId: currentPage.id,
        pageIndex: safePageIndex
      });
      saveLearningProgress(next);
      return next;
    });
  }, [currentPage?.id, safePageIndex, selectedCoursePackId, selectedCoursePackUnit?.unitId, selectedLesson.id]);

  if (previewLoading && currentRoute.previewRunId) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 text-center text-white">
        <p className="max-w-md text-sm text-slate-300">正在读取本地生成的课程预览...</p>
      </div>
    );
  }

  if (previewError) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 text-center text-white">
        <div className="max-w-lg rounded-lg border border-red-400/40 bg-red-950/40 p-5">
          <p className="text-sm font-bold text-red-100">生成预览读取失败</p>
          <p className="mt-2 text-sm leading-6 text-red-100/80">{previewError}</p>
        </div>
      </div>
    );
  }

  if (!selectedLesson) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 text-center text-white">
        <p className="max-w-md text-sm text-slate-300">没有发现可渲染课程。请先生成或注册一个 lesson。</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f4f7fb] text-slate-950">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden min-h-0 lg:block" data-testid="desktop-learning-sidebar">
          <LearningSidebar
            activeView={activeView}
            coursePacks={workspaceCoursePacks}
            lessonChoices={lessonChoices}
            onSelectCourse={selectCoursePack}
            onSelectLesson={selectLesson}
            onSelectView={setActiveView}
            selectedCoursePackId={selectedCoursePackId}
            selectedLessonId={selectedLessonId}
            title={selectedCoursePack?.title ?? selectedLesson.title}
          />
        </div>

        <main className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" data-testid="learning-main-viewport">
          <WorkspaceStatusStrip
            activeView={activeView}
            coursePack={selectedCoursePack}
            pageNumber={currentPageContext.pageNumber}
            publishNotes={selectedGeneratedPreview?.publishNotes}
            qualityReport={selectedGeneratedPreview?.qualityReport}
            selectedUnit={selectedCoursePackUnit}
            totalPages={currentPageContext.totalPages}
          />
          <div className="min-h-0 overflow-hidden">
            {renderWorkspaceView({
              activeView,
              coursePacks: workspaceCoursePacks,
              currentPageSourceAnchorIds: currentPageContext.sourceAnchorIds,
              lessons: workspaceLessons,
              onSelectCourse: selectCoursePack,
              onSelectLesson: selectLesson,
              onPageChange: (pageIndex) => {
                setSelectedPageIndex(pageIndex);
                updateRoute(selectedCoursePackId, selectedLessonId, pageIndex);
              },
              selectedCoursePack,
              selectedCoursePackId,
              selectedCoursePackUnit,
              selectedCoursePackUnits,
              selectedLesson,
              selectedPageIndex: safePageIndex
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

function readCurrentProductRoute() {
  return parseProductRoute(typeof window === "undefined" ? "" : window.location.hash);
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
  selectedCoursePackUnit: CoursePackRegistryEntry["coursePack"]["units"][number] | undefined;
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
    return (
      <SourcePanel
        anchorIds={input.currentPageSourceAnchorIds}
        coursePack={input.selectedCoursePack}
        selectedUnit={input.selectedCoursePackUnit}
        title={input.selectedLesson.title}
      />
    );
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

function WorkspaceStatusStrip({
  activeView,
  coursePack,
  pageNumber,
  publishNotes,
  qualityReport,
  selectedUnit,
  totalPages
}: {
  activeView: WorkspaceView;
  coursePack: CoursePackRegistryEntry["coursePack"] | undefined;
  pageNumber: number;
  publishNotes?: string;
  qualityReport?: GeneratedPreviewLoadResult["qualityReport"];
  selectedUnit: CoursePackRegistryEntry["coursePack"]["units"][number] | undefined;
  totalPages: number;
}) {
  return (
    <section
      className="hidden border-b border-slate-200 bg-white px-4 py-3 lg:block"
      data-testid="workspace-status-strip"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-slate-500">当前学习单元</p>
          <h2 className="truncate text-sm font-bold text-slate-950">{selectedUnit?.title ?? coursePack?.title ?? "独立课程"}</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">视图：{viewLabel(activeView)}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            第 {pageNumber}/{totalPages} 页
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">来源：{coursePack?.sourceKind ?? "topic"}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">策略：{coursePack?.strategy ?? "single_lesson"}</span>
          {qualityReport ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              质量：{qualityReport.status} · {qualityReport.score}
            </span>
          ) : null}
          {publishNotes ? (
            <span className="max-w-72 truncate rounded-full bg-sky-50 px-2.5 py-1 text-sky-700" title={publishNotes}>
              发布：{publishNotes}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SourcePanel({
  anchorIds,
  coursePack,
  selectedUnit,
  title
}: {
  anchorIds: string[];
  coursePack: CoursePackRegistryEntry["coursePack"] | undefined;
  selectedUnit: CoursePackRegistryEntry["coursePack"]["units"][number] | undefined;
  title: string;
}) {
  const courseAnchorIds = coursePack ? Array.from(new Set(coursePack.units.flatMap((unit) => unit.sourceAnchorIds))) : [];
  const sourceCoverage = coursePack?.sourceCoverage ?? [];

  return (
    <section className="h-full overflow-y-auto p-6">
      <div className="mx-auto grid max-w-5xl gap-4">
        <div className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-emerald-700">Grounding</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">来源依据</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {title} 的来源依据集中在这里查看，学习页保持单屏展示。
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SourceList anchorIds={anchorIds} emptyText="当前页面没有声明来源锚点。" title="当前页来源锚点" />
          <SourceList anchorIds={courseAnchorIds} emptyText="当前课程包还没有课程级来源锚点。" title="课程来源覆盖" />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-base font-bold text-slate-950">单元来源映射</h3>
          <div className="mt-3 grid gap-2">
            {coursePack?.units.map((unit) => (
              <article
                className={[
                  "rounded-md border p-3 text-sm",
                  unit.unitId === selectedUnit?.unitId ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-slate-50"
                ].join(" ")}
                key={unit.unitId}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">{unit.title}</p>
                  <p className="text-xs font-semibold text-slate-500">{unit.sourceAnchorIds.length} anchors</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {unit.chapterRefs?.length ? `章节：${unit.chapterRefs.join("、")}` : `概念：${unit.conceptIds.join("、") || "未标注"}`}
                </p>
              </article>
            )) ?? <p className="text-sm font-semibold text-slate-500">独立 lesson 暂无课程包映射。</p>}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-base font-bold text-slate-950">来源覆盖状态</h3>
          <div className="mt-3 grid gap-2">
            {sourceCoverage.length > 0 ? (
              sourceCoverage.map((entry) => (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700" key={entry.sourceNodeId}>
                  {entry.sourceNodeId} · {entry.status} · {entry.unitIds.length} 个单元
                </p>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">
                当前课程包没有显式 sourceCoverage；请以单元锚点为准。
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function SourceList({ anchorIds, emptyText, title }: { anchorIds: string[]; emptyText: string; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
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
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function viewLabel(view: WorkspaceView): string {
  const labels: Record<WorkspaceView, string> = {
    assessment: "练习",
    deck: "学习",
    library: "项目库",
    map: "知识地图",
    playground: "实验",
    sources: "来源依据",
    structure: "课程结构",
    teacher: "教师",
    tutor: "导师"
  };
  return labels[view];
}

function pickDefaultCoursePack(coursePacks: CoursePackRegistryEntry[], preferredCourseId: string | undefined): CoursePackRegistryEntry | undefined {
  return coursePacks.find((entry) => entry.id === preferredCourseId) ?? coursePacks.find((entry) => entry.id === "demo-course-pack") ?? coursePacks[0];
}

function pickDefaultUnit(coursePack: CoursePackRegistryEntry["coursePack"] | undefined, preferredUnitId: string | undefined) {
  return coursePack?.units.find((unit) => unit.unitId === preferredUnitId && unit.lessonId);
}

function mergeCoursePacks(base: CoursePackRegistryEntry[], generated: CoursePackRegistryEntry[]): CoursePackRegistryEntry[] {
  if (generated.length === 0) {
    return base;
  }
  const generatedIds = new Set(generated.map((entry) => entry.id));
  return [...generated, ...base.filter((entry) => !generatedIds.has(entry.id))];
}

function mergeLessons(base: LessonRegistryEntry[], generated: LessonRegistryEntry[]): LessonRegistryEntry[] {
  if (generated.length === 0) {
    return base;
  }
  const generatedIds = new Set(generated.map((entry) => entry.id));
  return [...generated, ...base.filter((entry) => !generatedIds.has(entry.id))];
}
