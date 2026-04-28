type CodeBlockProps = {
  language: string;
  value: string;
};

export function CodeBlock({ language, value }: CodeBlockProps) {
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-sm">
      <figcaption className="border-b border-slate-800 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-blue-200">
        {language} 示例
      </figcaption>
      <pre className="overflow-x-auto p-5 text-sm leading-6 text-slate-100">
        <code aria-label={`${language} 代码`}>{value}</code>
      </pre>
    </figure>
  );
}
