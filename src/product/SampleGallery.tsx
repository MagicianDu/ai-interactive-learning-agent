import { ArrowRight, BookOpenCheck } from "lucide-react";

import { sampleStories, type SampleStory } from "./sampleStories";

type SampleGalleryProps = {
  onUseStory: (story: SampleStory) => void;
  selectedStoryId?: SampleStory["id"];
};

export function SampleGallery({ onUseStory, selectedStoryId }: SampleGalleryProps) {
  return (
    <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">种子用户样例</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">从真实资料类型开始</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">书籍、论文、专利会生成不同的学习路径，但都保留中文、互动和来源映射。</p>
        </div>
        <BookOpenCheck aria-hidden="true" className="size-6 text-sky-700" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {sampleStories.map((story) => {
          const selected = selectedStoryId === story.id;

          return (
            <article
              className={[
                "grid content-between gap-4 rounded-lg border p-4",
                selected ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-slate-50"
              ].join(" ")}
              key={story.id}
            >
              <div>
                <p className="text-xs font-bold text-sky-800">{story.sourceType}</p>
                <h3 className="mt-2 text-base font-bold text-slate-950">{story.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{story.promise}</p>
                <p className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">{story.examplePrompt}</p>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#0e2f57] px-3 text-sm font-bold text-white hover:bg-[#16446f]"
                onClick={() => onUseStory(story)}
                type="button"
              >
                使用这个示例
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
