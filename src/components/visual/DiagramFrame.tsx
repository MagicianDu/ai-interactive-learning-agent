import type { ReactNode } from "react";

type DiagramFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function DiagramFrame({ title, description, children }: DiagramFrameProps) {
  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <figcaption className="border-b border-line bg-slate-50 px-5 py-4">
        <h3 className="text-xl font-bold text-accent">{title}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </figcaption>
      <div className="p-4 sm:p-6">{children}</div>
    </figure>
  );
}
