import { useState } from "react";

import type { Lesson, LessonPage } from "../schemas/lesson.schema";
import { ModeHeader, Panel } from "./product-view-common";

type TutorIntent = "confused" | "example" | "quiz";

const intentLabels: Record<TutorIntent, string> = {
  confused: "我不理解",
  example: "给我例子",
  quiz: "考考我"
};

export function TutorProductView({ lesson }: { lesson: Lesson }) {
  return (
    <>
      <ModeHeader meta="本地模拟导师：根据当前课程页生成固定辅导话术，不调用实时大模型。" subtitle={lesson.title} title="导师模式" />
      <Panel title="当前页辅导策略">
        <div className="grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-3">
          <p className="rounded-md bg-slate-50 p-3">围绕页面学习目标提问，避免脱离当前视觉和互动对象。</p>
          <p className="rounded-md bg-slate-50 p-3">先诊断困惑，再补例子，最后用小测检查。</p>
          <p className="rounded-md bg-slate-50 p-3">回答必须回到“发生了什么、为什么、如何迁移”。</p>
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
        {lesson.pages.slice(0, 6).map((page) => (
          <TutorCard key={page.id} page={page} />
        ))}
      </div>
    </>
  );
}

function TutorCard({ page }: { page: LessonPage }) {
  const [intent, setIntent] = useState<TutorIntent>("confused");

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{page.type}</p>
      <h3 className="mt-1 text-base font-bold text-slate-950">{page.title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(intentLabels) as TutorIntent[]).map((item) => (
          <button
            className={[
              "rounded-md border px-3 py-1.5 text-xs font-bold",
              intent === item ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600"
            ].join(" ")}
            key={item}
            onClick={() => setIntent(item)}
            type="button"
          >
            {intentLabels[item]}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">
        <p>{responseForIntent(page, intent)}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">你会怎样解释：{page.learningGoal}</p>
    </article>
  );
}

function responseForIntent(page: LessonPage, intent: TutorIntent): string {
  if (intent === "example") {
    return `例子：先看这页的情境，“${page.narrative}”。把它改写成你熟悉的项目场景，再找对应的因果关系。`;
  }
  if (intent === "quiz") {
    return page.assessmentSpec?.prompt ?? `考考你：如果只能保留一个关键点，你会怎样解释“${page.learningGoal}”？`;
  }
  return `先别急着背定义。回到这页目标：${page.learningGoal}。你需要先说清楚发生了什么、为什么发生、结果会怎样变化。`;
}
