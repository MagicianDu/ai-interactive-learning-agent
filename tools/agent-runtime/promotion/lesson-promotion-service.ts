import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentRuntimeError } from "../errors.js";
import { RunStore } from "../run-store.js";

type LessonLike = {
  id: string;
  title: string;
  audience: string;
  config: {
    targetPageCount: number;
    minPageCount?: number;
    maxPageCount?: number;
  };
  prerequisites: string[];
  learningObjectives: string[];
  pages: LessonPageLike[];
  misconceptions: unknown[];
  transferTasks: unknown[];
  summary: string[];
};

type LessonPageLike = {
  id: string;
  type: string;
  title: string;
  learningGoal: string;
  narrative: string;
  visualSpec?: unknown;
  interactionSpec?: unknown;
  assessmentSpec?: unknown;
  feedbackSpec?: unknown;
  code?: unknown;
};

export type PromotionResult = {
  lessonId: string;
  lessonPath: string;
};

const LESSON_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const LESSON_PAGE_TYPES = new Set([
  "problem_scene",
  "intuition_visual",
  "structure_diagram",
  "process_animation",
  "interactive_model",
  "code_walkthrough",
  "quiz",
  "misconception_check",
  "transfer_challenge",
  "summary_card"
]);
const VISUAL_KINDS = new Set(["diagram", "flow", "timeline", "tree", "table", "graph", "architecture", "animation"]);
const VISUAL_COMPONENTS = new Set([
  "table_scan",
  "book_index",
  "index_tree",
  "access_path",
  "tradeoff",
  "summary"
]);
const INTERACTION_KINDS = new Set([
  "stepper",
  "slider",
  "drag_drop",
  "prediction",
  "choice",
  "code_edit",
  "parameter_experiment",
  "build_from_parts",
  "query_path",
  "index_tradeoff"
]);
const RESULT_TONES = new Set(["neutral", "success", "warning", "danger"]);
const ASSESSMENT_KINDS = new Set([
  "multiple_choice",
  "true_false",
  "ordering",
  "prediction",
  "debugging",
  "short_answer",
  "transfer"
]);

export class LessonPromotionService {
  private readonly workspaceRoot: string;
  private readonly runStore: RunStore;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.runStore = new RunStore(this.workspaceRoot);
  }

  async promote(runId: string): Promise<PromotionResult> {
    const runPath = this.runStore.getRunPath(runId);
    const rawLesson = await readFile(path.join(runPath, "artifacts", "lesson.approved.json"), "utf8");
    const lesson = parseLesson(rawLesson);
    validateLesson(lesson);

    const lessonsRoot = path.join(this.workspaceRoot, "src", "lessons");
    const lessonDir = assertSafeChildPath(lessonsRoot, lesson.id);
    await mkdir(lessonDir, { recursive: true });

    const lessonPath = path.join(lessonDir, "lesson.ts");
    await writeFile(lessonPath, renderLessonSource(lesson), "utf8");

    return {
      lessonId: lesson.id,
      lessonPath
    };
  }
}

function parseLesson(rawLesson: string): unknown {
  try {
    return JSON.parse(rawLesson) as unknown;
  } catch (error) {
    throw new AgentRuntimeError(
      `approved lesson is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "INVALID_LESSON"
    );
  }
}

function validateLesson(lesson: unknown): asserts lesson is LessonLike {
  if (!isRecord(lesson)) {
    throw new AgentRuntimeError("approved lesson must be an object", "INVALID_LESSON");
  }
  if (!isNonEmptyString(lesson.id) || !isNonEmptyString(lesson.title) || !isNonEmptyString(lesson.audience)) {
    throw new AgentRuntimeError("approved lesson is missing id, title, or audience", "INVALID_LESSON");
  }
  if (!LESSON_ID_PATTERN.test(lesson.id)) {
    throw new AgentRuntimeError("lesson.id must match /^[a-z][a-z0-9-]{0,63}$/", "INVALID_LESSON");
  }
  if (!isRecord(lesson.config)) {
    throw new AgentRuntimeError("approved lesson config must be an object", "INVALID_LESSON");
  }
  const targetPageCount = lesson.config.targetPageCount;
  if (!Number.isInteger(targetPageCount) || typeof targetPageCount !== "number" || targetPageCount < 1) {
    throw new AgentRuntimeError("approved lesson has invalid targetPageCount", "INVALID_LESSON");
  }
  if (!isOptionalInteger(lesson.config.minPageCount) || !isOptionalInteger(lesson.config.maxPageCount)) {
    throw new AgentRuntimeError("approved lesson has invalid minPageCount or maxPageCount", "INVALID_LESSON");
  }
  if (!isStringArray(lesson.prerequisites)) {
    throw new AgentRuntimeError("approved lesson prerequisites must be strings", "INVALID_LESSON");
  }
  if (!isStringArray(lesson.learningObjectives) || lesson.learningObjectives.length === 0) {
    throw new AgentRuntimeError("approved lesson learningObjectives must include at least one string", "INVALID_LESSON");
  }
  if (!Array.isArray(lesson.pages) || lesson.pages.length !== targetPageCount) {
    throw new AgentRuntimeError("approved lesson pages length must match targetPageCount", "INVALID_LESSON");
  }
  for (const page of lesson.pages) {
    validatePage(page);
  }
  if (!Array.isArray(lesson.misconceptions) || !Array.isArray(lesson.transferTasks)) {
    throw new AgentRuntimeError("approved lesson misconceptions and transferTasks must be arrays", "INVALID_LESSON");
  }
  for (const misconception of lesson.misconceptions) {
    validateMisconception(misconception);
  }
  for (const transferTask of lesson.transferTasks) {
    validateTransferTask(transferTask);
  }
  if (!isStringArray(lesson.summary)) {
    throw new AgentRuntimeError("approved lesson summary must be strings", "INVALID_LESSON");
  }
}

function validatePage(page: unknown): asserts page is LessonPageLike {
  if (!isRecord(page)) {
    throw new AgentRuntimeError("approved lesson page must be an object", "INVALID_LESSON");
  }
  if (
    !isNonEmptyString(page.id) ||
    !isNonEmptyString(page.type) ||
    !isNonEmptyString(page.title) ||
    !isNonEmptyString(page.learningGoal) ||
    !isNonEmptyString(page.narrative)
  ) {
    throw new AgentRuntimeError("approved lesson page is missing required strings", "INVALID_LESSON");
  }
  if (!LESSON_PAGE_TYPES.has(page.type)) {
    throw new AgentRuntimeError("approved lesson page has invalid type", "INVALID_LESSON");
  }
  if (page.visualSpec !== undefined) {
    validateVisualSpec(page.visualSpec);
  }
  if (page.interactionSpec !== undefined) {
    validateInteractionSpec(page.interactionSpec);
  }
  if (page.assessmentSpec !== undefined) {
    validateAssessmentSpec(page.assessmentSpec);
  }
  if (page.feedbackSpec !== undefined) {
    validateFeedbackSpec(page.feedbackSpec);
  }
  if (page.code !== undefined) {
    validateCode(page.code);
  }
}

function validateMisconception(misconception: unknown): void {
  if (!isRecord(misconception)) {
    throw new AgentRuntimeError("approved lesson misconception must be an object", "INVALID_LESSON");
  }
  if (
    !isString(misconception.id) ||
    !isString(misconception.statement) ||
    !isString(misconception.correction)
  ) {
    throw new AgentRuntimeError("approved lesson misconception is missing required strings", "INVALID_LESSON");
  }
}

function validateTransferTask(transferTask: unknown): void {
  if (!isRecord(transferTask)) {
    throw new AgentRuntimeError("approved lesson transferTask must be an object", "INVALID_LESSON");
  }
  if (
    !isString(transferTask.id) ||
    !isString(transferTask.prompt) ||
    !isString(transferTask.targetMentalModel)
  ) {
    throw new AgentRuntimeError("approved lesson transferTask is missing required strings", "INVALID_LESSON");
  }
}

function validateVisualSpec(visualSpec: unknown): void {
  if (!isRecord(visualSpec)) {
    throw new AgentRuntimeError("approved lesson visualSpec must be an object", "INVALID_LESSON");
  }
  if (!isString(visualSpec.kind) || !VISUAL_KINDS.has(visualSpec.kind)) {
    throw new AgentRuntimeError("approved lesson visualSpec has invalid kind", "INVALID_LESSON");
  }
  if (!isString(visualSpec.description) || !isStringArray(visualSpec.keyElements)) {
    throw new AgentRuntimeError("approved lesson visualSpec is missing required fields", "INVALID_LESSON");
  }
  if (visualSpec.states !== undefined && !isStringArray(visualSpec.states)) {
    throw new AgentRuntimeError("approved lesson visualSpec states must be strings", "INVALID_LESSON");
  }
  if (visualSpec.component !== undefined && (!isString(visualSpec.component) || !VISUAL_COMPONENTS.has(visualSpec.component))) {
    throw new AgentRuntimeError("approved lesson visualSpec has invalid component", "INVALID_LESSON");
  }
}

function validateInteractionSpec(interactionSpec: unknown): void {
  if (!isRecord(interactionSpec)) {
    throw new AgentRuntimeError("approved lesson interactionSpec must be an object", "INVALID_LESSON");
  }
  if (!isString(interactionSpec.kind) || !INTERACTION_KINDS.has(interactionSpec.kind)) {
    throw new AgentRuntimeError("approved lesson interactionSpec has invalid kind", "INVALID_LESSON");
  }
  if (
    !isString(interactionSpec.learnerAction) ||
    !isString(interactionSpec.expectedObservation) ||
    !isString(interactionSpec.cognitivePurpose)
  ) {
    throw new AgentRuntimeError("approved lesson interactionSpec is missing required strings", "INVALID_LESSON");
  }
  if (interactionSpec.options !== undefined) {
    if (!Array.isArray(interactionSpec.options)) {
      throw new AgentRuntimeError("approved lesson interactionSpec options must be an array", "INVALID_LESSON");
    }
    for (const option of interactionSpec.options) {
      validateInteractionOption(option);
    }
  }
}

function validateInteractionOption(option: unknown): void {
  if (!isRecord(option)) {
    throw new AgentRuntimeError("approved lesson interaction option must be an object", "INVALID_LESSON");
  }
  if (
    !isString(option.id) ||
    !isString(option.label) ||
    !isString(option.resultTitle) ||
    !isString(option.outcomeId) ||
    !isString(option.explanation)
  ) {
    throw new AgentRuntimeError("approved lesson interaction option is missing required strings", "INVALID_LESSON");
  }
  if (!isString(option.resultTone) || !RESULT_TONES.has(option.resultTone)) {
    throw new AgentRuntimeError("approved lesson interaction option has invalid resultTone", "INVALID_LESSON");
  }
}

function validateAssessmentSpec(assessmentSpec: unknown): void {
  if (!isRecord(assessmentSpec)) {
    throw new AgentRuntimeError("approved lesson assessmentSpec must be an object", "INVALID_LESSON");
  }
  if (!isString(assessmentSpec.kind) || !ASSESSMENT_KINDS.has(assessmentSpec.kind)) {
    throw new AgentRuntimeError("approved lesson assessmentSpec has invalid kind", "INVALID_LESSON");
  }
  if (!isString(assessmentSpec.prompt)) {
    throw new AgentRuntimeError("approved lesson assessmentSpec is missing prompt", "INVALID_LESSON");
  }
  if (assessmentSpec.options !== undefined && !isStringArray(assessmentSpec.options)) {
    throw new AgentRuntimeError("approved lesson assessmentSpec options must be strings", "INVALID_LESSON");
  }
  if (assessmentSpec.correctAnswer !== undefined && !isString(assessmentSpec.correctAnswer)) {
    throw new AgentRuntimeError("approved lesson assessmentSpec correctAnswer must be a string", "INVALID_LESSON");
  }
}

function validateFeedbackSpec(feedbackSpec: unknown): void {
  if (!isRecord(feedbackSpec)) {
    throw new AgentRuntimeError("approved lesson feedbackSpec must be an object", "INVALID_LESSON");
  }
  if (!isString(feedbackSpec.correctFeedback) || !isString(feedbackSpec.incorrectFeedback)) {
    throw new AgentRuntimeError("approved lesson feedbackSpec is missing required strings", "INVALID_LESSON");
  }
  if (feedbackSpec.misconceptionAddressed !== undefined && !isString(feedbackSpec.misconceptionAddressed)) {
    throw new AgentRuntimeError("approved lesson feedbackSpec misconceptionAddressed must be a string", "INVALID_LESSON");
  }
}

function validateCode(code: unknown): void {
  if (!isRecord(code)) {
    throw new AgentRuntimeError("approved lesson code must be an object", "INVALID_LESSON");
  }
  if (!isString(code.language) || !isString(code.value)) {
    throw new AgentRuntimeError("approved lesson code is missing required strings", "INVALID_LESSON");
  }
}

function assertSafeChildPath(parentPath: string, childSegment: string): string {
  const resolvedParent = path.resolve(parentPath);
  const resolvedChild = path.resolve(resolvedParent, childSegment);
  const relativePath = path.relative(resolvedParent, resolvedChild);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new AgentRuntimeError("lesson.id resolves outside src/lessons", "INVALID_LESSON");
  }

  return resolvedChild;
}

function renderLessonSource(lesson: LessonLike): string {
  return [
    'import type { Lesson } from "../../schemas/lesson.schema";',
    "",
    `export const generatedLesson = ${toTypeScriptLiteral(toSchemaLesson(lesson))} satisfies Lesson;`,
    ""
  ].join("\n");
}

function toSchemaLesson(lesson: LessonLike): Record<string, unknown> {
  return {
    id: lesson.id,
    title: lesson.title,
    audience: lesson.audience,
    config: compactObject({
      targetPageCount: lesson.config.targetPageCount,
      minPageCount: lesson.config.minPageCount,
      maxPageCount: lesson.config.maxPageCount
    }),
    prerequisites: lesson.prerequisites,
    learningObjectives: lesson.learningObjectives,
    pages: lesson.pages.map(toSchemaPage),
    misconceptions: lesson.misconceptions.map((misconception) => {
      const item = misconception as Record<string, unknown>;
      return {
        id: item.id,
        statement: item.statement,
        correction: item.correction
      };
    }),
    transferTasks: lesson.transferTasks.map((transferTask) => {
      const item = transferTask as Record<string, unknown>;
      return {
        id: item.id,
        prompt: item.prompt,
        targetMentalModel: item.targetMentalModel
      };
    }),
    summary: lesson.summary
  };
}

function toSchemaPage(page: LessonPageLike): Record<string, unknown> {
  return compactObject({
    id: page.id,
    type: page.type,
    title: page.title,
    learningGoal: page.learningGoal,
    narrative: page.narrative,
    visualSpec: page.visualSpec === undefined ? undefined : toSchemaVisualSpec(page.visualSpec),
    interactionSpec: page.interactionSpec === undefined ? undefined : toSchemaInteractionSpec(page.interactionSpec),
    assessmentSpec: page.assessmentSpec === undefined ? undefined : toSchemaAssessmentSpec(page.assessmentSpec),
    feedbackSpec: page.feedbackSpec === undefined ? undefined : toSchemaFeedbackSpec(page.feedbackSpec),
    code: page.code === undefined ? undefined : toSchemaCode(page.code)
  });
}

function toSchemaVisualSpec(visualSpec: unknown): Record<string, unknown> {
  const item = visualSpec as Record<string, unknown>;
  return compactObject({
    kind: item.kind,
    description: item.description,
    keyElements: item.keyElements,
    states: item.states,
    component: item.component
  });
}

function toSchemaInteractionSpec(interactionSpec: unknown): Record<string, unknown> {
  const item = interactionSpec as Record<string, unknown>;
  return compactObject({
    kind: item.kind,
    learnerAction: item.learnerAction,
    expectedObservation: item.expectedObservation,
    cognitivePurpose: item.cognitivePurpose,
    options:
      item.options === undefined
        ? undefined
        : (item.options as unknown[]).map((option) => {
            const optionItem = option as Record<string, unknown>;
            return {
              id: optionItem.id,
              label: optionItem.label,
              resultTitle: optionItem.resultTitle,
              outcomeId: optionItem.outcomeId,
              resultTone: optionItem.resultTone,
              explanation: optionItem.explanation
            };
          })
  });
}

function toSchemaAssessmentSpec(assessmentSpec: unknown): Record<string, unknown> {
  const item = assessmentSpec as Record<string, unknown>;
  return compactObject({
    kind: item.kind,
    prompt: item.prompt,
    options: item.options,
    correctAnswer: item.correctAnswer
  });
}

function toSchemaFeedbackSpec(feedbackSpec: unknown): Record<string, unknown> {
  const item = feedbackSpec as Record<string, unknown>;
  return compactObject({
    correctFeedback: item.correctFeedback,
    incorrectFeedback: item.incorrectFeedback,
    misconceptionAddressed: item.misconceptionAddressed
  });
}

function toSchemaCode(code: unknown): Record<string, unknown> {
  const item = code as Record<string, unknown>;
  return {
    language: item.language,
    value: item.value
  };
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function toTypeScriptLiteral(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    return `[\n${indent(value.map((item) => toTypeScriptLiteral(item)).join(",\n"))}\n]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }
    return `{\n${indent(entries.map(([key, item]) => `${formatPropertyKey(key)}: ${toTypeScriptLiteral(item)}`).join(",\n"))}\n}`;
  }
  return JSON.stringify(value);
}

function formatPropertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function indent(value: string): string {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalInteger(value: unknown): boolean {
  return value === undefined || Number.isInteger(value);
}
