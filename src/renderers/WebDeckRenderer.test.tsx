import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { databaseIndexLesson } from "../lessons/database-index/lesson";
import type { Lesson } from "../schemas/lesson.schema";
import { WebDeckRenderer } from "./WebDeckRenderer";

const weylPageImageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="Weyl page 6 diagram">
    <rect width="960" height="540" fill="#f8fafc" />
    <rect x="64" y="64" width="832" height="412" rx="28" fill="#ffffff" stroke="#cbd5e1" stroke-width="4" />
    <circle cx="240" cy="280" r="58" fill="#dbeafe" />
    <circle cx="480" cy="180" r="58" fill="#e0e7ff" />
    <circle cx="720" cy="280" r="58" fill="#dcfce7" />
    <path d="M240 222C324 150 408 146 480 180" fill="none" stroke="#475569" stroke-width="8" stroke-linecap="round" />
    <path d="M480 180C560 214 648 224 720 280" fill="none" stroke="#475569" stroke-width="8" stroke-linecap="round" />
    <text x="240" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0f172a">metric</text>
    <text x="480" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0f172a">geodesic</text>
    <text x="720" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0f172a">curvature</text>
  </svg>`,
)}`;

const weylLesson: Lesson = {
  id: "weyl-textbook-deck-regression",
  title: "Weyl 的广义相对论笔记",
  displayMode: "textbook_deck",
  audience: "具备基础数学和物理背景、需要通过教材式讲解理解广义相对论的学习者。",
  config: {
    targetPageCount: 6,
    minPageCount: 6,
    maxPageCount: 6,
  },
  prerequisites: [
    "知道什么是惯性运动",
    "读得懂基本的几何和物理术语",
  ],
  learningObjectives: [
    "看清 metric、geodesic 和 curvature 的关系",
    "理解自由落体如何被看成几何上的最短路径",
    "分辨引力解释中的直觉和边界",
  ],
  pages: [
    {
      id: "page-01",
      type: "problem_scene",
      title: "为什么自由落体不只是“掉下去”",
      learningGoal: "先从运动现象进入问题。",
      narrative: "先看一个具体问题：为什么同样的运动在不同参考系里会呈现不同解释？",
    },
    {
      id: "page-02",
      type: "intuition_visual",
      title: "把引力想成几何，而不是单独的力",
      learningGoal: "建立几何直觉。",
      narrative: "这一页用最小的几何直觉把引力和路径联系起来。",
    },
    {
      id: "page-03",
      type: "structure_diagram",
      title: "metric、路径和曲率的关系",
      learningGoal: "看见概念之间的结构。",
      narrative: "从结构上理解 metric 如何规定测量，路径如何被几何约束。",
    },
    {
      id: "page-04",
      type: "process_animation",
      title: "从参考系切换到几何描述",
      learningGoal: "理解解释方式的转换过程。",
      narrative: "把运动解释从牛顿式力图景切换到广义相对论的几何图景。",
    },
    {
      id: "page-05",
      type: "interactive_model",
      title: "用一条路径观察自由落体",
      learningGoal: "为教材页的核心命题做铺垫。",
      narrative: "先让学习者预判不同路径下的结果，再回到理论解释。",
    },
    {
      id: "page-06",
      type: "structure_diagram",
      title: "广义相对论把引力放进 metric",
      learningGoal: "看清 metric、geodesic 和 curvature 的关系。",
      narrative: "本页要在一屏里同时看见图和正文。",
      visualSpec: {
        kind: "diagram",
        description: "Weyl 页面示意图",
        keyElements: ["metric", "geodesic", "curvature"],
        imageUrl: weylPageImageUrl,
        imageAlt: "广义相对论把引力放进 metric",
      },
      knowledgeBoard: {
        boardKind: "mechanism_board",
        headline: "广义相对论把引力放进 metric",
        coreProposition: "自由落体可看成沿 geodesic 运动。",
        leftColumn: [
          {
            label: "机制链",
            emphasis: "mechanism",
            items: [
              "inertial force 与 gravitational field 需要统一解释。",
              "Einstein law 连接 curvature 与 energy-momentum。",
            ],
          },
        ],
        rightColumn: [
          {
            label: "例子与边界",
            emphasis: "example",
            items: [
              "旋转圆盘让几何条件卷入运动。",
              "把引力只当 Newtonian force 会看不到 metric。",
            ],
          },
        ],
        sourceTrace: [
          {
            anchorId: "source-001:page-6",
            supports: "Chapter IV 从 relativity of motion 进入 metrical fields and gravitation.",
          },
        ],
        bottomLine: "本页结论：引力不是单独的力项，而是几何结构的一部分。",
      },
    },
  ],
  misconceptions: [
    {
      id: "misconception-weyl-1",
      statement: "引力只是一种普通的力。",
      correction: "在广义相对论里，引力也可以被理解为几何结构的一部分。",
    },
  ],
  transferTasks: [
    {
      id: "transfer-weyl-1",
      prompt: "把这个几何直觉迁移到一个新运动场景。",
      targetMentalModel: "先识别路径和约束，再判断是否需要引力式解释。",
    },
  ],
  summary: [
    "metric 决定如何测量和比较路径",
    "geodesic 是自由落体的几何表达",
    "curvature 说明为什么引力不只是外加力项",
  ],
};

describe("WebDeckRenderer", () => {
  test("renders the database index lesson with its actual 10 page count", () => {
    render(<WebDeckRenderer lesson={databaseIndexLesson} />);

    expect(databaseIndexLesson.pages).toHaveLength(10);
    expect(
      screen.getByRole("heading", { level: 2, name: "问题引入：为什么全表扫描慢？" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("第 1 / 10 页")).toHaveLength(2);
  });

  test("renders a shorter lesson with a matching configured target count", () => {
    const shorterLesson: Lesson = {
      ...databaseIndexLesson,
      id: "database-index-shorter-test",
      config: {
        ...databaseIndexLesson.config,
        targetPageCount: 6,
      },
      pages: databaseIndexLesson.pages.slice(0, 6),
    };

    render(<WebDeckRenderer lesson={shorterLesson} />);

    expect(screen.getAllByText("第 1 / 6 页")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "跳转到第 6 页" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "跳转到第 7 页" })).not.toBeInTheDocument();
  });

  test("keeps incomplete generated page specs learner-facing", () => {
    const incompleteLesson: Lesson = {
      ...databaseIndexLesson,
      id: "incomplete-generated-test",
      pages: [
        {
          id: "p1",
          type: "problem_scene",
          title: "缺少规格的页面",
          learningGoal: "先建立学习问题",
          narrative: "这页还没有生成完整规格。"
        }
      ],
      config: {
        targetPageCount: 1
      }
    };

    render(<WebDeckRenderer lesson={incompleteLesson} />);

    expect(screen.getByText("内容页")).toBeInTheDocument();
    expect(screen.queryByText(/visualSpec|interactionSpec|待补充/)).not.toBeInTheDocument();
  });

  test("does not spend deck body space on a generic visual placeholder when an interaction is present", () => {
    const interactionOnlyLesson: Lesson = {
      ...databaseIndexLesson,
      id: "interaction-only-test",
      pages: [
        {
          id: "p1",
          type: "interactive_model",
          title: "选择目标范围",
          learningGoal: "判断目标范围是否匹配控制能力",
          narrative: "先读场景，再做选择。",
          interactionSpec: {
            kind: "choice",
            learnerAction: "选择合理目标范围。",
            expectedObservation: "目标越窄，需要的控制能力越强。",
            cognitivePurpose: "建立目标范围和控制能力的匹配关系。",
            options: [
              {
                id: "range",
                label: "控制到可接受区间",
                outcomeId: "bounded-range",
                resultTitle: "合理",
                resultTone: "success",
                explanation: "可接受区间能降低控制成本。"
              }
            ]
          }
        }
      ],
      config: {
        targetPageCount: 1
      }
    };

    render(<WebDeckRenderer lesson={interactionOnlyLesson} />);

    expect(screen.getByRole("button", { name: "控制到可接受区间" })).toBeInTheDocument();
    expect(screen.queryByText("先聚焦这一页的问题")).not.toBeInTheDocument();
  });

  test("hides productized interaction and assessment panels in textbook deck mode", () => {
    const textbookLesson: Lesson = {
      ...databaseIndexLesson,
      id: "textbook-deck-test",
      displayMode: "textbook_deck",
      pages: [
        {
          id: "p1",
          type: "interactive_model",
          title: "关键链路",
          learningGoal: "判断目标范围是否匹配控制能力",
          narrative: "标题和正文说明关键链路。",
          interactionSpec: {
            kind: "choice",
            learnerAction: "选择合理目标范围。",
            expectedObservation: "目标越窄，需要的控制能力越强。",
            cognitivePurpose: "比较目标范围和控制能力的边界。",
            options: [
              {
                id: "range",
                label: "控制到可接受区间",
                outcomeId: "bounded-range",
                resultTitle: "合理",
                resultTone: "success",
                explanation: "可接受区间能降低控制成本。"
              }
            ]
          },
          assessmentSpec: {
            kind: "multiple_choice",
            prompt: "应该先看什么？",
            options: ["关键链路", "术语名称"],
            correctAnswer: "关键链路"
          },
          feedbackSpec: {
            correctFeedback: "正确。",
            incorrectFeedback: "不对。"
          },
          visualSpec: {
            kind: "flow",
            description: "关键链路图",
            keyElements: ["目标", "状态", "边界"]
          }
        }
      ],
      config: {
        targetPageCount: 1
      }
    };

    render(<WebDeckRenderer lesson={textbookLesson} />);

    expect(screen.getByText("标题和正文说明关键链路。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "控制到可接受区间" })).not.toBeInTheDocument();
    expect(screen.queryByText("应该先看什么？")).not.toBeInTheDocument();
  });

  test("renders the Weyl preview page with a visible image, readable text rail, and bottom summary", () => {
    render(<WebDeckRenderer lesson={weylLesson} initialPageIndex={5} />);

    expect(screen.getByRole("heading", { level: 2, name: "广义相对论把引力放进 metric" })).toBeInTheDocument();
    expect(screen.getAllByText("第 6 / 6 页")).toHaveLength(2);

    const visualRegion = screen.getByLabelText("知识板书视觉区");
    const textRail = screen.getByLabelText("知识板书正文区");

    expect(within(visualRegion).getByRole("img", { name: "广义相对论把引力放进 metric" })).toBeVisible();
    expect(within(visualRegion).getByRole("img", { name: "广义相对论把引力放进 metric" })).toHaveAttribute("src", weylPageImageUrl);
    expect(textRail).toHaveTextContent("广义相对论把引力放进 metric");
    expect(textRail).toHaveTextContent("自由落体可看成沿 geodesic 运动。");
    expect(textRail).toHaveTextContent("旋转圆盘让几何条件卷入运动。");
    expect(textRail).toHaveTextContent("把引力只当 Newtonian force 会看不到 metric。");
    expect(screen.getByText("本页结论：引力不是单独的力项，而是几何结构的一部分。")).toBeInTheDocument();
  });

  test("renders dense textbook board columns without repeating board header blocks", () => {
    const textbookLesson: Lesson = {
      ...databaseIndexLesson,
      id: "textbook-knowledge-board-test",
      displayMode: "textbook_deck",
      pages: [
        {
          id: "p1",
          type: "structure_diagram",
          title: "知识板书页",
          learningGoal: "把命题、机制和边界压缩到一屏。",
          narrative: "本页使用知识板书替代普通视觉区。",
          knowledgeBoard: {
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
                anchorId: "source-001:page-1",
                supports: "支持 workflow 需要显式步骤。",
              },
            ],
            bottomLine: "本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。",
          },
          visualSpec: {
            kind: "diagram",
            description: "生成图片资产",
            keyElements: ["旧视觉"],
            imageUrl: "https://example.com/generated.png",
            imageAlt: "生成图片",
          },
        },
      ],
      config: {
        targetPageCount: 1,
      },
    };

    render(<WebDeckRenderer lesson={textbookLesson} />);

    expect(screen.getByTestId("knowledge-board")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "生成图片" })).toHaveAttribute("src", "https://example.com/generated.png");
    expect(screen.queryByText("知识图示")).not.toBeInTheDocument();
    expect(screen.queryByText("知识表格")).not.toBeInTheDocument();
    expect(screen.getAllByText("从来源命题到机制链")).toHaveLength(1);
    expect(screen.getAllByText("可靠的 agent workflow 需要显式状态和失败恢复。")).toHaveLength(1);
    expect(screen.getByText("机制链")).toBeInTheDocument();
    expect(screen.getByText("任务压力进入 workflow")).toBeInTheDocument();
    expect(screen.getByText("例子与边界")).toBeInTheDocument();
    expect(screen.getByText("本页结论：知识板书必须把命题、机制、证据和边界放在一屏内。")).toBeInTheDocument();
    expect(screen.queryByText("source-001:page-1")).not.toBeInTheDocument();
  });

  test("accepts an initial page index and reports page changes", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <WebDeckRenderer
        initialPageIndex={1}
        lesson={databaseIndexLesson}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getAllByText("第 2 / 10 页")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getAllByText("第 3 / 10 页")).toHaveLength(2);
  });
});
