import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildRealSourceQualityBenchmarkReport } from "./real-source-quality-benchmark.js";
import { runRealSourceRegressionSuite } from "./real-source-regression.js";

const workspaceRoot = await mkdtemp(path.join(tmpdir(), "learning-agent-real-source-regression-"));
const result = await runRealSourceRegressionSuite(workspaceRoot, { generateGroundedCourse: true });
const qualityBenchmark = buildRealSourceQualityBenchmarkReport(result);

console.log(
  JSON.stringify(
    {
      workspaceRoot,
      ...result,
      qualityBenchmark
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

const failedEvidenceSamples = result.samples.filter((sample) => sample.sourceEvidenceStatus === "failed");
if (failedEvidenceSamples.length > 0) {
  throw new Error(
    `source evidence regression failed for ${failedEvidenceSamples
      .map((sample) => `${sample.id}(${sample.sourceEvidence?.unsupportedPages ?? "unknown"} unsupported page(s))`)
      .join("; ")}`
  );
}

if (qualityBenchmark.status === "failed") {
  throw new Error(`real-source quality benchmark failed: ${qualityBenchmark.nextActions.join("; ")}`);
}
