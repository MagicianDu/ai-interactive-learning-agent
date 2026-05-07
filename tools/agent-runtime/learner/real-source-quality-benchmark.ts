import type {
  RealSourceRegressionQualityFocus,
  RealSourceRegressionResult,
  RealSourceRegressionSample,
  RealSourceRegressionSampleResult
} from "./real-source-regression.js";

export type RealSourceBenchmarkSourceKind = RealSourceRegressionSample["sourceKind"] | "documentation" | "notes" | "topic-only";
export type RealSourceBenchmarkQualityDimension =
  | "source semantics"
  | "source synthesis"
  | "academic depth"
  | "learner action"
  | "feedback mechanism"
  | "visual purpose"
  | "transfer";

export type RealSourceBenchmarkSourceKindCoverage = {
  sourceKind: RealSourceBenchmarkSourceKind;
  coverage: "automated" | "tracked_only";
  status: "passed" | "warning" | "failed" | "tracked";
  sampleIds: string[];
  failingSampleIds: string[];
  warningSampleIds: string[];
  observedDimensions: RealSourceBenchmarkQualityDimension[];
  missingDimensions: RealSourceBenchmarkQualityDimension[];
  acceptanceChecks: string[];
};

export type RealSourceQualityBenchmarkReport = {
  status: "passed" | "warning" | "failed";
  summary: {
    sourceKindTotal: number;
    automatedSourceKindCount: number;
    trackedOnlySourceKindCount: number;
    totalSamples: number;
    readySamples: number;
    groundedReadySamples: number;
    warningSampleCount: number;
    failedSampleCount: number;
  };
  qualityDimensions: RealSourceBenchmarkQualityDimension[];
  sourceKinds: RealSourceBenchmarkSourceKindCoverage[];
  nextActions: string[];
};

export const realSourceBenchmarkSourceKinds: RealSourceBenchmarkSourceKind[] = [
  "book",
  "paper",
  "patent",
  "blog",
  "documentation",
  "notes",
  "topic-only"
];

export const realSourceBenchmarkQualityDimensions: RealSourceBenchmarkQualityDimension[] = [
  "source semantics",
  "source synthesis",
  "academic depth",
  "learner action",
  "feedback mechanism",
  "visual purpose",
  "transfer"
];

const qualityFocusToDimension: Record<RealSourceRegressionQualityFocus, RealSourceBenchmarkQualityDimension> = {
  source_semantics: "source semantics",
  source_synthesis: "source synthesis",
  academic_depth: "academic depth",
  learner_action: "learner action",
  feedback_mechanism: "feedback mechanism",
  visual_purpose: "visual purpose",
  transfer: "transfer"
};

export function buildRealSourceQualityBenchmarkReport(
  regression: RealSourceRegressionResult
): RealSourceQualityBenchmarkReport {
  const sourceKinds = realSourceBenchmarkSourceKinds.map((sourceKind) =>
    buildSourceKindCoverage(sourceKind, regression.samples)
  );
  const failedSampleIds = Array.from(new Set(sourceKinds.flatMap((sourceKind) => sourceKind.failingSampleIds)));
  const warningSampleIds = Array.from(new Set(sourceKinds.flatMap((sourceKind) => sourceKind.warningSampleIds)));
  const automatedSourceKindCount = sourceKinds.filter((sourceKind) => sourceKind.coverage === "automated").length;
  const trackedOnlySourceKindCount = sourceKinds.length - automatedSourceKindCount;
  const status =
    failedSampleIds.length > 0 || sourceKinds.some((sourceKind) => sourceKind.coverage === "automated" && sourceKind.missingDimensions.length > 0 && sourceKind.status === "failed")
      ? "failed"
      : warningSampleIds.length > 0 || trackedOnlySourceKindCount > 0 || sourceKinds.some((sourceKind) => sourceKind.status === "warning")
        ? "warning"
        : "passed";

  return {
    status,
    summary: {
      sourceKindTotal: realSourceBenchmarkSourceKinds.length,
      automatedSourceKindCount,
      trackedOnlySourceKindCount,
      totalSamples: regression.summary.total,
      readySamples: regression.summary.ready,
      groundedReadySamples: regression.summary.groundedReady,
      warningSampleCount: warningSampleIds.length,
      failedSampleCount: failedSampleIds.length
    },
    qualityDimensions: realSourceBenchmarkQualityDimensions,
    sourceKinds,
    nextActions: buildNextActions(sourceKinds, failedSampleIds)
  };
}

function buildSourceKindCoverage(
  sourceKind: RealSourceBenchmarkSourceKind,
  samples: RealSourceRegressionSampleResult[]
): RealSourceBenchmarkSourceKindCoverage {
  const automatedSamples = samples.filter((sample) => sample.sourceKind === sourceKind);
  if (automatedSamples.length === 0) {
    return {
      sourceKind,
      coverage: "tracked_only",
      status: "tracked",
      sampleIds: [],
      failingSampleIds: [],
      warningSampleIds: [],
      observedDimensions: [],
      missingDimensions: realSourceBenchmarkQualityDimensions,
      acceptanceChecks: []
    };
  }

  const observedDimensions = uniqueDimensions(
    automatedSamples.flatMap((sample) => sample.qualityFocus.map((qualityFocus) => qualityFocusToDimension[qualityFocus]))
  );
  const missingDimensions = realSourceBenchmarkQualityDimensions.filter((dimension) => !observedDimensions.includes(dimension));
  const failingSampleIds = automatedSamples.filter(isFailedSample).map((sample) => sample.id);
  const warningSampleIds = automatedSamples.filter(isWarningSample).map((sample) => sample.id);
  const status =
    failingSampleIds.length > 0
      ? "failed"
      : missingDimensions.length > 0 || warningSampleIds.length > 0
        ? "warning"
        : "passed";

  return {
    sourceKind,
    coverage: "automated",
    status,
    sampleIds: automatedSamples.map((sample) => sample.id),
    failingSampleIds,
    warningSampleIds,
    observedDimensions,
    missingDimensions,
    acceptanceChecks: Array.from(new Set(automatedSamples.flatMap((sample) => sample.acceptanceChecks)))
  };
}

function buildNextActions(
  sourceKinds: RealSourceBenchmarkSourceKindCoverage[],
  failedSampleIds: string[]
): string[] {
  const actions: string[] = [];
  const trackedOnlyKinds = sourceKinds
    .filter((sourceKind) => sourceKind.coverage === "tracked_only")
    .map((sourceKind) => sourceKind.sourceKind);
  if (trackedOnlyKinds.length > 0) {
    actions.push(`Add automated regression samples for ${trackedOnlyKinds.join(", ")}.`);
  }
  if (failedSampleIds.length > 0) {
    actions.push(`Fix failed benchmark samples: ${failedSampleIds.join(", ")}.`);
  }

  for (const sourceKind of sourceKinds) {
    if (sourceKind.coverage === "automated" && sourceKind.missingDimensions.length > 0) {
      actions.push(`Raise ${sourceKind.sourceKind} benchmark coverage for: ${sourceKind.missingDimensions.join(", ")}.`);
    }
  }

  return actions;
}

function isFailedSample(sample: RealSourceRegressionSampleResult): boolean {
  return (
    sample.status !== "project_ready" ||
    sample.groundedCourseStatus === "revision_required" ||
    sample.semanticStatus === "failed" ||
    sample.sourceEvidenceStatus === "failed" ||
    sample.sourceGraphStatus === "failed"
  );
}

function isWarningSample(sample: RealSourceRegressionSampleResult): boolean {
  return !isFailedSample(sample) && (sample.semanticStatus === "warning" || sample.sourceEvidenceStatus === "warning" || sample.sourceGraphStatus === "warning");
}

function uniqueDimensions(dimensions: RealSourceBenchmarkQualityDimension[]): RealSourceBenchmarkQualityDimension[] {
  return realSourceBenchmarkQualityDimensions.filter((dimension) => dimensions.includes(dimension));
}
