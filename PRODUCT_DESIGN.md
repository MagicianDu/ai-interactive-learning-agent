# PRODUCT_DESIGN.md

## Project: AI Interactive Learning Agent

## One-line Definition

AI Interactive Learning Agent is a system that transforms technical books, articles, notes, and concepts into multi-form learning experiences: interactive web lessons, canvas knowledge maps, playgrounds, AI tutor sessions, teacher materials, and assessment workflows.

The product is not a slideshow generator. It is not an e-book converter. It is a learning experience generation system.

---

## Core Thesis

Most technical books are optimized for explanation and completeness, not for fast mental model formation.

This project assumes that effective technical learning should be rebuilt around:

1. Visual understanding
2. Learner action
3. Immediate feedback
4. Mental model construction
5. Misconception diagnosis
6. Transfer practice
7. Adaptive support

The product should reconstruct technical knowledge into forms that learners can see, manipulate, test, and apply.

---

## Product North Star

Help learners build correct, durable, transferable mental models faster than traditional technical books, videos, or passive tutorials.

A successful learning unit should let the learner:

- Understand the core idea
- See the structure or process
- Manipulate the concept
- Receive explanatory feedback
- Detect their own misconception
- Apply the idea to a new situation
- Summarize the concept accurately

---

## Language And Localization

The default generated learning experience is Chinese-first.

For the MVP and near-term product, generated lesson content should use Chinese for:

- Page titles
- Learning goals
- Narrative prompts
- Learner actions
- Feedback explanations
- Quiz prompts and options
- Misconception checks
- Transfer challenges
- Summary cards
- Primary UI labels

English technical tokens can remain when they are the standard operational vocabulary, such as SQL, WHERE, index, key, B+ tree, cache, or API. When those terms appear, the surrounding explanation should still be Chinese and should make the term's meaning clear from context.

This is a product requirement, not a styling preference: the system should optimize for Chinese learners by default unless the run config explicitly requests another output language.

---

## System Overview

The system has three major layers:

```text
Source Layer
  Books / Articles / Notes / Docs / Topics / Code / Papers
        ↓
Agent Generation Layer
  Learning Architect
  Content Distiller
  Visual Pedagogy Designer
  Interaction Designer
  Assessment Designer
  Frontend Builder
  Lesson Critic
        ↓
Learning Object Layer
  Structured lesson schema
  Visual specs
  Interaction specs
  Assessment specs
  Feedback specs
  Misconception models
  Transfer tasks
        ↓
Experience Layer
  Web Deck
  Canvas / Whiteboard
  Playground
  AI Tutor
  Teacher Mode
  Assessment Mode
```

The most important layer is the Learning Object Layer. It allows one learning unit to be rendered into many product forms.

---

## Key Architectural Principle

Do not generate UI directly from raw content.

Always follow this pipeline:

```text
Raw source
  → Concept extraction
  → Learning objective design
  → Mental model design
  → Page/experience planning
  → Visual design
  → Interaction design
  → Assessment design
  → Structured lesson object
  → UI rendering
  → Critique and iteration
```

This ensures the system does not become a generic content-to-page converter.

---

## Product Forms

The product should evolve through several forms. These forms are not mutually exclusive. They should eventually work together.

---

# Phase 1: Web Deck

## Definition

A Web Deck is a PPT-like interactive web lesson.

It presents a concept as a sequence of focused pages. Each page has one learning goal and may contain diagrams, animation, interaction, quiz, or feedback.

## Purpose

Web Deck is the best first product form because it is:

- Easy to build
- Easy to share
- Easy to demo
- Easy to evaluate
- Familiar to learners
- Well suited to Codex and React generation

## User Experience

The learner moves through a sequence like a class lecture:

```text
Problem
  → Intuition
  → Visual model
  → Interactive manipulation
  → Formalization
  → Practice
  → Misconception check
  → Transfer
  → Summary
```

## Core Components

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
FeedbackPanel
MisconceptionCheck
TransferChallenge
SummaryCard
```

## Suitable Topics

- Data structures
- Algorithms
- Computer networks
- Databases
- Operating systems
- Machine learning
- System design
- AI engineering
- Programming language concepts

## Example

Topic: Why database indexes make queries faster

Pages:

```text
1. Querying 10 million rows
2. Searching a book with and without an index
3. Table rows vs index structure
4. Full table scan animation
5. Indexed lookup animation
6. Query path visualizer
7. Misconception: indexes always help
8. SQL walkthrough
9. Transfer challenge
10. Summary card
```

## Success Criteria

A Web Deck is successful when:

- Learners can finish it in 5–15 minutes
- Visuals reduce explanation length
- Interactions reveal cause and effect
- Feedback corrects misconceptions
- The learner can apply the concept after the lesson

---

# Phase 2: Canvas / Whiteboard Knowledge Map

## Definition

A Canvas or Whiteboard is a spatial learning environment that shows concepts, systems, dependencies, and relationships in two dimensions.

It is not a linear lesson. It is a map.

## Purpose

Web Deck is good for guided learning. Canvas is good for structural understanding.

Canvas helps learners answer:

- What is the whole system?
- Where am I in the topic?
- Which concepts depend on which?
- How do modules relate?
- What should I learn next?
- How does this concept connect to other concepts?

## User Experience

The learner opens a topic map.

Example: RAG System

```text
User Query
  → Query Rewrite
  → Embedding
  → Vector Search
  → Reranking
  → Context Packing
  → LLM Generation
  → Evaluation
```

Each node can be clicked.

A clicked node can open:

- A short explanation
- A Web Deck
- A Playground
- A quiz
- Related misconceptions
- Prerequisites
- Next steps

## Core Components

```text
CanvasKnowledgeMap
WhiteboardNode
WhiteboardEdge
ZoomableViewport
ConceptDependencyGraph
ExpandableNode
LessonLauncher
ProgressOverlay
MisconceptionMarkers
```

## Suitable Topics

- System design
- Distributed systems
- AI pipelines
- RAG
- Compiler architecture
- Operating system architecture
- Networking stacks
- Database internals
- ML model training pipelines

## Relationship with Web Deck

Canvas should not replace Web Deck.

Recommended relationship:

```text
Canvas = global map and exploration
Web Deck = guided learning path
Playground = hands-on experimentation
Tutor = personalized explanation
```

## Success Criteria

A Canvas experience is successful when:

- Learners can see the big picture
- Dependencies are clear
- Navigation is meaningful
- Complex systems feel less overwhelming
- Learners can drill into specific nodes

---

# Phase 3: Interactive Playground

## Definition

A Playground is a sandbox where learners change inputs, parameters, or strategies and observe consequences.

It is the strongest expression of action-based learning.

## Purpose

Playground helps learners develop causal understanding.

Instead of reading:

```text
A larger cache can improve hit rate, but with diminishing returns.
```

The learner can adjust cache size and see the hit rate curve change.

## User Experience

The learner manipulates a system:

- Change a parameter
- Select a strategy
- Modify input
- Step through execution
- Observe output
- Compare alternatives
- Receive feedback

## Core Components

```text
ParameterControl
StateVisualizer
ExecutionStepper
MetricPanel
ScenarioSelector
BeforeAfterComparison
StrategyToggle
FeedbackExplainer
ExperimentHistory
```

## Suitable Topics

### Databases

```text
SQL index playground
Query plan visualizer
Composite index simulator
Selectivity experiment
```

### Machine Learning

```text
Gradient descent simulator
Decision boundary playground
Overfitting/regularization explorer
Attention weight visualizer
```

### Systems

```text
Cache simulator
Load balancer simulator
Queue backpressure simulator
Rate limiter playground
```

### AI Engineering

```text
RAG chunk size simulator
Top-k retrieval experiment
Reranking comparison
Prompt/context packing explorer
```

### Algorithms

```text
Sorting visualizer
Graph traversal explorer
Dynamic programming table builder
Hash table collision simulator
```

## Success Criteria

A Playground is successful when:

- Learners can predict outcomes before running experiments
- Parameter changes produce visible effects
- The system explains why results changed
- Learners discover tradeoffs through manipulation
- Learners can transfer the causal model to real scenarios

---

# Phase 4: AI Tutor Mode

## Definition

AI Tutor Mode is a conversational layer that guides learners through visual and interactive learning objects.

The AI tutor should be able to reference and manipulate the current lesson state.

## Purpose

Passive chat explanations are not enough. The tutor should work with visual and interactive objects.

The tutor should:

- Ask diagnostic questions
- Explain diagrams
- Suggest which interaction to try
- Interpret learner answers
- Detect misconceptions
- Generate extra examples
- Adjust difficulty
- Route the learner to prerequisite content
- Summarize progress

## User Experience

Example:

```text
Learner: I still don't understand why a composite index on (A, B) may not help WHERE B = 3.

Tutor: Look at the index ordering on the right. The tree is first grouped by A. Try selecting a query without A.

Learner selects WHERE B = 3.

Tutor: Notice that the system cannot jump directly to all B = 3 values because B is only ordered inside each A group. That is why the leading column matters.
```

## Required Capabilities

AI Tutor should be able to access:

- Current lesson page
- Learner answers
- Interaction state
- Quiz results
- Misconception records
- Learning objectives
- Available prerequisite lessons

## Core Components

```text
TutorPanel
TutorMessage
GuidedHint
DiagnosticQuestion
StateAwareExplanation
FollowUpGenerator
RemediationRouter
```

## Success Criteria

AI Tutor Mode is successful when:

- Learners receive context-aware help
- Explanations reference the current visual state
- Misconceptions are diagnosed, not just answered
- The tutor guides action instead of replacing action
- Learners can recover from confusion without leaving the lesson

---

# Phase 5: Teacher Mode

## Definition

Teacher Mode turns a learning unit into classroom-ready teaching material.

It supports instructors, trainers, and content creators.

## Purpose

Interactive lessons should be usable in:

- University classes
- Coding bootcamps
- Enterprise training
- Internal engineering education
- Workshops
- Live demos

## Outputs

Teacher Mode should generate:

```text
Instructor notes
Teaching goals
Classroom pacing
Suggested questions
Live demo instructions
Common misconceptions
Student exercises
Homework tasks
Discussion prompts
Assessment rubric
```

## User Experience

An instructor can open a lesson and switch to Teacher View.

Teacher View shows:

- What to emphasize
- Where learners usually struggle
- Which page to spend more time on
- Which question to ask before revealing an answer
- Which interaction works well as a live demo
- Which transfer challenge to assign

## Success Criteria

Teacher Mode is successful when:

- An instructor can teach the lesson with minimal preparation
- The lesson supports both presentation and student interaction
- Common misconceptions are anticipated
- Classroom discussion is built into the flow
- The same learning object can support self-study and live teaching

---

# Phase 6: Assessment and Mastery Mode

## Definition

Assessment Mode evaluates whether the learner has actually mastered the concept.

It should go beyond simple quizzes.

## Purpose

The product should measure mental model quality, not trivia recall.

Assessment should test:

- Recall
- Prediction
- Explanation
- Debugging
- Transfer
- Misconception resistance
- Strategy choice

## Assessment Types

```text
Multiple choice with feedback
Prediction before simulation
Drag-to-order process reconstruction
Debug the wrong diagram
Choose the better system design
Explain the observed behavior
Apply the concept to a new scenario
Compare tradeoffs
```

## Mastery Signals

Possible learner mastery signals:

```text
Can explain the concept in own words
Can predict system behavior
Can identify when the concept applies
Can identify when the concept does not apply
Can debug a mistaken application
Can transfer the idea to a new case
```

## Success Criteria

Assessment Mode is successful when:

- It reveals shallow understanding
- It diagnoses misconception patterns
- It recommends remediation
- It tracks progress over time
- It helps the learner know what to study next

---

# Phase 7: Adaptive Learning Path

## Definition

Adaptive Learning Path uses learner performance to dynamically choose what to show next.

## Purpose

Different learners need different paths.

A beginner may need more intuition. An advanced learner may want direct playgrounds and edge cases.

## Behavior

The system should adapt based on:

- Quiz errors
- Interaction behavior
- Misconception checks
- Self-reported confidence
- Time spent
- Repeated failed attempts
- Transfer task performance

## Example

```text
Learner fails composite index transfer challenge.
  ↓
System identifies likely gap: index ordering.
  ↓
System recommends a short prerequisite micro-lesson.
  ↓
Learner completes a visual ordering exercise.
  ↓
System returns to the original transfer challenge.
```

## Success Criteria

Adaptive Learning is successful when:

- Learners spend less time on things they already know
- Learners receive targeted remediation
- Learning paths feel personalized
- Mastery improves over repeated sessions

---

## Product Roadmap

## Stage 0: Foundation

Goal: Create project rules, schemas, and reusable components.

Deliverables:

```text
AGENTS.md
PRODUCT_DESIGN.md
lesson schema
page type definitions
quality rubric
base React app
core Deck components
```

## Stage 1: MVP Web Deck

Goal: Build the first complete interactive lesson.

Recommended topic:

```text
Why database indexes make queries faster
```

Deliverables:

```text
10-page Web Deck
lesson.json
interactive query path visualizer
index tradeoff checker
quizzes with feedback
summary card
README
```

## Stage 2: Lesson Generation Workflow

Goal: Codify the agent workflow for creating new lessons.

Deliverables:

```text
skills/source-ingest/SKILL.md
skills/learning-architecture/SKILL.md
skills/visual-pedagogy/SKILL.md
skills/interaction-design/SKILL.md
skills/assessment-design/SKILL.md
skills/component-build/SKILL.md
skills/lesson-critic/SKILL.md
skills/publish-package/SKILL.md
```

## Stage 3: Component Library Expansion

Goal: Build reusable visual and interactive components.

Deliverables:

```text
HashTableVisualizer
TreeVisualizer
IndexScanVisualizer
ExecutionTimeline
AnimatedPacketFlow
AttentionVisualizer
RAGPipelineVisualizer
GradientDescentSimulator
CacheSimulator
```

## Stage 4: Canvas Knowledge Map

Goal: Add a spatial concept map view.

Deliverables:

```text
CanvasKnowledgeMap
node/edge schema
lesson-to-map renderer
click node to open lesson
topic dependency visualization
```

## Stage 5: Playground Framework

Goal: Build sandbox-style experiment pages.

Deliverables:

```text
parameter controls
state visualization
metric panels
scenario presets
experiment feedback
history comparison
```

## Stage 6: AI Tutor Integration

Goal: Add a tutor panel that understands lesson state.

Deliverables:

```text
TutorPanel
lesson-state API
interaction-state API
diagnostic prompt templates
hint generation
misconception remediation
```

## Stage 7: Teacher and Assessment Modes

Goal: Support classroom and mastery evaluation use cases.

Deliverables:

```text
Teacher View
instructor notes generator
classroom question generator
mastery assessment mode
progress model
remediation recommendations
```

## Stage 8: Multi-topic Library

Goal: Create a growing library of high-quality interactive technical lessons.

Initial library candidates:

```text
Database indexes
Hash tables
TCP three-way handshake
Transformer attention
RAG workflow
Gradient descent
Docker image layers
Consistent hashing
Cache eviction policies
Dynamic programming
B+ tree
Message queue backpressure
Rate limiting
```

---

## Learning Object as Core Asset

The Learning Object is the central abstraction.

It should contain:

```text
Concept model
Learning objectives
Prerequisites
Page sequence
Visual specs
Interaction specs
Assessment specs
Feedback specs
Misconceptions
Transfer tasks
Teacher notes
Adaptive hints
```

A single Learning Object should be renderable as:

```text
Web Deck
Canvas node
Playground activity
AI Tutor session
Teacher lesson plan
Assessment pack
Review card
```

This avoids locking the product into one UI form.

---

## Experience Composition Model

The product should eventually support composing experiences.

Example:

```text
Topic: Database Indexes

Canvas Map:
  Database query performance
    ├── Full table scan
    ├── B+ tree index
    ├── Selectivity
    ├── Composite index
    ├── Covering index
    ├── Write overhead
    └── Execution plan

Each node may link to:
  Web Deck
  Mini Playground
  Quiz
  Tutor explanation
  Teacher notes
```

---

## Agent Roles

The AI system should be decomposed into specialized roles.

## 1. Learning Architect Agent

Responsibilities:

- Define learner audience
- Define prerequisites
- Define learning objectives
- Build learning sequence
- Ensure concrete-to-abstract progression
- Ensure transfer at the end

## 2. Content Distiller Agent

Responsibilities:

- Extract key concepts from source material
- Remove redundancy
- Preserve technical accuracy
- Identify examples and edge cases
- Identify terms requiring definition

## 3. Visual Pedagogy Agent

Responsibilities:

- Decide what should be visualized
- Choose diagram types
- Specify visual states
- Design animations
- Prevent decorative visuals

## 4. Interaction Designer Agent

Responsibilities:

- Define learner actions
- Connect actions to cognitive purpose
- Define expected observations
- Define feedback
- Avoid meaningless interaction

## 5. Assessment Designer Agent

Responsibilities:

- Create quiz questions
- Create prediction tasks
- Create misconception checks
- Create transfer challenges
- Write explanatory feedback

## 6. Frontend Builder Agent

Responsibilities:

- Implement React components
- Render lesson objects
- Build reusable visual components
- Maintain code quality
- Keep UI clear and accessible

## 7. Lesson Critic Agent

Responsibilities:

- Review against learning principles
- Detect overly textual pages
- Detect weak interactions
- Detect missing feedback
- Detect missing transfer
- Suggest required fixes

## 8. Publisher Agent

Responsibilities:

- Package lessons
- Update README
- Prepare static builds
- Generate demo routes
- Ensure run instructions work

---

## Evaluation Framework

The product should evaluate lessons using four dimensions.

## 1. Pedagogical Quality

Questions:

```text
Does the lesson start from a meaningful problem?
Does it build intuition before abstraction?
Does each page have one learning goal?
Does it include misconception checks?
Does it include transfer?
```

## 2. Visual Quality

Questions:

```text
Are hidden structures made visible?
Are diagrams labeled clearly?
Do visuals reduce text burden?
Do animations show meaningful change?
```

## 3. Interaction Quality

Questions:

```text
Does the learner take meaningful action?
Does the action reveal cause and effect?
Is there immediate explanatory feedback?
Does interaction improve the mental model?
```

## 4. Technical Quality

Questions:

```text
Does the app run?
Is the code maintainable?
Are components reusable?
Is lesson content structured?
Is the UI responsive enough?
```

---

## Key Product Risks

## Risk 1: Becoming a prettier e-book

Mitigation:

- Enforce action and feedback requirements
- Reject pages that are mostly text
- Use visual and interaction rubrics

## Risk 2: Decorative interactivity

Mitigation:

- Every interaction must have cognitive purpose
- Require expected observation and feedback
- Use Lesson Critic Agent

## Risk 3: Technical inaccuracy

Mitigation:

- Keep first lessons scoped
- Use trusted source material
- Review claims manually when needed
- Add technical notes and caveats

## Risk 4: Overbuilding platform too early

Mitigation:

- Start with one high-quality Web Deck
- Build only reusable components needed by real lessons
- Add Canvas and Playground after proving learning value

## Risk 5: Agent output inconsistency

Mitigation:

- Use structured schemas
- Use skills
- Use rubrics
- Build examples
- Prefer component assembly over free-form UI generation

---

## Strategic Positioning

This product should not be positioned as:

```text
AI summary tool
AI slideshow generator
AI course generator
AI textbook converter
```

Better positioning:

```text
AI learning experience agent
Interactive technical learning system
Visual and action-based learning generator
AI system for reconstructing technical knowledge into learnable objects
```

Suggested product statement:

```text
An AI agent that turns technical knowledge into visual, interactive, feedback-rich learning experiences for building transferable mental models.
```

---

## Immediate Next Step

Use `AGENTS.md` to start implementation.

Use this document as the product architecture and roadmap reference.

First concrete build target:

```text
Build the database index Web Deck MVP.
```

After MVP is working, extend in this order:

```text
1. Generalize lesson schema
2. Add more reusable components
3. Add skills workflow
4. Add Canvas knowledge map
5. Add Playground framework
6. Add AI Tutor state integration
7. Add Teacher and Assessment modes
```

---

## Final Principle

The product should always optimize for this:

```text
More seeing.
More doing.
More feedback.
Less passive reading.
Faster mental model formation.
Better transfer.
```
