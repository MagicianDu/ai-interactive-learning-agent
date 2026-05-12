import type { Lesson } from "../schemas/lesson.schema";
import { AssessmentRenderer } from "../components/assessment/AssessmentRenderer";
import { CodeBlock } from "../components/common/CodeBlock";
import { ConceptCard } from "../components/common/ConceptCard";
import { DeckPage } from "../components/deck/DeckPage";
import { DeckShell } from "../components/deck/DeckShell";
import { KnowledgeBoard } from "../components/deck/KnowledgeBoard";
import { InteractionRenderer } from "../components/interaction/InteractionRenderer";
import { VisualRenderer } from "../components/visual/VisualRenderer";

type WebDeckRendererProps = {
  initialPageIndex?: number;
  lesson: Lesson;
  onPageChange?: (pageIndex: number) => void;
};

export function WebDeckRenderer({ initialPageIndex, lesson, onPageChange }: WebDeckRendererProps) {
  const isTextbookDeck = lesson.displayMode === "textbook_deck";

  return (
    <DeckShell
      initialPageIndex={initialPageIndex}
      lesson={lesson}
      onPageChange={onPageChange}
      renderPage={(currentIndex) => {
        const page = lesson.pages[currentIndex];
        const hasInteractionContent = !isTextbookDeck && Boolean(page?.interactionSpec);
        const hasAssessmentContent = !isTextbookDeck && Boolean(page?.assessmentSpec);
        const hasKnowledgeBoard = isTextbookDeck && Boolean(page?.knowledgeBoard);
        const hasSideContent =
          hasInteractionContent ||
          hasAssessmentContent ||
          Boolean(page?.code) ||
          page?.type === "summary_card";

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
            {hasKnowledgeBoard && page.knowledgeBoard ? (
              <KnowledgeBoard board={page.knowledgeBoard} />
            ) : (
              <div
                className={
                  page.visualSpec && hasSideContent
                    ? "grid min-h-0 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"
                    : "grid min-h-0 gap-3 lg:gap-4"
                }
              >
                {page.visualSpec || !hasSideContent ? (
                  <VisualRenderer title={page.title} visualSpec={page.visualSpec} />
                ) : null}

                {hasSideContent ? (
                  <div className="grid min-h-0 content-start gap-3">
                    {hasInteractionContent ? <InteractionRenderer interactionSpec={page.interactionSpec} /> : null}

                    {hasAssessmentContent && page.assessmentSpec ? (
                      <AssessmentRenderer
                        assessmentSpec={page.assessmentSpec}
                        feedbackSpec={page.feedbackSpec}
                      />
                    ) : null}

                    {page.code ? (
                      <CodeBlock language={page.code.language} value={page.code.value} />
                    ) : null}

                    {page.type === "summary_card" ? (
                      <ConceptCard title={isTextbookDeck ? "总结" : "记住这张心智模型卡"} items={lesson.summary} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </DeckPage>
        );
      }}
    />
  );
}
