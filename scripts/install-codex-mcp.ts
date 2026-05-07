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
import { validateMcpProfileToolLists } from "./codex-mcp-tool-check";

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
  const learner = await listMcpToolNames([]);
  const authoring = await listMcpToolNames(["--profile", "authoring"]);
  const operator = await listMcpToolNames(["--profile", "operator"]);

  validateMcpProfileToolLists({ learner, authoring, operator });
  console.log("[codex:mcp] MCP profiles are valid: default learner, explicit authoring, explicit operator");
}

async function listMcpToolNames(extraArgs: string[]): Promise<string[]> {
  const output = await runCommand("npm", ["run", "--silent", "mcp", "--", "--list-tools", ...extraArgs]);
  const result = JSON.parse(output) as { tools?: Array<{ name?: string }> };
  return (result.tools ?? []).map((tool) => tool.name).filter((name): name is string => typeof name === "string");
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
