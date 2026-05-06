# Parallel Exploration Backlog

Date: 2026-05-06

This document records product exploration tracks that should remain searchable but are not part of the immediate serial mainline.

Execution rule:

- Exploration may prototype in parallel.
- Exploration must consume shared contracts from the mainline whenever possible:
  - Source Graph
  - Course Plan
  - Course IR
  - Quality Report
  - Revision Brief
- Exploration must not replace the default learner path until it has a dedicated spec and acceptance gate.

Primary mainline reference:

```text
docs/superpowers/specs/2026-05-06-product-mainline-development-spec.md
```

## Track A: Multi-Runtime Agent Entry

Idea:

Make Codex, Claude, OpenClaw-style clients, ChatGPT Apps, and CLI all act as entry points into the same learning product kernel.

Why it matters:

The product should not depend on one agent host. The durable product is MCP plus Skills plus stable Course IR.

Possible artifacts:

- runtime adapter contract
- model-role routing table
- skill pack compatibility tests
- CLI fallback path
- ChatGPT Apps proof of concept

Promotion criteria:

- Mainline Course IR and Quality Report are stable.
- At least two agent clients can complete the same public fixture flow.

## Track B: Canvas / Whiteboard Knowledge Map

Idea:

Show books, papers, patents, and topic domains as spatial knowledge maps before the learner enters a focused lesson.

Why it matters:

Long sources need structure. Learners often need to see the whole system before studying individual units.

Possible artifacts:

- concept dependency map
- chapter/topic overlay
- source coverage heatmap
- clickable unit nodes
- misconception clusters

Promotion criteria:

- Source Graph V2 exposes stable concept and dependency fields.
- Course Plan V2 can map units to graph nodes.

## Track C: Playground Mode

Idea:

Create sandbox-style learning experiences for algorithms, systems, AI workflows, protocols, and data structures.

Why it matters:

Some concepts are best learned by manipulation, not by reading or page navigation.

Possible artifacts:

- parameter experiment runtime
- code-stepper contract
- system simulation shell
- RAG pipeline simulator
- cache/hash/index/attention playgrounds

Promotion criteria:

- Learning Object Runtime V1 exists.
- Quality Engine can evaluate interaction purpose and feedback quality.

## Track D: Course Debugger

Idea:

Let a learner say `第 3 页看不懂` and have the system diagnose why:

- missing prerequisite
- weak source support
- too much density
- no visual model
- no learner action
- feedback not explanatory
- wrong learner level

Why it matters:

This turns course quality into an interactive repair loop, not a static review report.

Possible artifacts:

- confusion diagnosis schema
- page repair recipes
- quality issue to revision mapping
- before/after comparison UI

Promotion criteria:

- Feedback-To-Revision V2 is stable.
- Quality Engine V2 exposes page-level issues.

## Track E: Misconception Library

Idea:

Build a reusable library of common wrong mental models by domain.

Why it matters:

Misconception diagnosis is a durable quality moat. It is also reusable across lessons and sources.

Possible artifacts:

- misconception taxonomy
- domain packs
- assessment templates
- feedback templates
- source-linked misconception examples

Promotion criteria:

- Source Graph V2 can extract and store misconceptions.
- Assessment Design skill can consume misconception IDs.

## Track F: Domain Packs

Idea:

Create opinionated packs for specific source and learning domains.

Candidate packs:

- computer science foundations
- AI papers
- patents and technical IP
- software architecture
- operations research and optimization
- data engineering systems

Why it matters:

Generic source-to-course logic will not be enough for high-quality domain learning.

Possible artifacts:

- source parser extensions
- concept templates
- visual templates
- interaction templates
- domain quality rubrics

Promotion criteria:

- Public fixtures show the generic kernel is stable.
- A domain pack can improve quality without forking the Course IR.

## Track G: Teacher / Study Dual Mode

Idea:

Generate learner course and teacher materials from the same Course IR.

Why it matters:

The same content can serve self-study, classroom teaching, corporate training, and expert review.

Possible artifacts:

- instructor notes
- pacing guide
- classroom questions
- exercise sheets
- post-class review tasks
- assessment export

Promotion criteria:

- Tutor and Teacher Minimum Product slice is ready to begin.
- Export bundle can include optional teacher materials.

## Track H: Trust Layer

Idea:

Give every important claim a source/evidence/confidence status that a learner can inspect without reading internal artifacts.

Why it matters:

This product will be used on books, papers, patents, and technical claims. Trust must be visible but not overwhelming.

Possible artifacts:

- learner-readable evidence chips
- claim support map
- confidence labels
- unsupported claim warnings
- export provenance manifest

Promotion criteria:

- Source Graph V2 and Quality Engine V2 expose direct support, inference, analogy, and background classifications.

## Track I: Data Moat And Evaluation Lab

Idea:

Use anonymized feedback, revision diffs, quality reports, and fixture runs to improve the learning compiler.

Why it matters:

The product should improve from real learner usage, not only from prompt edits.

Possible artifacts:

- golden source corpus
- regression quality dashboard
- learner feedback taxonomy
- revision outcome metrics
- hallucination/source-grounding harness
- content genericness detector

Promotion criteria:

- Public beta has enough repeated fixture and seed-user runs.
- Privacy rules for private sources are documented.

## Track J: Distribution And Community

Idea:

Make the project easy to install, inspect, extend, and contribute to as an open-source AI-native learning product.

Possible artifacts:

- versioned MCP plus skills release
- example gallery
- contribution guide for learning objects
- issue templates for course quality
- demo videos or GIFs based only on public fixtures
- hosted docs site

Promotion criteria:

- Mainline release gates are stable.
- Public samples are safe and compelling.
