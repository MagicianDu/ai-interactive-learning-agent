import type { CoursePack } from "../../schemas/course-pack.schema";

type CoverageStatus = "covered" | "partial" | "deferred" | "omitted";

type CoverageItem = {
  id: string;
  status: CoverageStatus;
  unitIds: string[];
  notes?: string;
};

type CourseCoveragePanelProps = {
  coursePack: CoursePack;
};

const statusLabel: Record<CoverageStatus, string> = {
  covered: "已覆盖",
  partial: "部分覆盖",
  deferred: "延后",
  omitted: "省略"
};

function CoverageList({ items, title }: { items: CoverageItem[]; title: string }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 grid gap-2">
          {items.map((item) => (
            <li className="rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words font-semibold text-slate-800">{item.id}</span>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600">
                  {statusLabel[item.status]}
                </span>
              </div>
              <p className="mt-1">
                对应单元：{item.unitIds.length} 个{item.notes ? ` · ${item.notes}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-500">暂无覆盖信息。</p>
      )}
    </section>
  );
}

export function CourseCoveragePanel({ coursePack }: CourseCoveragePanelProps) {
  const sourceItems =
    coursePack.sourceCoverage?.map((entry) => ({
      id: entry.sourceNodeId,
      status: entry.status,
      unitIds: entry.unitIds,
      notes: entry.notes
    })) ?? [];
  const conceptItems =
    coursePack.conceptCoverage?.map((entry) => ({
      id: entry.conceptId,
      status: entry.status,
      unitIds: entry.unitIds,
      notes: entry.notes
    })) ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-4">
        <CoverageList items={sourceItems} title="来源覆盖" />
        <CoverageList items={conceptItems} title="概念覆盖" />
      </div>
    </section>
  );
}
