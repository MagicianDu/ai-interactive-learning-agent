import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import type { InteractionSpec } from "../../schemas/lesson.schema";
import { InteractionRenderer } from "./InteractionRenderer";

describe("InteractionRenderer", () => {
  test("renders generic choice options and explanatory feedback", async () => {
    const user = userEvent.setup();
    const interactionSpec: InteractionSpec = {
      kind: "choice",
      learnerAction: "选择哪一种动作真正构成负反馈。",
      expectedObservation: "负反馈必须读取目标差，并让下一次动作缩小差距。",
      cognitivePurpose: "区分事后复盘和运行中的反馈控制。",
      options: [
        {
          id: "loop",
          label: "持续比较目标差并调整动作",
          outcomeId: "negative-feedback",
          resultTitle: "完整负反馈",
          resultTone: "success",
          explanation: "它把观察、比较和调整连成循环，因此每一步都能缩小目标差。"
        },
        {
          id: "review",
          label: "结束后总结为什么失败",
          outcomeId: "post-review",
          resultTitle: "不是运行中的反馈",
          resultTone: "warning",
          explanation: "总结有价值，但不能改变正在发生的动作。"
        }
      ]
    };

    render(<InteractionRenderer interactionSpec={interactionSpec} />);

    expect(screen.getByTestId("choice-interaction-layout")).toHaveClass(
      "lg:grid-cols-[minmax(0,0.9fr)_minmax(18rem,1fr)]"
    );

    await user.click(screen.getByRole("button", { name: "持续比较目标差并调整动作" }));

    expect(screen.getByText("互动模型")).toBeInTheDocument();
    expect(screen.getByText("区分事后复盘和运行中的反馈控制。")).toBeInTheDocument();
    expect(screen.getByText("完整负反馈")).toBeInTheDocument();
    expect(screen.getByText("它把观察、比较和调整连成循环，因此每一步都能缩小目标差。")).toBeInTheDocument();
  });
});
