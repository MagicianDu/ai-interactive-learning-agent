import { Copy, Download, Link2 } from "lucide-react";
import { useMemo, useState } from "react";

type ShareExportPanelProps = {
  lessonTitle: string;
  courseTitle?: string;
  lessonJson: unknown;
};

export function ShareExportPanel({ courseTitle, lessonJson, lessonTitle }: ShareExportPanelProps) {
  const [status, setStatus] = useState("可复制分享文案或导出结构化 lesson。");
  const shareMessage = useMemo(() => buildShareMessage(lessonTitle, courseTitle), [courseTitle, lessonTitle]);

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-label="分享和导出">
      <div>
        <p className="text-xs font-bold uppercase text-slate-500">分享输出</p>
        <h2 className="mt-1 text-lg font-bold text-slate-950">把生成结果发给种子用户</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">支持复制当前页面、复制中文介绍，或下载 lesson JSON 继续调试。</p>
      </div>

      <div className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{shareMessage}</div>

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 hover:border-sky-300 hover:text-sky-800"
          onClick={() => void copyText(window.location.href, "已复制当前页面链接。", setStatus)}
          type="button"
        >
          <Link2 aria-hidden="true" className="size-4" />
          复制链接
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 hover:border-sky-300 hover:text-sky-800"
          onClick={() => void copyText(shareMessage, "已复制分享文案。", setStatus)}
          type="button"
        >
          <Copy aria-hidden="true" className="size-4" />
          复制分享文案
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#0e2f57] px-3 text-sm font-bold text-white hover:bg-[#16446f]"
          onClick={() => exportLessonJson(lessonTitle, lessonJson, setStatus)}
          type="button"
        >
          <Download aria-hidden="true" className="size-4" />
          导出 JSON
        </button>
      </div>

      <p className="text-xs font-semibold text-slate-500" role="status">
        {status}
      </p>
    </section>
  );
}

function buildShareMessage(lessonTitle: string, courseTitle?: string): string {
  const coursePrefix = courseTitle ? `课程包《${courseTitle}》中的` : "";

  return [
    `我用 AI Interactive Learning Agent 生成了一套中文互动学习材料：${coursePrefix}《${lessonTitle}》。`,
    "它包含学习路径、可视化解释、互动练习、误区检查和迁移任务。"
  ].join("\n");
}

async function copyText(value: string, successMessage: string, setStatus: (value: string) => void) {
  try {
    await navigator.clipboard?.writeText(value);
    setStatus(successMessage);
  } catch {
    setStatus("当前环境不支持自动复制，请手动选择文本。");
  }
}

function exportLessonJson(lessonTitle: string, lessonJson: unknown, setStatus: (value: string) => void) {
  const json = JSON.stringify(lessonJson, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${buildFileStem(lessonTitle)}.lesson.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("已生成 lesson JSON 下载。");
}

function buildFileStem(title: string): string {
  return title.trim().replace(/\s+/g, "-") || "lesson";
}
