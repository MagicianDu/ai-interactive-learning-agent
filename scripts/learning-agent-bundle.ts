import { cp, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { learningAgentMcpServerName } from "./codex-mcp-config.js";

export type LearningAgentBundleManifest = {
  product: string;
  version: number;
  mcp: {
    serverName: string;
    command: string;
    args: string[];
    cwd: string;
  };
  commands: {
    check: string;
    codexBundleInstall: string;
    codexMcpInstall: string;
    codexSkillsInstall: string;
  };
  requiredSkills: Array<{
    name: string;
    path: string;
  }>;
  learnerToolFlow: string[];
  docs: string[];
};

export type BundleReadinessReport = {
  ok: boolean;
  checked: string[];
  missing: string[];
};

export type CodexSkillInstallPlan = {
  projectRoot: string;
  codexHome: string;
  targets: Array<{
    skillName: string;
    sourceSkillDir: string;
    targetSkillDir: string;
  }>;
};

const requiredSkills = [
  "learning-agent-operator",
  "source-to-course",
  "learner-feedback-revision",
  "learning-agent-runner"
] as const;

const requiredDocs = [
  "docs/runtime/mcp-skills-bundle.md",
  "docs/runtime/mcp-client-setup.md",
  "docs/runtime/codex-mcp-trial.md"
] as const;

const requiredPackageScripts = [
  "mcp",
  "codex:mcp:install",
  "codex:mcp:check",
  "codex:skills:install",
  "codex:bundle:install",
  "bundle:check"
] as const;

const learnerToolFlow = [
  "learning_agent.create_learning_project",
  "learning_agent.get_authoring_context",
  "learning_agent.publish_learning_course",
  "learning_agent.get_learning_preview",
  "learning_agent.revise_learning_course",
  "learning_agent.apply_learning_revision",
  "learning_agent.export_learning_course"
];

export function buildLearningAgentBundleManifest(projectRoot: string): LearningAgentBundleManifest {
  return {
    product: "AI Interactive Learning Agent MCP+Skills Bundle",
    version: 1,
    mcp: {
      serverName: learningAgentMcpServerName,
      command: "npm",
      args: ["run", "mcp"],
      cwd: projectRoot
    },
    commands: {
      check: "npm run bundle:check",
      codexBundleInstall: "npm run codex:bundle:install",
      codexMcpInstall: "npm run codex:mcp:install",
      codexSkillsInstall: "npm run codex:skills:install"
    },
    requiredSkills: requiredSkills.map((skillName) => ({
      name: skillName,
      path: `skills/${skillName}/SKILL.md`
    })),
    learnerToolFlow,
    docs: [...requiredDocs]
  };
}

export function buildCodexSkillInstallPlan(projectRoot: string, codexHome: string): CodexSkillInstallPlan {
  return {
    projectRoot,
    codexHome,
    targets: requiredSkills.map((skillName) => ({
      skillName,
      sourceSkillDir: path.join(projectRoot, "skills", skillName),
      targetSkillDir: path.join(codexHome, "skills", skillName)
    }))
  };
}

export async function checkLearningAgentBundleReadiness(projectRoot: string): Promise<BundleReadinessReport> {
  const checked: string[] = [];
  const missing: string[] = [];
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(path.join(projectRoot, "package.json"));

  for (const scriptName of requiredPackageScripts) {
    const checkId = `package.json#scripts.${scriptName}`;
    checked.push(checkId);
    if (!packageJson.scripts?.[scriptName]) {
      missing.push(checkId);
    }
  }

  for (const skillName of requiredSkills) {
    const skillPath = `skills/${skillName}/SKILL.md`;
    checked.push(skillPath);
    const markdown = await readOptionalText(path.join(projectRoot, skillPath));
    if (!markdown.includes(`name: ${skillName}`)) {
      missing.push(skillPath);
    }
  }

  for (const docPath of requiredDocs) {
    checked.push(docPath);
    const markdown = await readOptionalText(path.join(projectRoot, docPath));
    if (markdown.length === 0) {
      missing.push(docPath);
    }
  }

  return {
    ok: missing.length === 0,
    checked,
    missing
  };
}

export async function installCodexSkillPack(projectRoot: string, codexHome: string): Promise<CodexSkillInstallPlan> {
  const plan = buildCodexSkillInstallPlan(projectRoot, codexHome);
  await mkdir(path.join(codexHome, "skills"), { recursive: true });

  for (const target of plan.targets) {
    await cp(target.sourceSkillDir, target.targetSkillDir, {
      recursive: true,
      force: true
    });
  }

  return plan;
}

if (isMainModule()) {
  await runCli();
}

async function runCli(): Promise<void> {
  const projectRoot = process.cwd();
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");

  if (process.argv.includes("--manifest")) {
    console.log(JSON.stringify(buildLearningAgentBundleManifest(projectRoot), null, 2));
    return;
  }

  if (process.argv.includes("--install-codex-skills")) {
    const plan = await installCodexSkillPack(projectRoot, codexHome);
    console.log(`[learning-agent:bundle] installed ${plan.targets.length} skill(s) into ${path.join(codexHome, "skills")}`);
    for (const target of plan.targets) {
      console.log(`[learning-agent:bundle] ${target.skillName}: ${target.targetSkillDir}`);
    }
    return;
  }

  const report = await checkLearningAgentBundleReadiness(projectRoot);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readOptionalText(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function isMainModule(): boolean {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
}
