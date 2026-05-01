import { spawn } from "node:child_process";

type Check = {
  name: string;
  command: string;
  args: string[];
};

const checks: Check[] = [
  {
    name: "product-and-mcp-tests",
    command: "npm",
    args: [
      "run",
      "test",
      "--",
      "src/product",
      "src/renderers",
      "src/components/deck/DeckPage.test.tsx",
      "src/components/course",
      "tools/agent-runtime/__tests__/promotion.test.ts",
      "tools/agent-runtime/learner/bundle-authoring-guidance.test.ts",
      "tools/agent-runtime/learner/codex-authored-trial.test.ts",
      "tools/agent-runtime/learner/learner-project-service.test.ts",
      "tools/agent-runtime/learner/learning-course-publisher.test.ts",
      "tools/agent-runtime/learner/learning-preview-service.test.ts",
      "tools/agent-runtime/learner/learning-revision-service.test.ts",
      "tools/agent-runtime/learner/quick-preview-service.test.ts",
      "tools/agent-runtime/learner/real-source-regression.test.ts",
      "tools/mcp-server/json-rpc-server.test.ts",
      "scripts/codex-mcp-config.test.ts"
    ]
  },
  { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { name: "build", command: "npm", args: ["run", "build"] },
  { name: "mcp-tool-list", command: "npm", args: ["run", "mcp", "--", "--list-tools"] }
];

for (const check of checks) {
  await runCheck(check);
}

console.log("\n[seed:check] all checks passed");

function runCheck(check: Check): Promise<void> {
  console.log(`\n[seed:check] ${check.name}`);
  console.log(`[seed:check] ${check.command} ${check.args.join(" ")}`);

  return new Promise((resolve, reject) => {
    const child = spawn(check.command, check.args, {
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${check.name} failed with exit code ${code ?? "unknown"}`));
    });
  });
}
