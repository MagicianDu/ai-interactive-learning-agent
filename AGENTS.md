# AGENTS.md

## Project Name

AI Interactive Learning Agent

## Mission

Build an AI-driven learning experience system that transforms technical books, articles, notes, and concepts into interactive, visual, action-based, feedback-rich learning experiences.

The goal is not to convert books into web pages. The goal is to reconstruct knowledge into a form that helps learners build correct, durable, transferable mental models.

The first product form is a PPT-like interactive web lesson. Future forms should include canvas/whiteboard maps, playgrounds, AI tutor mode, teacher mode, and assessment mode.

---

## Product Definition

This repository should implement an AI learning experience generator.

Given a technical topic or source material, the system should produce a structured learning unit containing:

1. Learning objectives
2. Prerequisite assumptions
3. A page-by-page learning path
4. Visual explanations
5. Interactive models
6. Action-based learner tasks
7. Quizzes and misconception checks
8. Feedback explanations
9. Transfer tasks
10. A runnable interactive web lesson

The system should prioritize understanding, manipulation, feedback, and transfer over passive reading.

---

## Core Learning Philosophy

### 1. Learning is mental model construction

Learning is not reading more text. Learning means the learner can:

- Understand the concept
- Recall it later
- Use it in real situations
- Transfer it to new situations
- Explain it in their own words
- Detect common misconceptions

Every lesson must help learners build an internal model of how something works.

### 2. Start from problems, not definitions

Do not begin lessons with formal definitions unless the topic absolutely requires it.

Preferred order:

1. Real problem
2. Intuitive situation
3. Visual model
4. Learner action
5. Feedback
6. Formal terminology
7. Code or formula
8. Transfer task

### 3. Prefer visual structure over long prose

Technical concepts often contain hidden structures, flows, states, and causal relationships.

Expose them visually.

Use:

- Diagrams
- Flow charts
- State transitions
- Timelines
- Data structure visualizations
- Architecture maps
- Before/after comparisons
- Step-by-step animations
- Highlighted execution paths

Avoid long explanatory paragraphs when a diagram or interaction can carry the idea more effectively.

### 4. Prefer learner action over passive demonstration

Interaction is not decoration. Every interaction must have cognitive purpose.

Good learner actions include:

- Predicting the next result
- Dragging to reorder a process
- Adjusting a parameter
- Clicking through execution steps
- Modifying code
- Choosing a strategy
- Fixing a wrong system state
- Building a structure from components
- Comparing two approaches
- Explaining a result after observing it

Bad interactions include:

- Decorative hover effects
- Buttons that reveal text without learning value
- Animations that are visually impressive but pedagogically empty

### 5. Every interaction must produce explanatory feedback

Feedback must explain why something happened.

Do not only say:

- Correct
- Incorrect
- Try again

Instead explain:

- What the learner likely assumed
- Why that assumption works or fails
- What causal mechanism produced the result
- What rule or mental model should be updated

### 6. Formal abstraction comes after intuition

Introduce terms, formulas, code, and precise definitions after the learner has seen and manipulated a concrete model.

Preferred sequence:

```text
concrete example
  -> visual model
  -> learner manipulation
  -> feedback
  -> terminology
  -> code/formula
  -> transfer
```

### 7. Design for transfer

Each lesson must end with at least one transfer challenge.

A transfer challenge asks the learner to apply the same concept in a new but related context.

Examples:

- Apply hash table collision handling to cache key design
- Apply database index principles to query optimization
- Apply gradient descent intuition to model training instability
- Apply TCP handshake understanding to debugging connection failures

---

## Product Forms

The system should support multiple output forms over time.

### Phase 1: PPT-like Interactive Web Lesson

This is the first MVP target.

Characteristics:

- Horizontal or vertical page navigation
- One learning objective per page
- Visual-first layout
- Short text
- Interactive components
- Quizzes and feedback
- Runnable in browser
- Easy to share and demo

### Phase 2: Canvas / Whiteboard Knowledge Map

A spatial learning map showing concept dependencies and system structure.

Use this form for:

- Architecture topics
- Complex systems
- Knowledge maps
- Dependency graphs
- Concept relationship exploration

Canvas mode should let learners zoom out to see the whole structure and click nodes to open lesson pages.

### Phase 3: Interactive Playground

A sandbox for experimentation.

Use this form for:

- SQL index exploration
- Gradient descent parameter tuning
- Cache behavior simulation
- RAG pipeline experimentation
- Algorithm execution
- Network protocol simulation

Playground mode should emphasize action, cause, and feedback.

### Phase 4: AI Tutor Mode

A conversational layer that can explain, ask questions, diagnose misconceptions, and control the visual/interactive objects on the page.

The tutor must not replace the visual learning experience. It should guide the learner through it.

### Phase 5: Teacher Mode

Generate materials for teaching:

- Instructor notes
- Classroom questions
- Suggested pacing
- Common misconceptions
- Live demo instructions
- Student exercises
- Post-class review tasks

---

## MVP Goal

Build the first working version of an interactive learning generator.

The MVP should accept a technical topic and generate a complete runnable web lesson.

Recommended first example topic:

```text
Why database indexes make queries faster
```

Alternative topics:

```text
Hash tables
TCP three-way handshake
Transformer attention
RAG workflow
Gradient descent
Docker image layers
Consistent hashing
```

The first implementation should include at least one complete sample lesson.

---

## MVP Output Requirements

Each generated lesson must contain:

1. 8 to 12 pages
2. A clear learning objective list
3. At least 3 visual explanations
4. At least 2 meaningful interactions
5. At least 2 quiz/checkpoint pages
6. At least 1 misconception check
7. At least 1 transfer challenge
8. A summary card
9. A runnable React implementation
10. A structured lesson JSON file

The generated lesson should feel like a high-quality university mini-class, not like a blog post.

---

## Technical Stack

Use a simple, reliable frontend stack.

Preferred:

- React
- TypeScript
- Vite or Next.js
- Tailwind CSS
- Framer Motion for animation when useful
- SVG for diagrams
- Canvas only when SVG is insufficient
- MDX or JSON for structured lesson content

Do not over-engineer the initial version.

Prioritize:

1. Clarity
2. Reusability
3. Component quality
4. Pedagogical value
5. Fast local iteration

---

## Suggested Repository Structure

```text
interactive-learning-agent/
  AGENTS.md
  README.md
  package.json
  tsconfig.json
  vite.config.ts or next.config.js
  src/
    app/
    components/
      deck/
      visual/
      interaction/
      assessment/
      canvas/
      playground/
    lessons/
      database-index/
        lesson.json
        Lesson.tsx
      hash-table/
        lesson.json
        Lesson.tsx
    schemas/
      lesson.schema.ts
    renderers/
      WebDeckRenderer.tsx
      CanvasMapRenderer.tsx
      PlaygroundRenderer.tsx
    styles/
  skills/
    source-ingest/
      SKILL.md
    learning-architecture/
      SKILL.md
    visual-pedagogy/
      SKILL.md
    interaction-design/
      SKILL.md
    assessment-design/
      SKILL.md
    component-build/
      SKILL.md
    lesson-critic/
      SKILL.md
    publish-package/
      SKILL.md
  docs/
    learning-principles.md
    page-types.md
    lesson-schema.md
    quality-rubric.md
    roadmap.md
  examples/
    database-index/
    hash-table/
```

---

## Lesson Object Schema

Before generating UI, generate a structured lesson object.

The lesson object is the source of truth.

Example shape:

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

export type FeedbackSpec = {
  correctFeedback: string;
  incorrectFeedback: string;
  misconceptionAddressed?: string;
};
```

---

## Required Page Types

### 1. problem_scene

Purpose: Create motivation.

Use this page to show the problem before introducing the concept.

Example:

```text
A database has 10 million rows. Without an index, how many rows might it need to inspect?
```

### 2. intuition_visual

Purpose: Build intuitive understanding.

Use analogy, visual metaphor, or simple concrete example.

### 3. structure_diagram

Purpose: Reveal internal structure.

Examples:

- B+ tree structure
- Hash table buckets
- Transformer Q/K/V flow
- TCP state diagram
- RAG pipeline

### 4. process_animation

Purpose: Show how something changes over time.

Examples:

- Query scanning rows
- Tree traversal
- Gradient descent movement
- Packet exchange
- Cache eviction

### 5. interactive_model

Purpose: Let learner manipulate the model.

Examples:

- Adjust table size
- Change learning rate
- Insert hash keys
- Toggle index strategy
- Step through algorithm execution

### 6. code_walkthrough

Purpose: Connect intuition to implementation.

Use short code. Avoid dumping large files.

### 7. quiz

Purpose: Verify understanding.

Must include explanatory feedback.

### 8. misconception_check

Purpose: Surface common wrong beliefs.

Examples:

- "Indexes always make queries faster"
- "A larger cache always improves performance linearly"
- "Attention means the model understands meaning like humans"
- "TCP handshake is only a formality"

### 9. transfer_challenge

Purpose: Apply concept to a new scenario.

### 10. summary_card

Purpose: Compress the mental model into a durable memory aid.

---

## Component Requirements

Create reusable components before implementing many lessons.

Minimum components:

```text
DeckShell
DeckPage
ProgressBar
PageNavigation
ConceptCard
DiagramFrame
AnimatedFlow
StepThrough
ParameterSlider
PredictionPrompt
MultipleChoiceQuiz
DragToOrder
FeedbackPanel
MisconceptionCheck
TransferChallenge
SummaryCard
CodeBlock
CodeWalkthrough
KnowledgeMap
```

Recommended later components:

```text
CanvasKnowledgeMap
WhiteboardNode
WhiteboardEdge
SystemArchitectureMap
ExecutionTimeline
TreeVisualizer
HashTableVisualizer
IndexScanVisualizer
AttentionVisualizer
RAGPipelineVisualizer
CacheSimulator
GradientDescentSimulator
```

---

## Visual Design Principles

Use a clean, teaching-oriented visual style.

Prefer:

- High contrast
- Clear hierarchy
- Large readable typography
- Minimal decoration
- Spacious layouts
- Consistent component styles
- Visual focus on one idea per page
- Explicit labels
- Progressive disclosure

Avoid:

- Dense paragraphs
- Tiny labels
- Decorative illustrations without teaching purpose
- Overly complex animations
- Multiple competing diagrams on one page
- Unexplained color coding
- Fancy UI that distracts from learning

---

## Interaction Design Principles

Every interaction must answer these questions:

1. What will the learner do?
2. What should the learner notice?
3. What misconception might this reveal?
4. What feedback will the system provide?
5. How does this action improve the mental model?

If an interaction cannot answer these questions, remove it.

Good interaction examples:

```text
Learner adjusts cache size.
System shows hit rate curve.
Feedback explains diminishing returns.
```

```text
Learner predicts which B+ tree path a query will follow.
System highlights actual path.
Feedback explains why the index narrows the search.
```

```text
Learner changes learning rate.
System shows loss curve behavior.
Feedback explains under-shooting, stable convergence, or divergence.
```

---

## Assessment Design Principles

Each lesson must include:

1. Recall check
2. Prediction check
3. Misconception check
4. Transfer challenge

Avoid trivia questions.

Prefer questions that test mental model quality.

Bad:

```text
What is the definition of a B+ tree?
```

Better:

```text
A query filters by column B, but the composite index is on (A, B). Why might the index not be fully useful?
```

Bad:

```text
What does TCP stand for?
```

Better:

```text
If the client sends SYN but never receives SYN-ACK, which stage of the connection failed?
```

---

## Quality Rubric

Before considering a lesson complete, verify:

### Learning Path

- The lesson starts with a concrete problem.
- The concept sequence is coherent.
- Each page has one clear learning goal.
- The lesson moves from concrete to abstract.
- The lesson ends with transfer.

### Visual Quality

- Key structures are visualized.
- Diagrams are labeled clearly.
- Visuals explain rather than decorate.
- Animation shows meaningful state change.

### Interaction Quality

- Interactions require learner thinking.
- Each interaction has immediate feedback.
- Interactions reveal cause and effect.
- Interactions are not decorative.

### Content Quality

- Text is concise.
- Technical claims are accurate.
- Terminology is introduced after intuition.
- Code examples are short and purposeful.
- Common misconceptions are addressed.

### Product Quality

- The lesson runs locally.
- Components are reusable.
- The schema is clear.
- The implementation is maintainable.
- The UI is responsive enough for laptop and tablet screens.

---

## Codex Workflow

When asked to build or modify this project, follow this workflow:

1. Inspect the repository structure.
2. Read this `AGENTS.md`.
3. Identify whether the task is about:
   - lesson design
   - component development
   - schema design
   - visual/interaction design
   - assessment design
   - bug fixing
   - packaging
4. If relevant, create or update structured lesson JSON before UI implementation.
5. Implement reusable components before one-off page logic when practical.
6. Keep pages simple and pedagogically meaningful.
7. Run available checks before final response:
   - typecheck
   - lint
   - tests
   - local build
8. Report what changed and how to run it.

Do not skip the learning design step and jump directly into styling.

---

## Skills to Create

Create these skills under `skills/`.

Each skill should have a `SKILL.md` file with:

- name
- description
- when to use
- inputs
- outputs
- step-by-step workflow
- quality checklist

### 1. source-ingest

Purpose:

Extract key ideas from books, articles, notes, or pasted technical text.

Output:

```json
{
  "concepts": [],
  "dependencies": [],
  "examples": [],
  "misconceptions": [],
  "candidateInteractions": []
}
```

### 2. learning-architecture

Purpose:

Turn concepts into a coherent learning path.

Output:

```json
{
  "audience": "",
  "prerequisites": [],
  "learningObjectives": [],
  "pageSequence": []
}
```

### 3. visual-pedagogy

Purpose:

Decide which concepts need diagrams, animations, comparisons, or visual metaphors.

Output:

```json
{
  "visualPlan": [
    {
      "pageId": "",
      "visualType": "",
      "teachingPurpose": "",
      "elements": []
    }
  ]
}
```

### 4. interaction-design

Purpose:

Convert concepts into meaningful learner actions.

Output:

```json
{
  "interactions": [
    {
      "pageId": "",
      "interactionType": "",
      "learnerAction": "",
      "expectedObservation": "",
      "feedback": "",
      "misconceptionAddressed": ""
    }
  ]
}
```

### 5. assessment-design

Purpose:

Generate quizzes, prediction tasks, misconception checks, and transfer tasks.

Output:

```json
{
  "assessments": [
    {
      "type": "",
      "prompt": "",
      "options": [],
      "answer": "",
      "feedback": ""
    }
  ]
}
```

### 6. component-build

Purpose:

Implement reusable React components for the learning experience.

Output:

- Component files
- Example usage
- Props documentation
- Basic tests if test setup exists

### 7. lesson-critic

Purpose:

Review a lesson against learning principles and quality rubric.

Output:

```json
{
  "score": 0,
  "strengths": [],
  "issues": [],
  "requiredFixes": [],
  "optionalImprovements": []
}
```

### 8. publish-package

Purpose:

Package the lesson as a runnable static web experience.

Output:

- Build instructions
- Deployable artifacts
- README updates
- Demo route

---

## Initial Implementation Task

Start by building a complete MVP for this topic:

```text
Why database indexes make queries faster
```

### Required lesson outline

Create 10 pages:

1. Problem scene: querying 10 million rows
2. Intuition: searching a book with and without an index
3. Structure: table rows vs index structure
4. Process: full table scan animation
5. Process: indexed lookup animation
6. Interaction: choose query conditions and see scan path
7. Misconception: indexes always help
8. Code/SQL walkthrough: simple index examples
9. Transfer challenge: decide whether an index helps
10. Summary card

### Required interactions

At minimum implement:

1. A query path visualizer
   - Learner selects query condition
   - System shows whether it uses full scan or index lookup
   - Feedback explains why

2. An index tradeoff checker
   - Learner chooses whether to add an index
   - System explains read benefit and write/storage cost

### Required assessments

Include:

1. One multiple choice quiz
2. One prediction task
3. One misconception check
4. One transfer challenge

---

## Implementation Notes

Keep the first version simple.

For visualizations, SVG is preferred.

Use mock data. Do not connect to a real database.

The goal is learning experience quality, not database engine fidelity.

However, avoid false technical claims.

Important concepts to include:

- Full table scan
- Index lookup
- Search space reduction
- B+ tree intuition
- Selectivity
- Composite index order
- Index tradeoffs
- Write overhead
- Storage overhead
- Not every query benefits from every index

---

## Definition of Done for MVP

The MVP is done when:

1. `npm install` works.
2. `npm run dev` starts the app.
3. A user can open the database index lesson.
4. The lesson has 10 pages.
5. Navigation works.
6. Visual diagrams render.
7. At least 2 interactions work.
8. Quizzes provide explanatory feedback.
9. Lesson content is also represented in structured JSON or TypeScript data.
10. README explains how to run and extend the project.

---

## Final Reminder

Do not build a generic slideshow app.

Build the foundation of an AI learning experience system.

The key product idea is:

```text
Transform technical knowledge into visual, interactive, action-based, feedback-rich learning experiences that help learners build transferable mental models.
```
