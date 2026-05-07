import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { learningAgentToolContracts } from "./tool-contracts.js";

const skillsRoot = path.join(process.cwd(), "skills");
const learnerDefaultTools = [
  "learning_agent.prepare_learning_course",
  "learning_agent.publish_learning_course",
  "learning_agent.get_learning_preview"
];
const learnerFallbackTools = [
  "learning_agent.create_learning_project",
  "learning_agent.get_authoring_context"
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
    expectContainsInOrder(defaultWorkflow, learnerFallbackTools);
    expect(defaultWorkflow).not.toContain("learning_agent.plan_run");
    expect(defaultWorkflow).not.toContain("learning_agent.approve_gate");
    expect(defaultWorkflow).not.toContain("source-map");
    expect(defaultWorkflow).not.toContain("concept-map");
    expect(defaultWorkflow).not.toContain("curriculum-plan");
    expect(section(markdown, "## Learner-Facing Response Shape")).toContain("qualityReport.status");
    expect(section(markdown, "## Learner-Facing Response Shape")).toContain("#/preview/<run-id>");
    expect(markdown.indexOf("## Default Learner Workflow")).toBeLessThan(markdown.indexOf("## Expert/Operator Mode"));
  });

  test("feedback revision skills make preview revision history the acceptance checkpoint", async () => {
    const operator = await readSkill("learning-agent-operator");
    const feedbackRevision = await readSkill("learner-feedback-revision");
    const responseShape = section(operator, "## Learner-Facing Response Shape");

    expect(responseShape).toContain("revisionHistory");
    expect(feedbackRevision).toContain("revisionHistory");
    expect(feedbackRevision).toContain("changedPages");
    expect(feedbackRevision).toContain("qualityAfter");
    expect(feedbackRevision).toContain("preview-based acceptance");
  });

  test("source routing and feedback revision skills exist and use current learner-facing tools", async () => {
    const operator = await readSkill("learning-agent-operator");
    const sourceToCourse = await readSkill("source-to-course");
    const feedbackRevision = await readSkill("learner-feedback-revision");

    expect(sourceToCourse).toContain("name: source-to-course");
    expect(sourceToCourse).toContain("book");
    expect(sourceToCourse).toContain("paper");
    expect(sourceToCourse).toContain("patent");
    expect(sourceToCourse).toContain("blog");
    expect(sourceToCourse).toContain("contentBlueprint.units[*].pageBlueprints");
    expect(operator).toContain("contentBlueprint.units[*].pageBlueprints");
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

  test("core authoring skills preserve the Codex-authored Chinese source-grounded contract", async () => {
    const skillNames = [
      "learning-agent-operator",
      "source-to-course",
      "learning-architecture",
      "visual-pedagogy",
      "interaction-design",
      "assessment-design",
      "lesson-critic"
    ];
    const missing: string[] = [];

    for (const skillName of skillNames) {
      const markdown = await readSkill(skillName);
      for (const required of ["中文优先", "Codex", "sourceAnchorIds", "不要让学习者审批内部 artifacts"]) {
        if (!markdown.includes(required)) {
          missing.push(`${skillName}: ${required}`);
        }
      }
    }

    expect(missing).toEqual([]);
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
