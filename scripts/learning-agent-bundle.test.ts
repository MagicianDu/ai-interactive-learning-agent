import path from "node:path";
import { readFileSync } from "node:fs";

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
      "learner-feedback-revision"
    ]);
    expect(manifest.learnerToolFlow).toEqual([
      "learning_agent.prepare_learning_course",
      "learning_agent.publish_learning_course",
      "learning_agent.calibrate_learning_course",
      "learning_agent.get_learning_preview",
      "learning_agent.revise_learning_course",
      "learning_agent.apply_learning_revision",
      "learning_agent.export_learning_course"
    ]);
    expect(manifest.learnerToolFlow).not.toContain("learning_agent.compare_authoring_quality");
    expect(manifest.docs).toContain("docs/product/product-core.md");
    expect(manifest.docs).toContain("docs/runtime/mcp-skills-bundle.md");
    expect(manifest.docs).toContain("docs/runtime/codex-user-trial-script.md");
    expect(manifest.docs).toContain("docs/runtime/seed-user-beta-quickstart.md");
    expect(manifest.docs).toContain("docs/runtime/codex-authoring-protocol-v2.md");
    expect(manifest.docs).toContain("docs/runtime/real-source-quality-benchmark.md");
  });

  test("plans Codex skill installation without changing unrelated skills", () => {
    const plan = buildCodexSkillInstallPlan("/repo", "/codex-home");

    expect(plan.targets.map((target) => path.relative("/codex-home", target.targetSkillDir))).toEqual([
      "skills/learning-agent-operator",
      "skills/source-to-course",
      "skills/learner-feedback-revision"
    ]);
    expect(plan.targets[0]?.sourceSkillDir).toBe("/repo/skills/learning-agent-operator");
  });

  test("checks that bundle docs, package scripts, and skill files are present", async () => {
    const report = await checkLearningAgentBundleReadiness(process.cwd());

    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.checked).toContain("package.json#scripts.codex:bundle:install");
    expect(report.checked).toContain("docs/product/product-core.md");
    expect(report.checked).toContain("docs/runtime/mcp-skills-bundle.md");
    expect(report.checked).toContain("docs/runtime/codex-user-trial-script.md");
    expect(report.checked).toContain("docs/runtime/seed-user-beta-quickstart.md");
    expect(report.checked).toContain("docs/runtime/codex-authoring-protocol-v2.md");
    expect(report.checked).toContain("docs/runtime/real-source-quality-benchmark.md");
    expect(report.checked).toContain("skills/source-to-course/SKILL.md");
  });

  test("ships Codex authoring quality docs for all beta source kinds", async () => {
    const report = await checkLearningAgentBundleReadiness(process.cwd());

    expect(report.ok).toBe(true);
    expect(report.checked).toContain("docs/runtime/codex-authoring-protocol-v2.md");
    expect(report.checked).toContain("docs/runtime/real-source-quality-benchmark.md");
  });

  test("bundle docs describe professor lecture Web Deck as optional mode without PPTX export", () => {
    const sourceToCourse = readFileSync("skills/source-to-course/SKILL.md", "utf8");
    const operator = readFileSync("skills/learning-agent-operator/SKILL.md", "utf8");
    const productCore = readFileSync("docs/product/product-core.md", "utf8");
    const trialScript = readFileSync("docs/runtime/codex-user-trial-script.md", "utf8");
    const seedPrompts = readFileSync("docs/runtime/seed-user-prompts.md", "utf8");

    for (const text of [sourceToCourse, operator, productCore, trialScript, seedPrompts]) {
      expect(text).toContain("professor_lecture_deck");
      expect(text).toContain("Web Deck");
    }
    expect(`${sourceToCourse}\n${operator}\n${productCore}\n${trialScript}\n${seedPrompts}`).not.toMatch(
      /生成\s*(PPTX|Slides)|导出\s*(PPTX|Slides)/iu
    );
  });
});
