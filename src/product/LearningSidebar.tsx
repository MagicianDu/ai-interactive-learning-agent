import { BookOpen, CheckCircle2, FolderOpen, Layers3, MessageSquareText } from "lucide-react";

import type { CoursePackRegistryEntry } from "../course-packs/registry";
import { pageFeedbackOptions, type PageFeedbackOption, type PageFeedbackRevisionBrief, type RevisionHistoryItem } from "./learning-progress";
import { productModeTabs, type CourseView } from "./ProductModeTabs";

export type WorkspaceView = CourseView | "library" | "structure" | "sources";

type LessonChoice = {
  id: string;
  label: string;
};

type CurrentPageContext = {
  title: string;
  learningGoal: string;
  pageNumber: number;
  totalPages: number;
  sourceAnchorIds: string[];
};

type LearningSidebarProps = {
  activeView: WorkspaceView;
  coursePacks: CoursePackRegistryEntry[];
  currentPage: CurrentPageContext;
  latestFeedback?: PageFeedbackRevisionBrief;
  lessonChoices: LessonChoice[];
  onSubmitFeedback: (option: PageFeedbackOption) => void;
  onSelectCourse: (coursePackId: string) => void;
  onSelectLesson: (lessonId: string) => void;
  onSelectView: (view: WorkspaceView) => void;
  progress: {
    completedPages: number;
    totalPages: number;
    quizAttempts: number;
  };
  revisionHistory: RevisionHistoryItem[];
  selectedCoursePackId: string;
  selectedLessonId: string;
  title: string;
};

export function LearningSidebar({
  activeView,
  coursePacks,
  currentPage,
  latestFeedback,
  lessonChoices,
  onSubmitFeedback,
  onSelectCourse,
  onSelectLesson,
  onSelectView,
  progress,
  revisionHistory,
  selectedCoursePackId,
  selectedLessonId,
  title
}: LearningSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white text-slate-950">
      <div className="border-b border-slate-200 px-4 py-4">
        <p className="text-xs font-bold uppercase text-slate-500">学习中</p>
        <h1 className="mt-1 line-clamp-2 text-lg font-bold leading-6">{title}</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          学习项目
          <select
            aria-label="选择学习项目"
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
            onChange={(event) => onSelectCourse(event.target.value)}
            value={selectedCoursePackId}
          >
            {coursePacks.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        {lessonChoices.length > 0 ? (
          <label className="mt-3 grid gap-1 text-xs font-bold text-slate-600">
            课程单元
            <select
              aria-label="选择课程单元"
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
              onChange={(event) => onSelectLesson(event.target.value)}
              value={selectedLessonId}
            >
              {lessonChoices.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav aria-label="学习功能" className="mt-4 grid gap-2">
          {productModeTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                aria-label={tab.label}
                aria-pressed={activeView === tab.id}
                className={navButtonClass(activeView === tab.id)}
                key={tab.id}
                onClick={() => onSelectView(tab.id)}
                type="button"
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{tab.label}</span>
                  <span className="block truncate text-xs font-medium text-slate-500">{tab.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4">
          <button
            aria-label="课程结构"
            aria-pressed={activeView === "structure"}
            className={navButtonClass(activeView === "structure")}
            onClick={() => onSelectView("structure")}
            type="button"
          >
            <Layers3 aria-hidden className="size-4 shrink-0" />
            <span>
              <span className="block text-sm font-bold">课程结构</span>
              <span className="block text-xs font-medium text-slate-500">单元、章节、覆盖</span>
            </span>
          </button>
          <button
            aria-label="来源依据"
            aria-pressed={activeView === "sources"}
            className={navButtonClass(activeView === "sources")}
            onClick={() => onSelectView("sources")}
            type="button"
          >
            <BookOpen aria-hidden className="size-4 shrink-0" />
            <span>
              <span className="block text-sm font-bold">来源依据</span>
              <span className="block text-xs font-medium text-slate-500">当前页锚点</span>
            </span>
          </button>
          <button
            aria-label="项目库"
            aria-pressed={activeView === "library"}
            className={navButtonClass(activeView === "library")}
            onClick={() => onSelectView("library")}
            type="button"
          >
            <FolderOpen aria-hidden className="size-4 shrink-0" />
            <span>
              <span className="block text-sm font-bold">项目库</span>
              <span className="block text-xs font-medium text-slate-500">切换学习项目</span>
            </span>
          </button>
        </div>
      </div>

      <section className="border-t border-slate-200 px-4 py-3">
        <p className="text-xs font-bold text-slate-500">
          第 {currentPage.pageNumber} / {currentPage.totalPages} 页
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-950">{currentPage.title}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{currentPage.learningGoal}</p>
        <div className="mt-3 grid gap-2">
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-600">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 aria-hidden className="size-3.5" />
                完成进度
              </span>
              <span>
                {progress.completedPages}/{progress.totalPages}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progressPercent(progress.completedPages, progress.totalPages)}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">答题记录 {progress.quizAttempts}</p>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
              <MessageSquareText aria-hidden className="size-3.5" />
              本页反馈
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {pageFeedbackOptions.map((option) => (
                <button
                  className="min-h-8 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                  key={option.id}
                  onClick={() => onSubmitFeedback(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {latestFeedback ? (
              <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-semibold leading-5 text-emerald-800">
                已记录：第 {latestFeedback.pageNumber} 页，{feedbackLabel(latestFeedback.option)}
              </p>
            ) : null}
          </div>

          <p className="text-xs font-semibold text-emerald-700">来源锚点 {currentPage.sourceAnchorIds.length}</p>
          {revisionHistory.length > 0 ? (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold text-slate-600">修订历史</p>
              <div className="mt-2 grid gap-2">
                {revisionHistory.slice(0, 3).map((item) => (
                  <div className="rounded-md bg-slate-50 px-2 py-2" key={`${item.runId}:${item.revisionId}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">{item.revisionId}</span>
                      <span className="text-[11px] font-bold text-emerald-700">质量：{item.qualityStatus}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{item.summary}</p>
                    {item.changedPages.length > 0 ? (
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        修改页：{item.changedPages.map((page) => `第 ${page.pageNumber} 页`).join("、")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </aside>
  );
}

function navButtonClass(active: boolean): string {
  return [
    "flex min-h-12 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition",
    active ? "border-sky-300 bg-sky-50 text-sky-900" : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
  ].join(" ");
}

function progressPercent(completedPages: number, totalPages: number): number {
  if (totalPages <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((completedPages / totalPages) * 100));
}

function feedbackLabel(option: PageFeedbackOption): string {
  return pageFeedbackOptions.find((item) => item.id === option)?.label ?? "已反馈";
}
