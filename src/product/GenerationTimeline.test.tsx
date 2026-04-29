import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GenerationTimeline } from "./GenerationTimeline";
import { demoBetaStatus } from "./demoBetaStatus";

describe("GenerationTimeline", () => {
  test("shows review-aware generation stages", () => {
    render(<GenerationTimeline status={demoBetaStatus} />);

    expect(screen.getByText("资料解析")).toBeInTheDocument();
    expect(screen.getByText("单元生成")).toBeInTheDocument();
    expect(screen.getByText(/下一步：learning_agent.run_course/)).toBeInTheDocument();
    expect(screen.getByText(/待审核 0 项/)).toBeInTheDocument();
  });
});
