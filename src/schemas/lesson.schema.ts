export type LessonPageType =
  | "problem_scene"
  | "intuition_visual"
  | "structure_diagram"
  | "process_animation"
  | "interactive_model"
  | "code_walkthrough"
  | "quiz"
  | "misconception_check"
  | "transfer_challenge"
  | "summary_card";

export type VisualKind =
  | "diagram"
  | "flow"
  | "timeline"
  | "tree"
  | "table"
  | "graph"
  | "architecture"
  | "animation";

export type InteractionKind =
  | "stepper"
  | "slider"
  | "drag_drop"
  | "prediction"
  | "choice"
  | "code_edit"
  | "parameter_experiment"
  | "build_from_parts"
  | "query_path"
  | "index_tradeoff";

export type AssessmentKind =
  | "multiple_choice"
  | "true_false"
  | "ordering"
  | "prediction"
  | "debugging"
  | "short_answer"
  | "transfer";

export type LessonConfig = {
  targetPageCount: number;
  minPageCount?: number;
  maxPageCount?: number;
};

export type VisualSpec = {
  kind: VisualKind;
  description: string;
  keyElements: string[];
  states?: string[];
  component?:
    | "table_scan"
    | "book_index"
    | "index_tree"
    | "access_path"
    | "tradeoff"
    | "summary";
};

export type InteractionOption = {
  id: string;
  label: string;
  resultTitle: string;
  outcomeId: string;
  resultTone: "neutral" | "success" | "warning" | "danger";
  explanation: string;
};

export type InteractionSpec = {
  kind: InteractionKind;
  learnerAction: string;
  expectedObservation: string;
  cognitivePurpose: string;
  options?: InteractionOption[];
};

export type AssessmentSpec = {
  kind: AssessmentKind;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
};

export type FeedbackSpec = {
  correctFeedback: string;
  incorrectFeedback: string;
  misconceptionAddressed?: string;
};

export type LessonPage = {
  id: string;
  type: LessonPageType;
  title: string;
  learningGoal: string;
  narrative: string;
  visualSpec?: VisualSpec;
  interactionSpec?: InteractionSpec;
  assessmentSpec?: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
  code?: {
    language: string;
    value: string;
  };
};

export type Misconception = {
  id: string;
  statement: string;
  correction: string;
};

export type TransferTask = {
  id: string;
  prompt: string;
  targetMentalModel: string;
};

export type Lesson = {
  id: string;
  title: string;
  audience: string;
  config: LessonConfig;
  prerequisites: string[];
  learningObjectives: string[];
  pages: LessonPage[];
  misconceptions: Misconception[];
  transferTasks: TransferTask[];
  summary: string[];
};

export function getPageCountLabel(lesson: Lesson): string {
  return `${lesson.pages.length} pages, target ${lesson.config.targetPageCount}`;
}
