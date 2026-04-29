import type { ReactNode } from "react";

type MapViewportProps = {
  children: ReactNode;
};

export function MapViewport({ children }: MapViewportProps) {
  return (
    <section className="min-h-[32rem] bg-[#eef4fb] px-4 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {children}
      </div>
    </section>
  );
}
