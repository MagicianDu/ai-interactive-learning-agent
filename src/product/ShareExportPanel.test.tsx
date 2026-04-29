import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ShareExportPanel } from "./ShareExportPanel";

describe("ShareExportPanel", () => {
  test("shows Chinese share message and export action", () => {
    render(<ShareExportPanel lessonJson={{ id: "hash-table" }} lessonTitle="哈希表为什么快" />);

    expect(screen.getByText(/中文互动学习材料/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导出 JSON/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /复制分享文案/ })).toBeInTheDocument();
  });
});
