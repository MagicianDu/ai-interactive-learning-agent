import { pathToFileURL } from "node:url";

import { PreviewLayoutSmokeService, type PreviewLayoutViewport } from "./preview-layout-smoke-service.js";

type CliOptions = {
  runId?: string;
  baseUrl?: string;
  viewports?: PreviewLayoutViewport[];
};

export async function runPreviewLayoutSmokeCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  if (!options.runId) {
    throw new Error("usage: npm run smoke:layout -- --runId <preview-run-id> [--baseUrl http://127.0.0.1:5173]");
  }
  const result = await new PreviewLayoutSmokeService(process.cwd()).run({
    runId: options.runId,
    baseUrl: options.baseUrl,
    viewports: options.viewports
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--runId") {
      options.runId = argv[++index];
      continue;
    }
    if (arg === "--baseUrl") {
      options.baseUrl = argv[++index];
      continue;
    }
    if (arg === "--desktop-only") {
      options.viewports = [{ name: "desktop", width: 1280, height: 720 }];
      continue;
    }
    if (arg === "--desktop-mobile") {
      options.viewports = [
        { name: "desktop", width: 1280, height: 720 },
        { name: "mobile", width: 390, height: 844 }
      ];
    }
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runPreviewLayoutSmokeCli();
}
