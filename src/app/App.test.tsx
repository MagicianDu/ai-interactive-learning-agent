import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";

describe("App", () => {
  test("defaults to the learner workspace instead of the product landing page", () => {
    render(<App />);

    expect(screen.getAllByText(/第 1 \//).length).toBeGreaterThan(0);
    expect(screen.queryByText("把技术资料变成可交互的中文学习体验")).not.toBeInTheDocument();
  });
});
