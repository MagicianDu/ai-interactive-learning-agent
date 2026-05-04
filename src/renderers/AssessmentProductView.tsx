import { useState } from "react";

import type { Lesson, LessonPage } from "../schemas/lesson.schema";
import { ModeHeader, Panel } from "./product-view-common";

export function AssessmentProductView({ lesson }: { lesson: Lesson }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const assessmentPages = lesson.pages.filter((page) => page.assessmentSpec);
  const completedCount = Object.keys(answers).length;

  return (
    <>
      <ModeHeader
        meta={`${completedCount}/${assessmentPages.length} 个检查点已作答`}
        subtitle={lesson.title}
        title="练习模式"
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <section className="grid gap-3">
          <Panel title="掌握度路径">
            <div className="grid gap-2 text-sm leading-6 text-slate-700 sm:grid-cols-3">
              <p className="rounded-md bg-sky-50 p-3 font-semibold text-sky-900">先做预测题，暴露当前心智模型。</p>
              <p className="rounded-md bg-amber-50 p-3 font-semibold text-amber-900">再看误区反馈，修正错误假设。</p>
              <p className="rounded-md bg-emerald-50 p-3 font-semibold text-emerald-900">最后做迁移任务，确认能换场景使用。</p>
            </div>
          </Panel>
          {assessmentPages.map((page) => (
            <AssessmentCard
              answer={answers[page.id]}
              key={page.id}
              onAnswer={(answer) => setAnswers((current) => ({ ...current, [page.id]: answer }))}
              page={page}
            />
          ))}
        </section>
        <aside className="grid content-start gap-3">
          <Panel title="误区检查">
            {lesson.misconceptions.map((misconception) => (
              <div className="rounded-md bg-slate-50 p-3 text-sm leading-6" key={misconception.id}>
                <p className="font-semibold text-slate-900">{misconception.statement}</p>
                <p className="mt-1 text-slate-600">{misconception.correction}</p>
              </div>
            ))}
          </Panel>
          <Panel title="迁移任务">
            {lesson.transferTasks.map((task) => (
              <div className="rounded-md bg-slate-50 p-3 text-sm leading-6" key={task.id}>
                <p className="font-semibold text-slate-900">{task.prompt}</p>
                <p className="mt-1 text-slate-600">{task.targetMentalModel}</p>
              </div>
            ))}
          </Panel>
        </aside>
      </div>
    </>
  );
}

function AssessmentCard({ answer, onAnswer, page }: { answer?: string; onAnswer: (answer: string) => void; page: LessonPage }) {
  const options = page.assessmentSpec?.options ?? [];
  const isCorrect = answer !== undefined && answer === page.assessmentSpec?.correctAnswer;
  const feedback = isCorrect ? page.feedbackSpec?.correctFeedback : page.feedbackSpec?.incorrectFeedback;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{page.assessmentSpec?.kind ?? page.type}</p>
      <h3 className="mt-1 text-base font-bold text-slate-950">{page.title}</h3>
      <p className="mt-3 text-sm font-semibold text-slate-800">{page.assessmentSpec?.prompt}</p>
      {options.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              aria-pressed={answer === option}
              className={[
                "rounded-md border px-3 py-2 text-sm font-semibold transition",
                answer === option ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
              ].join(" ")}
              key={option}
              onClick={() => onAnswer(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      {answer !== undefined ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          <p className="font-bold text-slate-950">{isCorrect ? "反馈：回答正确" : "反馈：继续调整心智模型"}</p>
          <p className="mt-1">为什么：{feedback}</p>
        </div>
      ) : page.feedbackSpec ? (
        <div className="mt-3 grid gap-1 text-sm leading-6 text-slate-600">
          <p>答对：{page.feedbackSpec.correctFeedback}</p>
          <p>答错：{page.feedbackSpec.incorrectFeedback}</p>
        </div>
      ) : null}
    </article>
  );
}
