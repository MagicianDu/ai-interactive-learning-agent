import type { KnowledgeBoard as KnowledgeBoardData } from "../../schemas/lesson.schema";

type KnowledgeBoardProps = {
  board: KnowledgeBoardData;
};

const emphasisClasses = {
  boundary: "border-amber-200 bg-amber-50 text-amber-900",
  definition: "border-sky-200 bg-sky-50 text-sky-900",
  example: "border-emerald-200 bg-emerald-50 text-emerald-900",
  mechanism: "border-indigo-200 bg-indigo-50 text-indigo-900",
  note: "border-slate-200 bg-slate-50 text-slate-800",
};

function boardKindLabel(kind: KnowledgeBoardData["boardKind"]): string {
  const labels: Record<KnowledgeBoardData["boardKind"], string> = {
    boundary_board: "边界板书",
    comparison_board: "比较板书",
    definition_board: "定义板书",
    evidence_board: "证据板书",
    example_board: "例题板书",
    mechanism_board: "机制板书",
    synthesis_board: "综合板书",
  };

  return labels[kind];
}

function BoardColumn({
  ariaLabel,
  sections,
}: {
  ariaLabel: string;
  sections: KnowledgeBoardData["leftColumn"];
}) {
  return (
    <section aria-label={ariaLabel} className="grid min-h-0 gap-3">
      {sections.map((section) => (
        <div
          className="rounded-md border border-line bg-white p-3 shadow-sm lg:p-4"
          key={`${section.label}-${section.items.join("|")}`}
        >
          <div
            className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${emphasisClasses[section.emphasis ?? "note"]}`}
          >
            {section.label}
          </div>
          <ul className="mt-3 grid gap-2 text-sm font-medium leading-6 text-slate-700 lg:text-base lg:leading-7">
            {section.items.map((item) => (
              <li className="flex gap-2" key={item}>
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function KnowledgeBoard({ board }: KnowledgeBoardProps) {
  return (
    <section
      className="grid min-h-0 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:gap-4 lg:p-4"
      data-testid="knowledge-board"
    >
      <div className="grid gap-2 rounded-md border border-line bg-white p-3 lg:p-4">
        <p className="text-xs font-bold text-slate-500">{boardKindLabel(board.boardKind)}</p>
        <h3 className="text-xl font-extrabold leading-tight text-ink lg:text-2xl">{board.headline}</h3>
        <p className="max-w-4xl text-base font-semibold leading-7 text-slate-800 lg:text-lg lg:leading-8">
          {board.coreProposition}
        </p>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-2 lg:gap-4">
        <BoardColumn ariaLabel="知识板书左栏" sections={board.leftColumn} />
        <BoardColumn ariaLabel="知识板书右栏" sections={board.rightColumn} />
      </div>

      <p className="rounded-md border border-slate-900 bg-slate-950 px-3 py-2 text-sm font-bold leading-6 text-white lg:px-4 lg:text-base">
        {board.bottomLine}
      </p>
    </section>
  );
}
