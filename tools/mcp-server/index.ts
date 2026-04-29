import { createInterface } from "node:readline/promises";

import { LearningAgentRuntimeTools } from "./runtime-tools.js";
import { learningAgentToolContracts } from "./tool-contracts.js";

type JsonRequest = {
  id?: string | number;
  tool?: string;
  input?: unknown;
};

async function main(): Promise<void> {
  if (process.argv.includes("--list-tools")) {
    console.log(JSON.stringify({ tools: learningAgentToolContracts }, null, 2));
    return;
  }

  const tools = new LearningAgentRuntimeTools();
  const readline = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  for await (const line of readline) {
    if (!line.trim()) {
      continue;
    }

    const request = JSON.parse(line) as JsonRequest;
    try {
      const result = await tools.callTool(String(request.tool), request.input ?? {});
      console.log(JSON.stringify({ id: request.id, result }));
    } catch (error) {
      console.log(
        JSON.stringify({
          id: request.id,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
