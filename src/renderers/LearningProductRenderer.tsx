import type { Lesson } from "../schemas/lesson.schema";
import { AssessmentProductView } from "./AssessmentProductView";
import { PlaygroundProductView } from "./PlaygroundProductView";
import { TeacherProductView } from "./TeacherProductView";
import { TutorProductView } from "./TutorProductView";

export type LearningProductMode = "assessment" | "teacher" | "playground" | "tutor";

type LearningProductRendererProps = {
  lesson: Lesson;
  mode: LearningProductMode;
};

export function LearningProductRenderer({ lesson, mode }: LearningProductRendererProps) {
  return (
    <section className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-slate-900 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-5">
        {mode === "assessment" ? <AssessmentProductView lesson={lesson} /> : null}
        {mode === "teacher" ? <TeacherProductView lesson={lesson} /> : null}
        {mode === "playground" ? <PlaygroundProductView lesson={lesson} /> : null}
        {mode === "tutor" ? <TutorProductView lesson={lesson} /> : null}
      </div>
    </section>
  );
}
