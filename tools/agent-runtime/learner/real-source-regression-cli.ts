import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runRealSourceRegressionSuite } from "./real-source-regression.js";

const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-real-source-regression-"));
const result = await runRealSourceRegressionSuite(workspaceRoot, { generateGroundedCourse: true });

console.log(
  JSON.stringify(
    {
      workspaceRoot,
      ...result
    },
    null,
    2
  )
);

if (result.summary.ready !== result.summary.total) {
  throw new Error(`expected all regression samples to be project_ready, got ${result.summary.ready}/${result.summary.total}`);
}

if (result.summary.groundedReady !== result.summary.total) {
  throw new Error(`expected all regression samples to publish grounded previews, got ${result.summary.groundedReady}/${result.summary.total}`);
}

if (result.summary.missingLocalSources > 0) {
  throw new Error(`missing ${result.summary.missingLocalSources} local source file(s)`);
}

const failedSemanticSamples = result.samples.filter((sample) => sample.semanticStatus === "failed");
if (failedSemanticSamples.length > 0) {
  throw new Error(
    `semantic source regression failed for ${failedSemanticSamples
      .map((sample) => `${sample.id}(${sample.missingConceptLabels.join(", ") || "insufficient generated units"})`)
      .join("; ")}`
  );
}
