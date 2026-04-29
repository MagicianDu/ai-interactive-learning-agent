import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SampleGallery } from "./SampleGallery";

describe("SampleGallery", () => {
  test("renders seed source stories and lets users pick one", async () => {
    const onUseStory = vi.fn();
    render(<SampleGallery onUseStory={onUseStory} />);

    expect(screen.getByText(/一本技术书/)).toBeInTheDocument();
    expect(screen.getByText(/一篇论文/)).toBeInTheDocument();
    expect(screen.getByText(/一份专利/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "使用这个示例" })[0]!);
    expect(onUseStory).toHaveBeenCalledWith(expect.objectContaining({ id: "book" }));
  });
});
