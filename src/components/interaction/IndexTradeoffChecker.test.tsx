import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { InteractionSpec } from "../../schemas/lesson.schema";
import { IndexTradeoffChecker } from "./IndexTradeoffChecker";

const indexTradeoffSpec: InteractionSpec = {
  kind: "index_tradeoff",
  learnerAction: "Choose whether this index is worth adding.",
  expectedObservation: "Read savings must outweigh write and storage cost.",
  cognitivePurpose: "Reason about indexes as workload tradeoffs.",
  options: [
    {
      id: "unique-email",
      label: "Add index for frequent unique email lookup",
      resultTitle: "Good tradeoff",
      outcomeId: "good_tradeoff",
      resultTone: "success",
      explanation:
        "Frequent selective reads usually justify the extra index maintenance and storage.",
    },
    {
      id: "rare-report",
      label: "Add index for a rare report on a tiny table",
      resultTitle: "Weak tradeoff",
      outcomeId: "weak_read_savings",
      resultTone: "warning",
      explanation:
        "The read savings are small, so write maintenance and storage may cost more than the index saves.",
    },
  ],
};

describe("IndexTradeoffChecker", () => {
  test("shows weak tradeoff feedback for the rare report option", async () => {
    const user = userEvent.setup();

    render(<IndexTradeoffChecker interactionSpec={indexTradeoffSpec} />);

    await user.click(
      screen.getByRole("button", { name: "Add index for a rare report on a tiny table" }),
    );

    expect(screen.getByText("Weak tradeoff")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The read savings are small, so write maintenance and storage may cost more than the index saves.",
      ),
    ).toBeInTheDocument();
  });
});
