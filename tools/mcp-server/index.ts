import { createInterface } from "node:readline/promises";

import { handleMcpLine } from "./json-rpc-server.js";
import { LearningAgentRuntimeTools } from "./runtime-tools.js";
import { learningAgentToolContracts } from "./tool-contracts.js";

async function main(): Promise<void> {
  if (process.argv.includes("--list-tools")) {
    console.log(JSON.stringify({ tools: learningAgentToolContracts }, null, 2));
    return;
  }

  const tools = new LearningAgentRuntimeTools();
  const readline = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  for await (const line of readline) {
    const response = await handleMcpLine(line, tools);
    if (response) {
      console.log(response);
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
