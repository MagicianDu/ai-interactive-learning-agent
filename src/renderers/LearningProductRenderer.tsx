import { useState, type ReactNode } from "react";

import type { InteractionOption, Lesson, LessonPage } from "../schemas/lesson.schema";

export type LearningProductMode = "assessment" | "teacher" | "playground" | "tutor";

type LearningProductRendererProps = {
  lesson: Lesson;
  mode: LearningProductMode;
};

export function LearningProductRenderer({ lesson, mode }: LearningProductRendererProps) {
  return (
    <section className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-slate-900 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-5">
        {mode === "assessment" ? <AssessmentMode lesson={lesson} /> : null}
        {mode === "teacher" ? <TeacherMode lesson={lesson} /> : null}
        {mode === "playground" ? <PlaygroundMode lesson={lesson} /> : null}
        {mode === "tutor" ? <TutorMode lesson={lesson} /> : null}
      </div>
    </section>
  );
}

function AssessmentMode({ lesson }: { lesson: Lesson }) {
  const assessmentPages = lesson.pages.filter((page) => page.assessmentSpec);

  return (
    <>
      <ModeHeader title="练习模式" subtitle={lesson.title} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <section className="grid gap-3">
          {assessmentPages.map((page) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4" key={page.id}>
              <p className="text-xs font-bold uppercase text-slate-500">{page.type}</p>
              <h3 className="mt-1 text-base font-bold text-slate-950">{page.title}</h3>
              <p className="mt-3 text-sm font-semibold text-slate-800">{page.assessmentSpec?.prompt}</p>
              {page.feedbackSpec ? (
                <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                  <p>答对：{page.feedbackSpec.correctFeedback}</p>
                  <p>答错：{page.feedbackSpec.incorrectFeedback}</p>
                </div>
              ) : null}
            </article>
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

function TeacherMode({ lesson }: { lesson: Lesson }) {
  return (
    <>
      <ModeHeader title="教师模式" subtitle={lesson.title} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="教学目标">
          <ul className="grid gap-2 text-sm leading-6 text-slate-700">
            {lesson.learningObjectives.map((objective) => (
              <li className="rounded-md bg-slate-50 p-3" key={objective}>
                {objective}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="建议节奏">
          <ol className="grid gap-2 text-sm leading-6 text-slate-700">
            {lesson.pages.slice(0, 6).map((page, index) => (
              <li className="rounded-md bg-slate-50 p-3" key={page.id}>
                {index + 1}. {page.title}：{page.learningGoal}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="课堂提问">
          <ul className="grid gap-2 text-sm leading-6 text-slate-700">
            {lesson.pages
              .filter((page) => page.assessmentSpec)
              .map((page) => (
                <li className="rounded-md bg-slate-50 p-3" key={page.id}>
                  {page.assessmentSpec?.prompt}
                </li>
              ))}
          </ul>
        </Panel>
        <Panel title="常见误区">
          <ul className="grid gap-2 text-sm leading-6 text-slate-700">
            {lesson.misconceptions.map((misconception) => (
              <li className="rounded-md bg-slate-50 p-3" key={misconception.id}>
                <span className="font-semibold text-slate-900">{misconception.statement}</span>
                <span className="mt-1 block">{misconception.correction}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function PlaygroundMode({ lesson }: { lesson: Lesson }) {
  const interactivePages = lesson.pages.filter((page) => page.interactionSpec);

  return (
    <>
      <ModeHeader title="实验模式" subtitle={lesson.title} />
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
    </article>
  );
}

function TutorMode({ lesson }: { lesson: Lesson }) {
  return (
    <>
      <ModeHeader title="导师模式" subtitle={lesson.title} />
      <div className="grid gap-4 lg:grid-cols-3">
        {lesson.pages.slice(0, 6).map((page) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4" key={page.id}>
            <p className="text-xs font-bold uppercase text-slate-500">{page.type}</p>
            <h3 className="mt-1 text-base font-bold text-slate-950">{page.title}</h3>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
              <p>你会怎样解释：{page.learningGoal}</p>
              <p>如果学习者回答错了，先回到这页的因果机制：{page.narrative}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ModeHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase text-slate-500">学习产品</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2>
      </div>
      <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600">{subtitle}</p>
    </header>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}
