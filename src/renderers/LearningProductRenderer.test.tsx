import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { databaseIndexLesson } from "../lessons/database-index/lesson";
import { LearningProductRenderer } from "./LearningProductRenderer";

describe("LearningProductRenderer", () => {
  test("renders assessment mode from lesson assessments, misconceptions, and transfer tasks", () => {
    render(<LearningProductRenderer lesson={databaseIndexLesson} mode="assessment" />);
    const firstAssessmentPrompt = databaseIndexLesson.pages.find((page) => page.assessmentSpec)?.assessmentSpec?.prompt;

    expect(screen.getByRole("heading", { name: "练习模式" })).toBeInTheDocument();
    expect(screen.getByText(firstAssessmentPrompt!)).toBeInTheDocument();
    expect(screen.getByText(databaseIndexLesson.misconceptions[0]!.statement)).toBeInTheDocument();
    expect(screen.getByText(databaseIndexLesson.transferTasks[0]!.prompt)).toBeInTheDocument();
  });

  test("renders teacher mode with objectives, pacing, questions, and misconceptions", () => {
    render(<LearningProductRenderer lesson={databaseIndexLesson} mode="teacher" />);

    expect(screen.getByRole("heading", { name: "教师模式" })).toBeInTheDocument();
    expect(screen.getByText("建议节奏")).toBeInTheDocument();
    expect(screen.getByText(databaseIndexLesson.learningObjectives[0]!)).toBeInTheDocument();
    expect(screen.getByText(databaseIndexLesson.misconceptions[0]!.correction)).toBeInTheDocument();
  });

  test("renders playground mode with selectable interaction feedback", async () => {
    render(<LearningProductRenderer lesson={databaseIndexLesson} mode="playground" />);

    expect(screen.getByRole("heading", { name: "实验模式" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "WHERE email = 'sam@example.com'" }));

    expect(screen.getByText("走索引查找")).toBeInTheDocument();
    expect(screen.getByText(/数据库可以先搜索有序 key 结构/)).toBeInTheDocument();
  });

  test("renders tutor mode as page-grounded diagnostic prompts", () => {
    render(<LearningProductRenderer lesson={databaseIndexLesson} mode="tutor" />);

    expect(screen.getByRole("heading", { name: "导师模式" })).toBeInTheDocument();
    expect(screen.getByText(databaseIndexLesson.pages[0]!.title)).toBeInTheDocument();
    expect(screen.getByText(`你会怎样解释：${databaseIndexLesson.pages[0]!.learningGoal}`)).toBeInTheDocument();
  });
});
