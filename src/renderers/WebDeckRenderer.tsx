import type { Lesson } from "../schemas/lesson.schema";
import { AssessmentRenderer } from "../components/assessment/AssessmentRenderer";
import { CodeBlock } from "../components/common/CodeBlock";
import { ConceptCard } from "../components/common/ConceptCard";
import { DeckPage } from "../components/deck/DeckPage";
import { DeckShell } from "../components/deck/DeckShell";
import { InteractionRenderer } from "../components/interaction/InteractionRenderer";
import { VisualRenderer } from "../components/visual/VisualRenderer";

type WebDeckRendererProps = {
  lesson: Lesson;
};

export function WebDeckRenderer({ lesson }: WebDeckRendererProps) {
  return (
    <DeckShell
      lesson={lesson}
      renderPage={(currentIndex) => {
        const page = lesson.pages[currentIndex];

        if (!page) {
          return (
            <div className="rounded-lg border border-line bg-white p-8 shadow-lesson">
              <h2 className="text-2xl font-semibold text-ink">课程页面不可用</h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                渲染器找不到第 {currentIndex + 1} 页。请检查 lesson 页面顺序后重试。
              </p>
            </div>
          );
        }

        return (
          <DeckPage
            page={page}
            pageNumber={currentIndex + 1}
            totalPages={lesson.pages.length}
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
              <VisualRenderer title={page.title} visualSpec={page.visualSpec} />

              <div className="grid content-start gap-4">
                <InteractionRenderer interactionSpec={page.interactionSpec} />

                {page.assessmentSpec ? (
                  <AssessmentRenderer
                    assessmentSpec={page.assessmentSpec}
                    feedbackSpec={page.feedbackSpec}
                  />
                ) : null}

                {page.code ? (
                  <CodeBlock language={page.code.language} value={page.code.value} />
                ) : null}

                {page.type === "summary_card" ? (
                  <ConceptCard title="记住这张心智模型卡" items={lesson.summary} />
                ) : null}

                {!page.interactionSpec && !page.assessmentSpec && !page.code && page.type !== "summary_card" ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-slate-700">
                    <p className="text-sm font-semibold text-slate-500">互动或评估待补充</p>
                    <p className="mt-2 text-sm leading-6">
                      当前页面还没有生成 interactionSpec、assessmentSpec 或 code。请在后续设计中补充学习者动作、检查题或代码走读。
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </DeckPage>
        );
      }}
    />
  );
}
