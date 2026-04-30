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
});
