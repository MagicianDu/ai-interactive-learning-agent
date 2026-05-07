import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { GuidedStartPanel } from "./GuidedStartPanel";

describe("GuidedStartPanel", () => {
  test("uses the selected course strategy in the generated Codex request", async () => {
    const user = userEvent.setup();
    render(<GuidedStartPanel />);

    await user.selectOptions(screen.getByLabelText("课程策略"), "chapter_guided");

    expect(screen.getAllByText(/按章节推进/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/strategy=chapter_guided/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/先给一个总览课，再按核心 topic 拆课/)).not.toBeInTheDocument();
  });

  test("guides learners to state the teaching difficulty level", async () => {
    const user = userEvent.setup();
    render(<GuidedStartPanel />);

    expect(screen.getByLabelText("教学难度")).toBeInTheDocument();
    expect(screen.getAllByText(/教学难度层级/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/大学高年级\/研究生课程/).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText("教学难度"), "research");

    expect(screen.getAllByText(/研究论文精读\/前沿讨论/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/教学难度=research/).length).toBeGreaterThan(0);
  });
});
