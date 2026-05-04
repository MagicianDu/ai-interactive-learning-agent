import { useState } from "react";

import type { InteractionOption, Lesson, LessonPage } from "../schemas/lesson.schema";
import { ModeHeader, Panel } from "./product-view-common";

export function PlaygroundProductView({ lesson }: { lesson: Lesson }) {
  const interactivePages = lesson.pages.filter((page) => page.interactionSpec);

  return (
    <>
      <ModeHeader meta="通过选择、观察和记录，把抽象概念变成可操作模型" subtitle={lesson.title} title="实验模式" />
      <Panel title="实验记录">
        <div className="grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-3">
          <p className="rounded-md bg-slate-50 p-3">选择一个条件或参数，先预测结果。</p>
          <p className="rounded-md bg-slate-50 p-3">观察系统反馈里解释的因果机制。</p>
          <p className="rounded-md bg-slate-50 p-3">把观察写下来，形成可迁移规则。</p>
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        {interactivePages.map((page) => (
          <PlaygroundCard key={page.id} page={page} />
        ))}
      </div>
    </>
  );
}

function PlaygroundCard({ page }: { page: LessonPage }) {
  const options = page.interactionSpec?.options ?? [];
  const [selectedOption, setSelectedOption] = useState<InteractionOption | undefined>(options[0]);
  const [note, setNote] = useState("");

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{page.interactionSpec?.kind}</p>
      <h3 className="mt-1 text-lg font-bold text-slate-950">{page.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{page.interactionSpec?.learnerAction}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            aria-pressed={selectedOption?.id === option.id}
            className={[
              "rounded-md border px-3 py-2 text-sm font-semibold transition",
              selectedOption?.id === option.id
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
            ].join(" ")}
            key={option.id}
            onClick={() => setSelectedOption(option)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {selectedOption ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-bold text-slate-950">{selectedOption.resultTitle}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{selectedOption.explanation}</p>
        </div>
      ) : null}
      <label className="mt-4 grid gap-1 text-sm font-semibold text-slate-700">
        我观察到了什么
        <textarea
          className="min-h-20 rounded-md border border-slate-200 px-3 py-2 font-normal leading-6 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          onChange={(event) => setNote(event.target.value)}
          placeholder="记录你看到的因果变化、例外情况或新问题"
          value={note}
        />
      </label>
    </article>
  );
}
