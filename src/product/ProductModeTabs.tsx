import { Beaker, Bot, ClipboardCheck, Map, Presentation, School } from "lucide-react";
import type { ComponentType } from "react";

import type { LearningProductMode } from "../renderers/LearningProductRenderer";

export type CourseView = "deck" | "map" | LearningProductMode;

type ProductModeTab = {
  id: CourseView;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

export const defaultProductModeTabs: ProductModeTab[] = [
  { id: "deck", label: "学习", description: "逐页互动课件", icon: Presentation }
];

export const experimentalProductModeTabs: ProductModeTab[] = [
  { id: "map", label: "知识地图", description: "概念与来源结构", icon: Map },
  { id: "assessment", label: "练习", description: "测验与反馈", icon: ClipboardCheck },
  { id: "teacher", label: "教师", description: "教学提纲与课堂问题", icon: School },
  { id: "playground", label: "实验", description: "操作模型与观察", icon: Beaker },
  { id: "tutor", label: "导师", description: "页面驱动辅导", icon: Bot }
];

export const productModeTabs: ProductModeTab[] = [...defaultProductModeTabs, ...experimentalProductModeTabs];

type ProductModeTabsProps = {
  value: CourseView;
  onChange: (value: CourseView) => void;
};

export function ProductModeTabs({ value, onChange }: ProductModeTabsProps) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-3 lg:grid-cols-6" role="tablist">
      {productModeTabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.id;
        return (
          <button
            aria-label={tab.label}
            aria-selected={active}
            className={[
              "grid min-h-20 gap-1 rounded-md border px-3 py-2 text-left transition",
              active ? "border-sky-300 bg-sky-50 text-sky-900" : "border-transparent bg-white text-slate-600 hover:border-slate-200"
            ].join(" ")}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            type="button"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <Icon aria-hidden className="size-4" />
              {tab.label}
            </span>
            <span className="text-xs leading-5 text-slate-500">{tab.description}</span>
          </button>
        );
      })}
    </div>
  );
}
