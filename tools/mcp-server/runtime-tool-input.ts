import type { ContentReviewIssue, ContentReviewVerdict } from "../agent-runtime/index.js";
import { courseIntentValues, normalizeCourseIntent, type CourseIntent } from "../agent-runtime/learner/course-intent.js";

export function expectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("tool input must be an object");
  }
  return value as Record<string, unknown>;
}

export function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export function requiredArray(input: Record<string, unknown>, key: string): unknown[] {
  const value = input[key];
  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array`);
  }
  return value;
}

export function requiredStringArray(input: Record<string, unknown>, key: string): string[] {
  const value = requiredArray(input, key);
  if (!value.every((item): item is string => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`${key} must be an array of non-empty strings`);
  }
  return value.map((item) => item.trim());
}

export function requiredNumber(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (typeof value !== "number") {
    throw new Error(`${key} must be a number`);
  }
  return value;
}

export function requiredSourceKind(input: Record<string, unknown>): "book" | "paper" | "patent" | "blog" | "notes" | "topic" {
  const value = requiredString(input, "sourceKind");
  if (value === "book" || value === "paper" || value === "patent" || value === "blog" || value === "notes" || value === "topic") {
    return value;
  }
  throw new Error("sourceKind must be book, paper, patent, blog, notes, or topic");
}

export function requiredTargetMode(input: Record<string, unknown>): "student_self_study_textbook" | "professor_web_deck" {
  const value = requiredString(input, "targetMode");
  if (value === "student_self_study_textbook" || value === "professor_web_deck") {
    return value;
  }
  throw new Error("targetMode must be student_self_study_textbook or professor_web_deck");
}

export function requiredCourseProductionDefaults(input: Record<string, unknown>): {
  difficulty: "beginner" | "undergraduate" | "graduate" | "expert";
  strategy: "overview_plus_topic" | "chapter_guided" | "topic_guided";
  overviewPages: number;
  topicPages: number;
  topicCount: number;
  reviewRounds: number;
  minQualityScore: number;
} {
  const defaults = expectRecord(input.defaults);
  return {
    difficulty: requiredProductionDifficulty(defaults),
    strategy: requiredProductionStrategy(defaults),
    overviewPages: requiredNumber(defaults, "overviewPages"),
    topicPages: requiredNumber(defaults, "topicPages"),
    topicCount: requiredNumber(defaults, "topicCount"),
    reviewRounds: requiredNumber(defaults, "reviewRounds"),
    minQualityScore: requiredNumber(defaults, "minQualityScore")
  };
}

export function requiredReviewIssues(input: Record<string, unknown>, key: string): ContentReviewIssue[] {
  return requiredArray(input, key) as ContentReviewIssue[];
}

export function optionalReviewVerdict(value: unknown): ContentReviewVerdict | undefined {
  const verdict = optionalString(value);
  return verdict ? (verdict as ContentReviewVerdict) : undefined;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function optionalImagegenGenerator(value: unknown): "imagegen" | "placeholder" | "imported" | "unknown" | undefined {
  const generator = optionalString(value);
  if (!generator) {
    return undefined;
  }
  if (generator === "imagegen" || generator === "placeholder" || generator === "imported" || generator === "unknown") {
    return generator;
  }
  throw new Error("generator must be one of imagegen, placeholder, imported, or unknown");
}

export function optionalDifficultyLevel(
  value: unknown
): "introductory" | "undergraduate_core" | "upper_undergraduate_or_graduate" | "research" | undefined {
  const normalized = optionalString(value);
  if (
    normalized === "introductory" ||
    normalized === "undergraduate_core" ||
    normalized === "upper_undergraduate_or_graduate" ||
    normalized === "research"
  ) {
    return normalized;
  }
  return undefined;
}

export function optionalCourseIntent(value: unknown): CourseIntent | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = normalizeCourseIntent(value);
  if (normalized) {
    return normalized;
  }
  throw new Error(`courseIntent must be ${courseIntentValues.join(" or ")}`);
}

export function optionalOutputMode(value: unknown): "preview" | "source" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "preview" || value === "source") {
    return value;
  }
  throw new Error("outputMode must be preview or source");
}

export function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

export function optionalCalibrationFocus(value: unknown): Array<"structure" | "source" | "learner"> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter((item): item is "structure" | "source" | "learner" =>
    item === "structure" || item === "source" || item === "learner"
  );
  return normalized.length > 0 ? normalized : undefined;
}

export function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function requiredProductionDifficulty(input: Record<string, unknown>): "beginner" | "undergraduate" | "graduate" | "expert" {
  const value = requiredString(input, "difficulty");
  if (value === "beginner" || value === "undergraduate" || value === "graduate" || value === "expert") {
    return value;
  }
  throw new Error("difficulty must be beginner, undergraduate, graduate, or expert");
}

function requiredProductionStrategy(input: Record<string, unknown>): "overview_plus_topic" | "chapter_guided" | "topic_guided" {
  const value = requiredString(input, "strategy");
  if (value === "overview_plus_topic" || value === "chapter_guided" || value === "topic_guided") {
    return value;
  }
  throw new Error("strategy must be overview_plus_topic, chapter_guided, or topic_guided");
}
