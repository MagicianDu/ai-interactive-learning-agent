import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { InteractionSpec } from "../../schemas/lesson.schema";
import { QueryPathVisualizer } from "./QueryPathVisualizer";

const queryPathSpec: InteractionSpec = {
  kind: "query_path",
  learnerAction: "Choose the query condition.",
  expectedObservation: "The access path changes by condition.",
  cognitivePurpose: "Connect indexed columns to planner path choices.",
  options: [
    {
      id: "email",
      label: "WHERE email = 'sam@example.com'",
      resultTitle: "Index lookup",
      outcomeId: "index_lookup",
      resultTone: "success",
      explanation:
        "The predicate matches the email index, so the database can search the ordered key structure.",
    },
    {
      id: "created_at",
      label: "WHERE created_at > '2026-01-01'",
      resultTitle: "Full table scan",
      outcomeId: "full_scan",
      resultTone: "neutral",
      explanation:
        "The available index is on email, not created_at, so this condition does not provide a useful shortcut.",
    },
  ],
};

describe("QueryPathVisualizer", () => {
  test("reveals feedback only after checking and clears stale feedback after selection changes", async () => {
    const user = userEvent.setup();

    render(<QueryPathVisualizer interactionSpec={queryPathSpec} />);

    await user.click(screen.getByRole("button", { name: "WHERE created_at > '2026-01-01'" }));

    expect(screen.queryByText("Full table scan")).not.toBeInTheDocument();
    expect(screen.queryByText(/not created_at/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "检查路径" }));

    expect(screen.getByText("Full table scan")).toBeInTheDocument();
    expect(screen.getByText(/not created_at/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "WHERE email = 'sam@example.com'" }));

    expect(screen.queryByText("Full table scan")).not.toBeInTheDocument();
    expect(screen.queryByText(/not created_at/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "检查路径" }));

    expect(screen.getByText("Index lookup")).toBeInTheDocument();
    expect(screen.getByText(/matches the email index/i)).toBeInTheDocument();
  });
});
