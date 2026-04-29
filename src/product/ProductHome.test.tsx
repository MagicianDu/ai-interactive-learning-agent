import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { ProductHome } from "./ProductHome";

describe("ProductHome", () => {
  test("shows Chinese product positioning and guided start", async () => {
    const user = userEvent.setup();
    render(<ProductHome courseCount={2} lessonCount={5} onOpenSamples={() => undefined} onStart={() => undefined} />);

    expect(screen.getByText("把技术资料变成可交互的中文学习体验")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "创建学习项目" }));

    expect(screen.getAllByText(/请用这份资料生成一套中文学习材料/).length).toBeGreaterThan(0);
    expect(screen.getByText(/npm run agent:plan/)).toBeInTheDocument();
  });
});
