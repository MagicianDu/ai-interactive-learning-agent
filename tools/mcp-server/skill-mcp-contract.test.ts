import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { learningAgentToolContracts } from "./tool-contracts.js";

const skillsRoot = path.join(process.cwd(), "skills");
const learnerDefaultTools = [
  "learning_agent.create_learning_project",
  "learning_agent.generate_grounded_course",
  "learning_agent.get_learning_preview"
];
const feedbackTools = [
  "learning_agent.revise_learning_course",
  "learning_agent.apply_learning_revision",
  "learning_agent.get_learning_preview"
];

describe("skill and MCP contracts", () => {
  test("every learning_agent tool referenced by skills exists in MCP contracts", async () => {
    const validToolNames = new Set<string>(learningAgentToolContracts.map((tool) => tool.name));
    const skillFiles = [
      "learning-agent-operator",
      "learning-agent-runner",
      "source-to-course",
      "learner-feedback-revision"
    ];

    const invalidReferences: string[] = [];
    for (const skillName of skillFiles) {
      const markdown = await readSkill(skillName);
      const toolRefs = Array.from(new Set(markdown.match(/learning_agent\.[a-z_]+/gu) ?? []));
      invalidReferences.push(...toolRefs.filter((toolRef) => !validToolNames.has(toolRef)).map((toolRef) => `${skillName}: ${toolRef}`));
    }

    expect(invalidReferences).toEqual([]);
  });

  test("learning-agent-operator defaults to learner-facing MCP before expert artifact mode", async () => {
    const markdown = await readSkill("learning-agent-operator");
    const defaultWorkflow = section(markdown, "## Default Learner Workflow");

    expectContainsInOrder(defaultWorkflow, learnerDefaultTools);
    expect(defaultWorkflow).not.toContain("learning_agent.plan_run");
    expect(defaultWorkflow).not.toContain("learning_agent.approve_gate");
    expect(markdown.indexOf("## Default Learner Workflow")).toBeLessThan(markdown.indexOf("## Expert/Operator Mode"));
  });

  test("source routing and feedback revision skills exist and use current learner-facing tools", async () => {
    const sourceToCourse = await readSkill("source-to-course");
    const feedbackRevision = await readSkill("learner-feedback-revision");

    expect(sourceToCourse).toContain("name: source-to-course");
    expect(sourceToCourse).toContain("book");
    expect(sourceToCourse).toContain("paper");
    expect(sourceToCourse).toContain("patent");
    expect(sourceToCourse).toContain("blog");
    expectContainsInOrder(sourceToCourse, learnerDefaultTools);

    expect(feedbackRevision).toContain("name: learner-feedback-revision");
    expectContainsInOrder(feedbackRevision, feedbackTools);
    expect(feedbackRevision).toContain("export_learning_course");
  });

  test("learner-facing skill examples use current MCP argument names", async () => {
    const skillNames = ["learning-agent-operator", "source-to-course", "learner-feedback-revision"];
    const invalidArgumentNames: string[] = [];

    for (const skillName of skillNames) {
      const markdown = await readSkill(skillName);
      if (markdown.includes("\"projectId\"")) {
        invalidArgumentNames.push(`${skillName}: projectId`);
      }
      if (markdown.includes("\"revisionId\"")) {
        invalidArgumentNames.push(`${skillName}: revisionId`);
      }
    }

    expect(invalidArgumentNames).toEqual([]);
  });
});

async function readSkill(skillName: string): Promise<string> {
  return readFile(path.join(skillsRoot, skillName, "SKILL.md"), "utf8");
}

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  if (start < 0) {
    return "";
  }
  const nextHeading = markdown.indexOf("\n## ", start + heading.length);
  return nextHeading < 0 ? markdown.slice(start) : markdown.slice(start, nextHeading);
}

function expectContainsInOrder(markdown: string, expectedItems: string[]): void {
  let cursor = -1;
  for (const item of expectedItems) {
    const nextIndex = markdown.indexOf(item, cursor + 1);
    expect(nextIndex, `expected markdown to contain ${item} after index ${cursor}`).toBeGreaterThanOrEqual(0);
    cursor = nextIndex;
  }
}
