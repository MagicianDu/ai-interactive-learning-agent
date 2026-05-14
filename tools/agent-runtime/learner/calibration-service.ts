import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { isRecord } from "../quality/validation-result.js";

export type CalibrationKind = "structure" | "source" | "learner";

export type CalibrationInput = {
  runId: string;
  maxRounds?: number;
  minScore?: number;
  failOnWarnings?: boolean;
  focus?: CalibrationKind[];
};

export type CalibrationIssue = {
  issueId: string;
  severity?: string;
  category?: string;
  lessonId?: string;
  pageId?: string;
  reason: string;
  requiredFix: string;
};

export type CalibrationQualitySnapshot = {
  status: string;
  score: number;
  requiredFixCount: number;
  optionalImprovementCount: number;
  topIssues: CalibrationIssue[];
};

export type CalibrationResult =
  | {
      status: "calibration_complete";
      runId: string;
      round: 0;
      maxRounds: number;
      currentQuality: CalibrationQualitySnapshot;
      stopReason: string;
      previewUrl?: string;
    }
  | {
      status: "calibration_stopped";
      runId: string;
      round: number;
      maxRounds: number;
      currentQuality: CalibrationQualitySnapshot;
      stopReason: string;
      previewUrl?: string;
    }
  | {
      status: "revision_required";
      runId: string;
      round: number;
      maxRounds: number;
      calibrationKind: CalibrationKind;
      currentQuality: CalibrationQualitySnapshot;
      revisionBriefPath: string;
      codexInstruction: string;
      previewUrl?: string;
    };

const RUN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const calibrationKinds: CalibrationKind[] = ["structure", "source", "learner"];

export class CalibrationService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async calibrate(input: CalibrationInput): Promise<CalibrationResult> {
    assertSafeRunId(input.runId);
    const maxRounds = normalizeMaxRounds(input.maxRounds);
    const minScore = input.minScore ?? 90;
    const quality = await this.readQuality(input.runId);
    const previewUrl = await this.readPreviewUrl(input.runId);
    const completed = isStopCriteriaMet(quality, minScore, input.failOnWarnings ?? false);

    if (completed) {
      return {
        status: "calibration_complete",
        runId: input.runId,
        round: 0,
        maxRounds,
        currentQuality: quality,
        stopReason: "quality already meets calibration stop criteria",
        ...(previewUrl ? { previewUrl } : {})
      };
    }

    const existingRoundCount = await this.countExistingRounds(input.runId);
    if (existingRoundCount >= maxRounds) {
      return {
        status: "calibration_stopped",
        runId: input.runId,
        round: existingRoundCount,
        maxRounds,
        currentQuality: quality,
        stopReason: "maxRounds reached before another calibration round",
        ...(previewUrl ? { previewUrl } : {})
      };
    }

    const round = existingRoundCount + 1;
    const calibrationKind = chooseCalibrationKind(quality.topIssues, input.focus);
    const revisionTargets = buildRevisionTargets(quality.topIssues, calibrationKind);
    const codexInstruction = buildCodexInstruction({
      runId: input.runId,
      calibrationKind,
      revisionTargets
    });
    const revisionBriefPath = await this.writeRoundArtifact(input.runId, {
      runId: input.runId,
      round,
      calibrationKind,
      inputQualityReportPath: path.join(this.runDir(input.runId), "quality", "course-quality-report.json"),
      detectedIssues: quality.topIssues,
      revisionTargets,
      expectedEvidence: expectedEvidenceForKind(calibrationKind),
      stopDecision: "revision_required",
      codexInstruction
    });
    await this.writeState(input.runId, {
      runId: input.runId,
      status: "revision_required",
      latestRound: round,
      maxRounds,
      calibrationKind,
      revisionBriefPath,
      currentQuality: quality
    });

    return {
      status: "revision_required",
      runId: input.runId,
      round,
      maxRounds,
      calibrationKind,
      currentQuality: quality,
      revisionBriefPath,
      codexInstruction,
      ...(previewUrl ? { previewUrl } : {})
    };
  }

  private async readQuality(runId: string): Promise<CalibrationQualitySnapshot> {
    const reportPath = path.join(this.runDir(runId), "quality", "course-quality-report.json");
    const report = await readJson(reportPath);
    if (!isRecord(report)) {
      throw new AgentRuntimeError("course-quality-report.json is invalid", "MISSING_ARTIFACT");
    }

    const issues = issueArray(report.issues);
    const topIssues = issueArray(report.topIssues);
    return {
      status: typeof report.status === "string" ? report.status : "unknown",
      score: typeof report.score === "number" ? report.score : 0,
      requiredFixCount:
        typeof report.requiredFixCount === "number" ? report.requiredFixCount : issues.filter((issue) => issue.severity === "error").length,
      optionalImprovementCount:
        typeof report.optionalImprovementCount === "number"
          ? report.optionalImprovementCount
          : issues.filter((issue) => issue.severity !== "error").length,
      topIssues: topIssues.length > 0 ? topIssues : issues
    };
  }

  private async readPreviewUrl(runId: string): Promise<string | undefined> {
    const previewPath = path.join(this.runDir(runId), "learning-preview.json");
    const value = await readJson(previewPath).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return undefined;
      }
      throw error;
    });
    if (!isRecord(value) || !isRecord(value.preview)) {
      return undefined;
    }
    return typeof value.preview.localUrl === "string" ? value.preview.localUrl : undefined;
  }

  private async countExistingRounds(runId: string): Promise<number> {
    const dir = this.calibrationDir(runId);
    const entries = await readdir(dir).catch((error: unknown) => {
      if (isFileNotFound(error)) {
        return [];
      }
      throw error;
    });
    return entries.filter((entry) => /^round-[0-9]{3}-(structure|source|learner)\.json$/u.test(entry)).length;
  }

  private async writeRoundArtifact(runId: string, artifact: Record<string, unknown>): Promise<string> {
    const dir = this.calibrationDir(runId);
    await mkdir(dir, { recursive: true });
    const round = typeof artifact.round === "number" ? artifact.round : 1;
    const kind = typeof artifact.calibrationKind === "string" ? artifact.calibrationKind : "learner";
    const filePath = path.join(dir, `round-${String(round).padStart(3, "0")}-${kind}.json`);
    await writeFile(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    return filePath;
  }

  private async writeState(runId: string, state: Record<string, unknown>): Promise<void> {
    const dir = this.calibrationDir(runId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "calibration-state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private runDir(runId: string): string {
    return path.join(this.workspaceRoot, "runs", runId);
  }

  private calibrationDir(runId: string): string {
    return path.join(this.runDir(runId), "quality", "calibration");
  }
}

function normalizeMaxRounds(value: number | undefined): number {
  if (value === undefined) {
    return 3;
  }
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new AgentRuntimeError("maxRounds must be an integer between 0 and 5", "INVALID_RUN_CONFIG");
  }
  return value;
}

function isStopCriteriaMet(quality: CalibrationQualitySnapshot, minScore: number, failOnWarnings: boolean): boolean {
  if (quality.requiredFixCount > 0 || quality.score < minScore) {
    return false;
  }
  const warningCount = quality.topIssues.filter((issue) => issue.severity !== "error").length;
  if (failOnWarnings && warningCount > 0) {
    return false;
  }
  return !quality.topIssues.some((issue) => {
    const marker = `${issue.issueId} ${issue.category}`.toLowerCase();
    return (
      marker.includes("source-synthesis") ||
      marker.includes("source_synthesis") ||
      marker.includes("repeated") ||
      marker.includes("scaffold")
    );
  });
}

function chooseCalibrationKind(issues: CalibrationIssue[], focus: CalibrationKind[] | undefined): CalibrationKind {
  const allowedKinds = focus?.filter((kind) => calibrationKinds.includes(kind));
  const candidates = allowedKinds && allowedKinds.length > 0 ? allowedKinds : calibrationKinds;
  return candidates.find((kind) => issues.some((issue) => classifyIssue(issue) === kind)) ?? candidates[0] ?? "learner";
}

function buildRevisionTargets(issues: CalibrationIssue[], calibrationKind: CalibrationKind): CalibrationIssue[] {
  const targets = issues.filter((issue) => classifyIssue(issue) === calibrationKind);
  if (targets.length > 0) {
    return targets;
  }
  return [
    {
      issueId: `calibration.${calibrationKind}.score-below-threshold`,
      severity: "warning",
      category: calibrationKind,
      reason: "quality score is below the calibration threshold",
      requiredFix: `Revise the course for ${calibrationKind} quality until the quality score reaches the requested threshold.`
    }
  ];
}

function classifyIssue(issue: CalibrationIssue): CalibrationKind {
  const marker = `${issue.issueId} ${issue.category} ${issue.reason} ${issue.requiredFix}`.toLowerCase();
  if (
    marker.includes("source") ||
    marker.includes("evidence") ||
    marker.includes("anchor") ||
    marker.includes("grounding") ||
    marker.includes("limitation")
  ) {
    return "source";
  }
  if (
    marker.includes("structure") ||
    marker.includes("repeated") ||
    marker.includes("title") ||
    marker.includes("objective") ||
    marker.includes("unit") ||
    marker.includes("page_type") ||
    marker.includes("blueprint")
  ) {
    return "structure";
  }
  return "learner";
}

function expectedEvidenceForKind(kind: CalibrationKind): string[] {
  if (kind === "structure") {
    return ["page titles are learner-facing propositions", "unit/page counts preserve the learner request", "overview and topic units have distinct roles"];
  }
  if (kind === "source") {
    return ["source-specific terms appear in the revised page", "sourceTrace connects anchors to the page proposition", "limitations or boundaries are explicit where relevant"];
  }
  return ["each revised page teaches one concrete mental-model move", "student-facing language replaces teacher-facing scaffolding", "mechanism, example or boundary, and bottom line are visible"];
}

function buildCodexInstruction(input: {
  runId: string;
  calibrationKind: CalibrationKind;
  revisionTargets: CalibrationIssue[];
}): string {
  const targetLines = input.revisionTargets.map((issue) => {
    const location = issue.lessonId && issue.pageId ? `${issue.lessonId}/${issue.pageId}` : issue.lessonId ?? issue.pageId ?? issue.issueId;
    return `- ${location}: ${issue.reason} Required fix: ${issue.requiredFix}`;
  });

  return [
    "请读取当前 preview coursePack 与 lessons，并按 calibration revision brief 修订。",
    `本轮目标：${input.calibrationKind} calibration。`,
    "必须修复：",
    ...targetLines,
    "保持不变：",
    `- runId=${input.runId}`,
    "- coursePack.units",
    "- unit page counts",
    "- sourceAnchorIds unless the current anchor is clearly wrong",
    "修订后调用 learning_agent.publish_learning_course。"
  ].join("\n");
}

function issueArray(value: unknown): CalibrationIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map((issue) => ({
    issueId: stringValue(issue.issueId, "quality.unknown"),
    severity: stringValue(issue.severity),
    category: stringValue(issue.category),
    lessonId: stringValue(issue.lessonId),
    pageId: stringValue(issue.pageId),
    reason: stringValue(issue.reason, "quality issue needs revision"),
    requiredFix: stringValue(issue.requiredFix, "Revise this issue before republishing.")
  }));
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (isFileNotFound(error)) {
      throw new AgentRuntimeError(`${filePath} is missing`, "MISSING_ARTIFACT");
    }
    throw error;
  }
}

function stringValue(value: unknown, fallback?: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback ?? "";
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AgentRuntimeError("runId must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_RUN_CONFIG");
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
