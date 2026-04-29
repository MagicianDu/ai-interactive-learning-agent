import type { CoursePack } from "../../schemas/course-pack.schema";

type SourceMappingPanelProps = {
  coursePack: CoursePack;
};

export function SourceMappingPanel({ coursePack }: SourceMappingPanelProps) {
  const mappings =
    coursePack.chapterMapping && coursePack.chapterMapping.length > 0
      ? coursePack.chapterMapping
      : coursePack.units.flatMap((unit) => {
          if (unit.chapterRefs && unit.chapterRefs.length > 0) {
            return unit.chapterRefs.map((chapterRef) => ({
              chapterId: `${unit.unitId}:${chapterRef}`,
              title: chapterRef,
              unitIds: [unit.unitId],
              anchorIds: unit.sourceAnchorIds
            }));
          }

          if (unit.sourceAnchorIds.length === 0) {
            return [];
          }

          return [
            {
              chapterId: `${unit.unitId}:source-anchors`,
              title: `${unit.title} · 来源锚点`,
              unitIds: [unit.unitId],
              anchorIds: unit.sourceAnchorIds
            }
          ];
        });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">来源映射</h2>
      {mappings.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {mappings.map((mapping) => {
            const unitTitles = mapping.unitIds
              .map((unitId) => coursePack.units.find((unit) => unit.unitId === unitId)?.title ?? unitId)
              .join("、");

            return (
              <li className="rounded-md bg-slate-50 p-3 text-sm" key={mapping.chapterId}>
                <span className="block font-semibold text-slate-800">{mapping.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  对应单元：{unitTitles || "未分配"} · anchors: {mapping.anchorIds.length}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-500">当前课程包还没有来源映射。生成或修订 curriculum-plan 后会显示章节、来源节点和单元关系。</p>
      )}
    </section>
  );
}
