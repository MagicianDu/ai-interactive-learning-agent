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
  test("renders a left visual panel and a right text rail", () => {
    render(
      <KnowledgeBoard
        board={board}
        visualSpec={{
          kind: "diagram",
          description: "示意图来源于正文。",
          keyElements: ["关键节点"],
          imageUrl: "https://example.com/weyl.png",
          imageAlt: "Weyl 图示"
        }}
      />
    );

    expect(screen.getByTestId("knowledge-board")).toBeInTheDocument();
    const visualRegion = screen.getByLabelText("知识板书视觉区");
    const textRail = screen.getByLabelText("知识板书正文区");

    expect(visualRegion.compareDocumentPosition(textRail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(visualRegion).getByRole("img", { name: "Weyl 图示" })).toHaveAttribute("src", "https://example.com/weyl.png");
    expect(within(visualRegion).queryAllByRole("img")).toHaveLength(1);
    expect(within(visualRegion).queryByRole("table")).not.toBeInTheDocument();
    expect(visualRegion.querySelector("svg")).toBeNull();
    expect(textRail).toHaveTextContent("机制板书");
    expect(textRail).toHaveTextContent("从来源命题到机制链");
    expect(textRail).toHaveTextContent("可靠的 agent workflow 需要显式状态和失败恢复。");
    expect(textRail).toHaveTextContent("任务压力进入 workflow");
    expect(textRail).toHaveTextContent("中间状态被记录");
    expect(textRail).toHaveTextContent("失败信号触发恢复");
    expect(textRail).toHaveTextContent("例子与边界");
    expect(textRail).toHaveTextContent("资料采样 -> 章节映射 -> 单元生成");
    expect(textRail).toHaveTextContent("短任务可能不需要复杂 workflow");
    expect(screen.getByText("本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。")).toBeInTheDocument();

    expect(screen.queryByText("source-001:page-12")).not.toBeInTheDocument();
    expect(screen.queryByText("支持 workflow 需要显式步骤。")).not.toBeInTheDocument();
  });

  test("stacks image above text on narrow screens without changing the reading order", () => {
    render(
      <KnowledgeBoard
        board={board}
        visualSpec={{
          kind: "diagram",
          description: "示意图来源于正文。",
          keyElements: ["关键节点"],
          imageUrl: "https://example.com/weyl.png",
          imageAlt: "Weyl 图示",
        }}
      />
    );

    const visualRegion = screen.getByLabelText("知识板书视觉区");
    const textRail = screen.getByLabelText("知识板书正文区");

    expect(visualRegion.compareDocumentPosition(textRail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("knowledge-board")).toContainElement(visualRegion);
    expect(screen.getByTestId("knowledge-board")).toContainElement(textRail);
    expect(screen.getByText("本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。")).toBeInTheDocument();
  });

  test("keeps the middle visual area image-only and avoids table or diagram fallbacks", () => {
    render(
      <KnowledgeBoard
        board={board}
        visualSpec={{
          kind: "diagram",
          description: "示意图来源于正文。",
          keyElements: ["关键节点"],
          imageUrl: "https://example.com/weyl.png",
          imageAlt: "Weyl 图示",
        }}
      />
    );

    const visualRegion = screen.getByLabelText("知识板书视觉区");

    expect(within(visualRegion).getByRole("img", { name: "Weyl 图示" })).toHaveAttribute("src", "https://example.com/weyl.png");
    expect(within(visualRegion).queryByRole("table")).not.toBeInTheDocument();
    expect(visualRegion.querySelector("svg")).toBeNull();
    expect(within(visualRegion).queryByText(/知识表格|知识图示/)).not.toBeInTheDocument();
  });

  test("keeps the bottom summary as the final block", () => {
    render(<KnowledgeBoard board={board} />);

    expect(screen.getByText("本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。")).toBeInTheDocument();
  });
});
