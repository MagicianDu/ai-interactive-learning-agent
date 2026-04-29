import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { productCopy } from "./product-copy";

type SourceKind = "book" | "paper" | "patent" | "blog" | "documentation" | "notes";
type Strategy = "overview_plus_topic" | "chapter_guided" | "topic_guided" | "hybrid";

type GuidedStartState = {
  sourcePath: string;
  sourceKind: SourceKind;
  audience: string;
  unitPages: number;
  strategy: Strategy;
};

export type GuidedStartPreset = {
  sourceKind?: SourceKind;
  promptPreview?: string;
};

const sourceKindLabels: Record<SourceKind, string> = {
  book: "书籍",
  paper: "论文",
  patent: "专利",
  blog: "技术博客",
  documentation: "技术文档",
  notes: "课程笔记"
};

const strategyLabels: Record<Strategy, string> = {
  overview_plus_topic: "总览课 + 核心 topic",
  chapter_guided: "按章节推进",
  topic_guided: "按 topic 推进",
  hybrid: "章节映射 + topic 学习路径"
};

export function GuidedStartPanel({ preset }: { preset?: GuidedStartPreset }) {
  const [state, setState] = useState<GuidedStartState>({
    sourcePath: "/path/to/source.pdf",
    sourceKind: "book",
    audience: "有基础编程经验但还没有建立系统心智模型的中文学习者",
    unitPages: 8,
    strategy: "overview_plus_topic"
  });

  useEffect(() => {
    if (!preset?.sourceKind) {
      return;
    }

    setState((current) => ({ ...current, sourceKind: preset.sourceKind ?? current.sourceKind }));
  }, [preset?.sourceKind]);

  const prompt = useMemo(() => buildPrompt(state), [state]);
  const command = useMemo(() => buildCommand(prompt), [prompt]);

  return (
    <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid content-start gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">创建学习项目</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">生成 Codex 可执行的中文请求</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">先准备一个清晰的自然语言入口，再让 Codex 通过 MCP 执行规划、审核和生成。</p>
        </div>

        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          资料路径或 URL
          <input
            className="h-10 rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            onChange={(event) => setState((current) => ({ ...current, sourcePath: event.target.value }))}
            value={state.sourcePath}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            资料类型
            <select
              className="h-10 rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              onChange={(event) => setState((current) => ({ ...current, sourceKind: event.target.value as SourceKind }))}
              value={state.sourceKind}
            >
              {Object.entries(sourceKindLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            每单元页数
            <input
              className="h-10 rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              max={16}
              min={6}
              onChange={(event) =>
                setState((current) => ({ ...current, unitPages: Number(event.target.value) || current.unitPages }))
              }
              type="number"
              value={state.unitPages}
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          学习者
          <textarea
            className="min-h-20 rounded-md border border-slate-200 px-3 py-2 font-normal leading-6 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            onChange={(event) => setState((current) => ({ ...current, audience: event.target.value }))}
            value={state.audience}
          />
        </label>

        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          课程策略
          <select
            className="h-10 rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            onChange={(event) => setState((current) => ({ ...current, strategy: event.target.value as Strategy }))}
            value={state.strategy}
          >
            {Object.entries(strategyLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3">
        <OutputBlock label="Codex 请求" value={prompt} />
        {preset?.promptPreview ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-slate-700">
            <p className="font-bold text-slate-950">已选择示例</p>
            <p className="mt-1">{preset.promptPreview}</p>
          </div>
        ) : null}
        <OutputBlock label="CLI 命令" value={command} />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-bold text-slate-950">接下来会发生什么</p>
          <ol className="mt-2 grid gap-2 text-sm leading-6 text-slate-600">
            {productCopy.workflow.map((step, index) => (
              <li className="flex gap-2" key={step}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function OutputBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 p-3 text-white">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-sky-400 hover:text-white"
          onClick={() => void navigator.clipboard?.writeText(value)}
          type="button"
        >
          <Copy aria-hidden="true" className="size-3.5" />
          复制
        </button>
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{value}</pre>
    </div>
  );
}

function buildPrompt(state: GuidedStartState): string {
  return [
    `请用这份资料生成一套中文学习材料：${state.sourcePath}`,
    `资料类型是 ${sourceKindLabels[state.sourceKind]}。先给一个总览课，再按核心 topic 拆课。`,
    `每个单元 ${state.unitPages} 页，面向 ${state.audience}。`,
    "保留来源映射，关键节点先让我审核。遇到 reviewQueue 时不要自动 approve。"
  ].join("\n");
}

function buildCommand(prompt: string): string {
  return `npm run agent:plan -- --request ${JSON.stringify(prompt)} --run seed-learning-project`;
}
