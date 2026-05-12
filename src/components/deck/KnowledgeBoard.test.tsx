import { render, screen, within } from "@testing-library/react";

import type { KnowledgeBoard as KnowledgeBoardData } from "../../schemas/lesson.schema";
import { KnowledgeBoard } from "./KnowledgeBoard";

const board: KnowledgeBoardData = {
  boardKind: "mechanism_board",
  headline: "从来源命题到机制链",
  coreProposition: "可靠的 agent workflow 需要显式状态和失败恢复。",
  leftColumn: [
    {
      label: "机制链",
      emphasis: "mechanism",
      items: ["任务压力进入 workflow", "中间状态被记录", "失败信号触发恢复"],
    },
  ],
  rightColumn: [
    {
      label: "例子与边界",
      emphasis: "example",
      items: ["资料采样 -> 章节映射 -> 单元生成", "短任务可能不需要复杂 workflow"],
    },
  ],
  sourceTrace: [
    {
      anchorId: "source-001:page-12",
      supports: "支持 workflow 需要显式步骤。",
    },
  ],
  bottomLine: "本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。",
};

describe("KnowledgeBoard", () => {
  test("renders the board content without learner-facing source trace text", () => {
    render(<KnowledgeBoard board={board} />);

    expect(screen.getByTestId("knowledge-board")).toBeInTheDocument();
    expect(screen.getByText("机制板书")).toBeInTheDocument();
    expect(screen.queryByText("mechanism_board")).not.toBeInTheDocument();
    expect(screen.getByText("从来源命题到机制链")).toBeInTheDocument();
    expect(screen.getByText("可靠的 agent workflow 需要显式状态和失败恢复。")).toBeInTheDocument();
    expect(screen.getByText("机制链")).toBeInTheDocument();
    expect(screen.getByText("任务压力进入 workflow")).toBeInTheDocument();
    expect(screen.getByText("中间状态被记录")).toBeInTheDocument();
    expect(screen.getByText("失败信号触发恢复")).toBeInTheDocument();
    expect(screen.getByText("例子与边界")).toBeInTheDocument();
    expect(screen.getByText("资料采样 -> 章节映射 -> 单元生成")).toBeInTheDocument();
    expect(screen.getByText("短任务可能不需要复杂 workflow")).toBeInTheDocument();
    expect(screen.getByText("本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。")).toBeInTheDocument();

    expect(screen.queryByText("source-001:page-12")).not.toBeInTheDocument();
    expect(screen.queryByText("支持 workflow 需要显式步骤。")).not.toBeInTheDocument();
  });

  test("exposes separate left and right board regions", () => {
    render(<KnowledgeBoard board={board} />);

    const leftRegion = screen.getByLabelText("知识板书左栏");
    const rightRegion = screen.getByLabelText("知识板书右栏");

    expect(within(leftRegion).getByText("机制链")).toBeInTheDocument();
    expect(within(leftRegion).getByText("失败信号触发恢复")).toBeInTheDocument();
    expect(within(rightRegion).getByText("例子与边界")).toBeInTheDocument();
    expect(within(rightRegion).getByText("短任务可能不需要复杂 workflow")).toBeInTheDocument();
  });
});
