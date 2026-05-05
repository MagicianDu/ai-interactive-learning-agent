import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

type Check = {
  name: string;
  command: string;
  args: string[];
};

type SourceRegressionResultLike = {
  summary: {
    total: number;
    ready: number;
    groundedReady: number;
    missingLocalSources: number;
  };
  samples: Array<{
    semanticStatus: "passed" | "warning" | "failed";
    sourceEvidenceStatus?: "passed" | "warning" | "failed";
  }>;
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
      "tools/agent-runtime/learner/grounded-course-service.test.ts",
      "tools/agent-runtime/learner/learner-project-service.test.ts",
      "tools/agent-runtime/learner/learning-course-publisher.test.ts",
      "tools/agent-runtime/learner/learning-preview-service.test.ts",
      "tools/agent-runtime/learner/learning-revision-service.test.ts",
      "tools/agent-runtime/learner/quick-preview-service.test.ts",
      "tools/mcp-server/skill-mcp-contract.test.ts",
      "tools/mcp-server/json-rpc-server.test.ts",
      "scripts/codex-mcp-config.test.ts",
      "scripts/learning-agent-bundle.test.ts",
      "scripts/beta-seed-check.test.ts"
    ]
  },
  { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { name: "build", command: "npm", args: ["run", "build"] },
  { name: "bundle-check", command: "npm", args: ["run", "bundle:check"] },
  { name: "mcp-tool-list", command: "npm", args: ["run", "mcp", "--", "--list-tools"] }
];

export type SourceRegressionSeedSummary = {
  total: number;
  passed: number;
  warnings: number;
  failed: number;
  sourceEvidence: {
    passed: number;
    warnings: number;
    failed: number;
    missing: number;
  };
};

export async function runSeedCheck(): Promise<void> {
  for (const check of checks) {
    await runCheck(check);
  }

  const sourceRegression = await runSourceRegressionCheck();

  console.log(`\n[seed:check] report\n${JSON.stringify({ sourceRegression }, null, 2)}`);
  console.log("\n[seed:check] all checks passed");
}

export function buildSourceRegressionSeedSummary(result: SourceRegressionResultLike): SourceRegressionSeedSummary {
  return {
    total: result.samples.length,
    passed: result.samples.filter((sample) => sample.semanticStatus === "passed").length,
    warnings: result.samples.filter((sample) => sample.semanticStatus === "warning").length,
    failed: result.samples.filter((sample) => sample.semanticStatus === "failed").length,
    sourceEvidence: {
      passed: result.samples.filter((sample) => sample.sourceEvidenceStatus === "passed").length,
      warnings: result.samples.filter((sample) => sample.sourceEvidenceStatus === "warning").length,
      failed: result.samples.filter((sample) => sample.sourceEvidenceStatus === "failed").length,
      missing: result.samples.filter((sample) => sample.sourceEvidenceStatus === undefined).length
    }
  };
}

export function assertNoSemanticRegressionFailures(summary: SourceRegressionSeedSummary): void {
  if (summary.failed > 0) {
    throw new Error(`source regression semantic checks failed: ${summary.failed}/${summary.total} failed`);
  }
}

export function assertNoSourceEvidenceRegressionFailures(summary: SourceRegressionSeedSummary): void {
  if (summary.sourceEvidence.failed > 0 || summary.sourceEvidence.missing > 0) {
    throw new Error(
      `source regression evidence checks failed: ${summary.sourceEvidence.failed}/${summary.total} failed, ${summary.sourceEvidence.missing}/${summary.total} missing`
    );
  }
}

async function runSourceRegressionCheck(): Promise<SourceRegressionSeedSummary> {
  console.log("\n[seed:check] source-regression");
  const output = await runCheckCapture({ name: "source-regression", command: "npm", args: ["run", "source:regression"] });
  const result = JSON.parse(output) as SourceRegressionResultLike & { workspaceRoot?: string };
  const summary = buildSourceRegressionSeedSummary(result);

  if (result.summary.ready !== result.summary.total) {
    throw new Error(`expected all regression samples to be project_ready, got ${result.summary.ready}/${result.summary.total}`);
  }

  if (result.summary.groundedReady !== result.summary.total) {
    throw new Error(`expected all regression samples to publish grounded previews, got ${result.summary.groundedReady}/${result.summary.total}`);
  }

  if (result.summary.missingLocalSources > 0) {
    throw new Error(`missing ${result.summary.missingLocalSources} local source file(s)`);
  }

  assertNoSemanticRegressionFailures(summary);
  assertNoSourceEvidenceRegressionFailures(summary);

  return summary;
}

if (isMainModule()) {
  await runSeedCheck();
}

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

function runCheckCapture(check: Check): Promise<string> {
  console.log(`[seed:check] ${check.command} ${check.args.join(" ")}`);

  return new Promise((resolve, reject) => {
    const child = spawn(check.command, check.args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32"
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
        resolve(stripNpmRunBanner(stdout));
        return;
      }

      reject(new Error(`${check.name} failed with exit code ${code ?? "unknown"}\n${stderr || stdout}`));
    });
  });
}

function isMainModule(): boolean {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
}

function stripNpmRunBanner(stdout: string): string {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("source regression did not print a JSON report");
  }
  return stdout.slice(jsonStart);
}
