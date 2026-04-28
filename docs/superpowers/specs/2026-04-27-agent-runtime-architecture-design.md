# Agent Runtime Architecture Design

## Purpose

Define the real target shape of AI Interactive Learning Agent as an interactive, multi-agent learning experience generation system that can run across different agent frameworks and model providers.

The Web Deck MVP remains important, but it is not the whole product. It is the first rendered output form and first acceptance sample for the larger system.

## Product Target

The completed system should let a user provide a topic or source material, choose generation constraints, interact with the generation process, and produce a high-quality learning experience package.

The system should support:

- Multi-agent generation workflow
- User-specified model/provider choices
- User-specified lesson constraints, including page count
- Interactive clarification and approval gates
- Cross-runtime execution, including Codex, Claude Code, and other agent-capable CLIs or environments
- Structured intermediate artifacts
- Runnable output packages such as Web Deck lessons

## Design Principle

Do not bind the product to one agent runtime.

The core product should be defined by portable contracts:

```text
Agent role contract
  -> model/provider contract
  -> artifact contract
  -> orchestration contract
  -> runtime adapter
```

Codex, Claude Code, Gemini CLI, or a future custom runner should be adapters over the same workflow, not separate product implementations.

## System Layers

```text
User / Operator
  -> Interactive Session Layer
  -> Orchestration Layer
  -> Agent Role Layer
  -> Model Provider Layer
  -> Artifact Store
  -> Renderer / Publisher Layer
```

### 1. Interactive Session Layer

Owns the conversation with the user.

Responsibilities:

- Collect topic, source, audience, constraints, and target output form
- Ask clarification questions one at a time when needed
- Present intermediate plans for approval
- Let the user adjust page count, depth, tone, interaction density, or output form
- Report progress and blockers
- Decide when to continue, revise, or stop

Initial interface:

- Agent CLI interaction through Codex or Claude Code

Future interface:

- Web app control panel
- Local desktop app
- Teacher-facing workflow UI

### 2. Orchestration Layer

Coordinates agents and artifact flow.

Responsibilities:

- Decide which agents run and in what order
- Pass structured artifacts between agents
- Track artifact versions
- Enforce approval gates
- Run critique and revision loops
- Produce a final package

The orchestration layer should be explicit enough to run in different frameworks. It should not depend on hidden chat state.

### 3. Agent Role Layer

Each agent has a focused responsibility, input contract, and output contract.

Initial roles:

- Source Ingest Agent
- Learning Architecture Agent
- Visual Pedagogy Agent
- Interaction Design Agent
- Assessment Design Agent
- Lesson Assembly Agent
- Component Build Agent
- Lesson Critic Agent
- Publish Package Agent

Each role may run as:

- A Codex subagent
- A Claude Code task/skill invocation
- A manual step in the current agent session
- A future custom worker process

### 4. Model Provider Layer

Allows choosing the model used by each role.

The system should support a provider-neutral configuration:

```ts
type ModelRef = {
  provider: "openai" | "anthropic" | "google" | "local" | "custom";
  model: string;
  reasoningEffort?: "low" | "medium" | "high";
  temperature?: number;
};
```

Model choice should be assignable at:

- Global workflow level
- Agent role level
- Single task level

Example:

```json
{
  "defaultModel": {
    "provider": "openai",
    "model": "gpt-5.4",
    "reasoningEffort": "medium"
  },
  "roleModels": {
    "lesson-critic": {
      "provider": "anthropic",
      "model": "claude-sonnet",
      "reasoningEffort": "high"
    }
  }
}
```

The first implementation does not need to call external model APIs directly. It should still define the configuration contract so later runners can honor it.

### 5. Artifact Store

Stores durable intermediate and final outputs.

Artifacts should be files, not only chat messages.

Core artifact types:

- `source-ingest.json`
- `learning-architecture.json`
- `visual-plan.json`
- `interaction-plan.json`
- `assessment-plan.json`
- `lesson.json` or `lesson.ts`
- `critic-report.json`
- `implementation-plan.md`
- rendered Web Deck app
- publish package

Recommended artifact directory:

```text
runs/
  <run-id>/
    run.config.json
    artifacts/
      source-ingest.json
      learning-architecture.json
      visual-plan.json
      interaction-plan.json
      assessment-plan.json
      lesson.json
      critic-report.json
    logs/
      orchestration.md
```

Generated lessons that become product examples should later be promoted into:

```text
src/lessons/<lesson-id>/
examples/<lesson-id>/
```

### 6. Renderer / Publisher Layer

Consumes structured learning objects and produces learner-facing outputs.

Initial renderer:

- Web Deck

Future renderers:

- Canvas / Whiteboard Knowledge Map
- Interactive Playground
- AI Tutor Mode
- Teacher Mode
- Assessment Mode

Renderers should depend on lesson objects, not raw source text or agent transcripts.

## Agent Role Contracts

### Source Ingest Agent

Input:

- Topic or source material
- Audience
- Scope constraints

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

### Learning Architecture Agent

Input:

- Source ingest artifact
- Target audience
- Target page count
- Output form

Output:

```json
{
  "audience": "",
  "prerequisites": [],
  "learningObjectives": [],
  "pageCount": {
    "target": 10,
    "min": 6,
    "max": 14
  },
  "pageSequence": []
}
```

Page count is a planning constraint, not a fixed product constant.

### Visual Pedagogy Agent

Input:

- Learning architecture artifact
- Concepts and page sequence

Output:

```json
{
  "visualPlan": [
    {
      "pageId": "",
      "visualType": "",
      "teachingPurpose": "",
      "elements": [],
      "states": []
    }
  ]
}
```

### Interaction Design Agent

Input:

- Learning architecture artifact
- Visual plan
- Misconceptions

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

### Assessment Design Agent

Input:

- Learning objectives
- Misconceptions
- Transfer goals

Output:

```json
{
  "assessments": [
    {
      "pageId": "",
      "type": "",
      "prompt": "",
      "options": [],
      "answer": "",
      "feedback": ""
    }
  ]
}
```

### Lesson Assembly Agent

Input:

- Learning architecture
- Visual plan
- Interaction plan
- Assessment plan

Output:

- Structured lesson object
- Page-level visual, interaction, assessment, and feedback specs
- Summary and transfer tasks

### Component Build Agent

Input:

- Lesson object
- Renderer target
- Existing component inventory

Output:

- Reusable React components
- Renderer wiring
- Tests
- Local runnable app

### Lesson Critic Agent

Input:

- Lesson object
- Rendered output or screenshots when available
- Quality rubric

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

### Publish Package Agent

Input:

- Passing build
- Lesson metadata
- README instructions

Output:

- Build artifacts
- Run instructions
- Shareable package or deployment target

## Runtime Adapter Contract

A runtime adapter maps the portable workflow into a concrete agent environment.

```ts
type RuntimeAdapter = {
  id: "codex" | "claude-code" | "gemini-cli" | "custom";
  supportsSubagents: boolean;
  supportsSkills: boolean;
  supportsToolCalls: boolean;
  supportsFileArtifacts: boolean;
  runAgent: (request: AgentRunRequest) => Promise<AgentRunResult>;
};
```

The first repo implementation can define this contract in docs and config. Code-level adapters can come later.

## Run Configuration

Each generation run should have an explicit config.

Example:

```json
{
  "runId": "database-index-001",
  "topic": "Why database indexes make queries faster",
  "source": {
    "type": "topic",
    "value": "Why database indexes make queries faster"
  },
  "audience": "Learners who understand basic tables and SQL SELECT queries",
  "targetOutput": "web_deck",
  "pageCount": {
    "target": 10,
    "min": 6,
    "max": 14
  },
  "runtime": {
    "adapter": "codex",
    "mode": "interactive"
  },
  "models": {
    "defaultModel": {
      "provider": "openai",
      "model": "gpt-5.4",
      "reasoningEffort": "medium"
    },
    "roleModels": {}
  },
  "approvalGates": [
    "learning-architecture",
    "lesson-object",
    "critic-report",
    "publish"
  ]
}
```

## Interactive Workflow

The workflow should be interactive by default:

```text
1. User starts a generation run.
2. System collects topic, audience, source, target page count, output form, and model preference.
3. Source Ingest Agent extracts core material.
4. Learning Architecture Agent proposes objectives and page sequence.
5. User approves or adjusts the learning architecture.
6. Visual, interaction, and assessment agents produce plans.
7. Lesson Assembly Agent creates the lesson object.
8. User approves or adjusts the lesson object.
9. Component Build Agent builds or updates the renderer package.
10. Lesson Critic Agent reviews the lesson.
11. System applies required fixes or asks for user decision.
12. Publish Package Agent prepares runnable output.
```

Approval gates prevent the system from jumping directly from source material to UI implementation.

## How The Web Deck MVP Fits

The existing database-index Web Deck MVP should be reframed as:

```text
Phase 1A: Renderer MVP
```

It validates:

- Lesson object shape
- Variable page-count rendering
- Web Deck renderer
- Visual/interaction/assessment component boundaries
- Quality rubric
- Publishable lesson package

It does not validate yet:

- Multi-agent orchestration
- Cross-runtime adapters
- Model provider selection
- Artifact run store
- Interactive generation gates

Those belong to:

```text
Phase 1B: Agent Runtime MVP
```

## Recommended Phases

### Phase 0: Product Contracts

Deliver:

- This system-level architecture spec
- Run config schema
- Artifact contracts
- Agent role contracts

No frontend implementation is required in this phase.

### Phase 1A: Renderer MVP

Deliver:

- Database index Web Deck lesson
- Lesson schema
- Renderer
- Visual, interaction, assessment components
- Tests and local build

This corresponds to the existing database index MVP plan, with the understanding that it is a renderer slice, not the full system.

### Phase 1B: Agent Runtime MVP

Deliver:

- A local orchestration command or script that creates a run directory
- A run config file with model/runtime fields
- Manual or semi-automated role execution
- Artifact handoff between role steps
- Approval gates represented as files or CLI prompts
- Final lesson object produced from artifacts

This phase may still use the current agent session to perform work, but it must write artifacts as if another runtime could continue the run.

### Phase 2: Runtime Adapters

Deliver:

- Codex adapter documentation and scripts
- Claude Code adapter documentation and scripts
- A provider-neutral model config
- A minimal compatibility matrix

### Phase 3: Automated Multi-Agent Execution

Deliver:

- True role dispatch where supported
- Parallel sidecar agents where safe
- Critic-and-revision loop
- Run logs and resumability

### Phase 4: Additional Output Forms

Deliver:

- Canvas map renderer
- Playground renderer
- Tutor mode
- Teacher mode

## Implications For Existing Plan

The existing implementation plan at `docs/superpowers/plans/2026-04-27-database-index-mvp.md` should not be deleted.

It should be reclassified as:

```text
Renderer MVP implementation plan
```

Before executing it, create a small follow-up plan for Phase 0 contracts:

- `docs/runtime/run-config.schema.md`
- `docs/runtime/agent-role-contracts.md`
- `docs/runtime/artifact-contracts.md`
- `docs/runtime/runtime-adapters.md`

Then execute the Renderer MVP plan.

This order preserves the true product architecture without delaying the visible demo for too long.

## Non-Goals

The system-level architecture does not require the first implementation to:

- Build a full custom agent platform
- Call multiple model APIs directly
- Implement every runtime adapter in code
- Automate every handoff immediately
- Replace Codex or Claude Code

The first practical goal is to make each step explicit, artifact-backed, and portable enough that it can later be automated.

## Open Decisions

The next planning step should decide:

- Whether Phase 0 contracts are Markdown-only or also include TypeScript/Zod schemas.
- Whether run artifacts live under `runs/` or `examples/<lesson-id>/runs/`.
- Whether the first orchestration tool is a shell command, Node CLI, or agent-only documented workflow.
- Whether model provider config is stored per run, per project, or both.

Recommendation:

- Start with Markdown contracts plus JSON examples.
- Store active generation runs under `runs/`.
- Add TypeScript/Zod schemas only when the first orchestration command is implemented.
- Keep provider config per run, with optional project defaults later.

