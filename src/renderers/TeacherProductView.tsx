import type { Lesson } from "../schemas/lesson.schema";
import { ModeHeader, Panel } from "./product-view-common";

export function TeacherProductView({ lesson }: { lesson: Lesson }) {
  const outline = buildTeachingOutline(lesson);

  return (
    <>
      <ModeHeader meta="面向讲授、工作坊和组内分享的教学材料" subtitle={lesson.title} title="教师模式" />
      <div className="flex justify-end">
        <button
          className="rounded-md bg-[#0e2f57] px-3 py-2 text-sm font-bold text-white hover:bg-[#16446f]"
          onClick={() => void navigator.clipboard?.writeText(outline)}
          type="button"
        >
          复制教学提纲
        </button>
      </div>
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
        <Panel title="45 分钟建议节奏">
          <ol className="grid gap-2 text-sm leading-6 text-slate-700">
            {lesson.pages.slice(0, 6).map((page, index) => (
              <li className="rounded-md bg-slate-50 p-3" key={page.id}>
                第 {index + 1} 段：{page.title}，聚焦 {page.learningGoal}
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
        <Panel title="常见误区处理">
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

function buildTeachingOutline(lesson: Lesson): string {
  return [
    `课程标题：${lesson.title}`,
    "",
    "学习目标",
    ...lesson.learningObjectives.map((objective) => `- ${objective}`),
    "",
    "页面节奏",
    ...lesson.pages.map((page, index) => `${index + 1}. ${page.title}：${page.learningGoal}`),
    "",
    "课堂提问",
    ...lesson.pages.filter((page) => page.assessmentSpec).map((page) => `- ${page.assessmentSpec?.prompt}`),
    "",
    "误区提醒",
    ...lesson.misconceptions.map((item) => `- ${item.statement} -> ${item.correction}`),
    "",
    "迁移任务",
    ...lesson.transferTasks.map((task) => `- ${task.prompt}`)
  ].join("\n");
}
