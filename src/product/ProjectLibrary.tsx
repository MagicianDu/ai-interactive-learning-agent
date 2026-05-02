import type { CoursePackRegistryEntry } from "../course-packs/registry";

type ProjectLibraryProps = {
  coursePacks: CoursePackRegistryEntry[];
  selectedCoursePackId: string;
  onSelectCourse: (coursePackId: string) => void;
};

export function ProjectLibrary({ coursePacks, selectedCoursePackId, onSelectCourse }: ProjectLibraryProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-5 sm:px-8 lg:px-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">学习项目</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">选择要继续学习的课程</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {coursePacks.map((entry) => (
          <article
            className={[
              "rounded-lg border bg-white p-4 shadow-sm",
              selectedCoursePackId === entry.id ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"
            ].join(" ")}
            key={entry.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950">{entry.label}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {entry.sourceKind ?? "unknown"} · {entry.strategy ?? "course"} · {entry.unitCount} 个单元
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                {statusLabel(entry.projectStatus)}
              </span>
            </div>
            <button
              className="mt-4 rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
              onClick={() => onSelectCourse(entry.id)}
              type="button"
            >
              打开 {entry.label}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function statusLabel(status: CoursePackRegistryEntry["projectStatus"]): string {
  if (status === "sample") {
    return "样例";
  }
  if (status === "generated") {
    return "已生成";
  }
  return "可学习";
}
