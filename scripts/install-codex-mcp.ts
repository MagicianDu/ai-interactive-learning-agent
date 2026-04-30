import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  buildLearningAgentMcpToml,
  hasLearningAgentMcpServer,
  learningAgentMcpServerName,
  upsertLearningAgentMcpServer
} from "./codex-mcp-config";

const projectRoot = process.cwd();
const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
const codexConfigPath = path.join(codexHome, "config.toml");
const mode = process.argv.includes("--install") ? "install" : "check";

if (mode === "install") {
  await installCodexMcpServer();
} else {
  await checkCodexMcpServer();
}

async function installCodexMcpServer() {
  await mkdir(codexHome, { recursive: true });
  const existingConfig = await readOptionalFile(codexConfigPath);
  if (existingConfig.length > 0) {
    const backupPath = `${codexConfigPath}.learning-agent-${timestampForFile()}.bak`;
    await copyFile(codexConfigPath, backupPath);
    console.log(`[codex:mcp] backed up Codex config to ${backupPath}`);
  }

  const updatedConfig = upsertLearningAgentMcpServer(existingConfig, projectRoot);
  await writeFile(codexConfigPath, updatedConfig, "utf8");
  console.log(`[codex:mcp] installed ${learningAgentMcpServerName} in ${codexConfigPath}`);
  console.log(buildLearningAgentMcpToml(projectRoot).trimEnd());
  await checkMcpToolList();
  console.log("[codex:mcp] restart Codex or open a new Codex session to load the MCP server.");
}

async function checkCodexMcpServer() {
  const existingConfig = await readOptionalFile(codexConfigPath);

  if (!hasLearningAgentMcpServer(existingConfig, projectRoot)) {
    console.error(`[codex:mcp] ${learningAgentMcpServerName} is not installed for this project.`);
    console.error("[codex:mcp] Run: npm run codex:mcp:install");
    console.error("\nExpected config:\n");
    console.error(buildLearningAgentMcpToml(projectRoot).trimEnd());
    process.exitCode = 1;
    return;
  }

  console.log(`[codex:mcp] ${learningAgentMcpServerName} config is installed in ${codexConfigPath}`);
  await checkMcpToolList();
}

async function checkMcpToolList() {
  const output = await runCommand("npm", ["run", "mcp", "--", "--list-tools"]);
  const requiredTools = [
    "learning_agent.create_learning_project",
    "learning_agent.publish_learning_course",
    "learning_agent.revise_learning_course",
    "learning_agent.plan_run",
    "learning_agent.beta_status"
  ];
  const missingTools = requiredTools.filter((tool) => !output.includes(tool));
  if (missingTools.length > 0) {
    throw new Error(`MCP tool list did not include expected learning_agent tools: ${missingTools.join(", ")}`);
  }

  const firstCreateIndex = output.indexOf("learning_agent.create_learning_project");
  const firstPlanIndex = output.indexOf("learning_agent.plan_run");
  if (firstPlanIndex >= 0 && firstCreateIndex > firstPlanIndex) {
    throw new Error("MCP tool list should show learner-facing tools before advanced/operator tools");
  }

  console.log(
    "[codex:mcp] MCP tool list includes learner-facing tools plus learning_agent.plan_run and learning_agent.beta_status"
  );
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}\n${stderr}`));
    });
  });
}

async function readOptionalFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function timestampForFile(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}
