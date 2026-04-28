import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AssessmentSpec, FeedbackSpec } from "../../schemas/lesson.schema";
import { MultipleChoiceQuiz } from "./MultipleChoiceQuiz";

const assessmentSpec: AssessmentSpec = {
  kind: "multiple_choice",
  prompt: "Which query is least likely to benefit from an email index?",
  options: [
    "WHERE email = 'sam@example.com'",
    "WHERE created_at > '2026-01-01'",
  ],
  correctAnswer: "WHERE created_at > '2026-01-01'",
};

const feedbackSpec: FeedbackSpec = {
  correctFeedback:
    "Correct. The condition uses created_at, so the email index does not narrow the search space.",
  incorrectFeedback:
    "Not quite. An equality predicate on email can use the email index to narrow the search space.",
};

describe("MultipleChoiceQuiz", () => {
  test("updates explanatory feedback when an incorrect answer changes to the correct answer", async () => {
    const user = userEvent.setup();

    render(
      <MultipleChoiceQuiz assessmentSpec={assessmentSpec} feedbackSpec={feedbackSpec} />,
    );

    await user.click(screen.getByRole("button", { name: "WHERE email = 'sam@example.com'" }));

    expect(screen.getByText("还差一步")).toBeInTheDocument();
    expect(screen.getByText(/equality predicate on email/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "WHERE created_at > '2026-01-01'" }),
    );

    expect(screen.getByText("回答正确")).toBeInTheDocument();
    expect(screen.getByText(/does not narrow the search space/i)).toBeInTheDocument();
    expect(screen.queryByText(/equality predicate on email/i)).not.toBeInTheDocument();
  });
});
