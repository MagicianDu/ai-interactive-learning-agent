import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";

describe("App", () => {
  test("defaults to the learner project library instead of the product landing page", () => {
    render(<App />);

    expect(screen.getByText("选择要继续学习的课程")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目库" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "下一页" })).not.toBeInTheDocument();
    expect(screen.queryByText("把技术资料变成可交互的中文学习体验")).not.toBeInTheDocument();
  });
});
