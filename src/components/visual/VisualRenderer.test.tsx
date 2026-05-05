import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { VisualSpec } from "../../schemas/lesson.schema";
import { VisualRenderer } from "./VisualRenderer";

describe("VisualRenderer", () => {
  test("renders generic visuals as a teaching structure with states", () => {
    const visualSpec: VisualSpec = {
      kind: "tree",
      description: "用树状结构呈现状态如何一层层展开。",
      keyElements: ["初始可能性", "第一次分叉", "条件触发"],
      states: ["未识别可能性", "列出可能状态", "选择目标范围"]
    };

    render(<VisualRenderer title="可能性空间" visualSpec={visualSpec} />);

    expect(screen.getByText("关键结构")).toBeInTheDocument();
    expect(screen.getByText("状态变化")).toBeInTheDocument();
    expect(screen.getByText("初始可能性")).toBeInTheDocument();
    expect(screen.getByText("选择目标范围")).toBeInTheDocument();
  });
});
