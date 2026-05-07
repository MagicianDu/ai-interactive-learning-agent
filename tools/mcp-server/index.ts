import { createInterface } from "node:readline/promises";

import { handleMcpLine } from "./json-rpc-server.js";
import { LearningAgentRuntimeTools } from "./runtime-tools.js";
import { learningAgentToolContractsForProfile, type LearningAgentToolProfile } from "./tool-contracts.js";

async function main(): Promise<void> {
  const profile = selectedProfile(process.argv, process.env);
  if (process.argv.includes("--list-tools")) {
    console.log(JSON.stringify({ tools: learningAgentToolContractsForProfile(profile) }, null, 2));
    return;
  }

  const tools = new LearningAgentRuntimeTools();
  const readline = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  for await (const line of readline) {
    const response = await handleMcpLine(line, tools, profile);
    if (response) {
      console.log(response);
    }
  }
}

function selectedProfile(argv: string[], env: NodeJS.ProcessEnv): LearningAgentToolProfile {
  const flagIndex = argv.findIndex((value) => value === "--profile");
  const raw = flagIndex >= 0 ? argv[flagIndex + 1] : env.LEARNING_AGENT_MCP_PROFILE;
  if (raw === "authoring" || raw === "operator" || raw === "learner") {
    return raw;
  }
  return "learner";
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
