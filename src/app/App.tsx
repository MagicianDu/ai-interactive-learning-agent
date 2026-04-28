import { useState } from "react";

import { databaseIndexLesson } from "../lessons/database-index/lesson";
import { generatedLesson as hashTableLesson } from "../lessons/hash-table-foundations/lesson";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";

const lessons = [
  {
    id: databaseIndexLesson.id,
    label: databaseIndexLesson.title,
    lesson: databaseIndexLesson
  },
  {
    id: hashTableLesson.id,
    label: hashTableLesson.title,
    lesson: hashTableLesson
  }
];

export function App() {
  const [selectedLessonId, setSelectedLessonId] = useState(databaseIndexLesson.id);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId)?.lesson ?? databaseIndexLesson;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">课程</p>
          <h1 className="text-lg font-semibold">{selectedLesson.title}</h1>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <span className="font-medium">切换课程</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            value={selectedLessonId}
            onChange={(event) => setSelectedLessonId(event.target.value)}
          >
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <WebDeckRenderer lesson={selectedLesson} />
    </div>
  );
}
