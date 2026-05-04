import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  buildCodexSkillInstallPlan,
  buildLearningAgentBundleManifest,
  checkLearningAgentBundleReadiness
} from "./learning-agent-bundle.js";

describe("learning agent MCP and skills bundle", () => {
  test("describes the installable Codex bundle surface", () => {
    const manifest = buildLearningAgentBundleManifest("/repo");

    expect(manifest.mcp.serverName).toBe("learningAgent");
    expect(manifest.commands.codexBundleInstall).toBe("npm run codex:bundle:install");
    expect(manifest.requiredSkills.map((skill) => skill.name)).toEqual([
      "learning-agent-operator",
      "source-to-course",
      "learner-feedback-revision",
      "learning-agent-runner"
    ]);
    expect(manifest.learnerToolFlow).toEqual([
      "learning_agent.create_learning_project",
      "learning_agent.get_authoring_context",
      "learning_agent.publish_learning_course",
      "learning_agent.get_learning_preview",
      "learning_agent.revise_learning_course",
      "learning_agent.apply_learning_revision",
      "learning_agent.export_learning_course"
    ]);
    expect(manifest.docs).toContain("docs/runtime/mcp-skills-bundle.md");
  });

  test("plans Codex skill installation without changing unrelated skills", () => {
    const plan = buildCodexSkillInstallPlan("/repo", "/codex-home");

    expect(plan.targets.map((target) => path.relative("/codex-home", target.targetSkillDir))).toEqual([
      "skills/learning-agent-operator",
      "skills/source-to-course",
      "skills/learner-feedback-revision",
      "skills/learning-agent-runner"
    ]);
    expect(plan.targets[0]?.sourceSkillDir).toBe("/repo/skills/learning-agent-operator");
  });

  test("checks that bundle docs, package scripts, and skill files are present", async () => {
    const report = await checkLearningAgentBundleReadiness(process.cwd());

    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.checked).toContain("package.json#scripts.codex:bundle:install");
    expect(report.checked).toContain("docs/runtime/mcp-skills-bundle.md");
    expect(report.checked).toContain("skills/source-to-course/SKILL.md");
  });
});
