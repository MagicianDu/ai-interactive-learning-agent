# Lesson Schema

The structured lesson object is the source of truth. UI renderers should consume the lesson object instead of hard-coding lesson content.

## Lesson

```ts
export type Lesson = {
  id: string;
  title: string;
  audience: string;
  prerequisites: string[];
  learningObjectives: string[];
  pages: LessonPage[];
  misconceptions: Misconception[];
  transferTasks: TransferTask[];
  summary: string[];
};
```

## LessonPage

```ts
export type LessonPage = {
  id: string;
  type:
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
  title: string;
  learningGoal: string;
  narrative: string;
  visualSpec?: VisualSpec;
  interactionSpec?: InteractionSpec;
  assessmentSpec?: AssessmentSpec;
  feedbackSpec?: FeedbackSpec;
};
```

## VisualSpec

```ts
export type VisualSpec = {
  kind:
    | "diagram"
    | "flow"
    | "timeline"
    | "tree"
    | "table"
    | "graph"
    | "architecture"
    | "animation";
  description: string;
  keyElements: string[];
  states?: string[];
};
```

## InteractionSpec

```ts
export type InteractionSpec = {
  kind:
    | "stepper"
    | "slider"
    | "drag_drop"
    | "prediction"
    | "choice"
    | "code_edit"
    | "parameter_experiment"
    | "build_from_parts";
  learnerAction: string;
  expectedObservation: string;
  cognitivePurpose: string;
};
```

## AssessmentSpec

```ts
export type AssessmentSpec = {
  kind:
    | "multiple_choice"
    | "true_false"
    | "ordering"
    | "prediction"
    | "debugging"
    | "short_answer"
    | "transfer";
  prompt: string;
  options?: string[];
  correctAnswer?: string;
};
```

## FeedbackSpec

```ts
export type FeedbackSpec = {
  correctFeedback: string;
  incorrectFeedback: string;
  misconceptionAddressed?: string;
};
```

