# Codex Authored Course And Viewport Shell Design

## Problem

The current learner path can generate previewable Chinese courses, but the content quality is capped because the default authoring work is done by deterministic MCP runtime code. MCP can produce valid structure, source anchors, and publishable lesson data, but it does not deeply read the source or design teaching moments like Codex can.

The current web surface also mixes product controls, project panels, source evidence, and the teaching page in one vertical flow. A learner can end up scrolling while studying a single page, which breaks the intended PPT-like learning experience.

## Product Decision

The product default should become Codex-authored and MCP-validated.

```text
user natural language
  -> learning_agent.create_learning_project
  -> learning_agent.get_authoring_context
  -> Codex reads source context and authors coursePack + lessons
  -> learning_agent.publish_learning_course
  -> learning_agent.get_learning_preview
```

`learning_agent.generate_grounded_course` remains available as a fast deterministic draft or smoke-preview tool. It should not be documented as the high-quality default path.

## Responsibilities

### Codex

- Clarify learner-visible choices.
- Read authoring context and source anchors.
- Design course organization, lessons, page sequence, interactions, assessments, misconception checks, and transfer tasks.
- Keep Chinese learning content concise and source-grounded.
- Design and maintain the learner-facing web experience.
- Revise the generated course when learner feedback arrives.

### MCP Runtime

- Store learner project state.
- Normalize source material and expose source anchors.
- Provide a compact authoring context with constraints and source evidence samples.
- Validate submitted course bundles.
- Publish previewable web lessons.
- Export course packages.
- Keep deterministic draft generation available for smoke tests.

## New Authoring Context Tool

Add learner-facing MCP tool:

```text
learning_agent.get_authoring_context
```

Input:

```json
{
  "runId": "string",
  "maxAnchors": 40
}
```

Output:

```json
{
  "status": "authoring_context_ready",
  "runId": "string",
  "brief": {},
  "source": {
    "sourceKind": "book|paper|patent|blog|notes|topic",
    "anchorCount": 0,
    "anchors": []
  },
  "coursePlan": {
    "strategy": "overview_plus_topic|chapter_guided|topic_guided|task_guided|hybrid",
    "unitPages": 8,
    "recommendedUnits": []
  },
  "authoringContract": {
    "defaultTool": "learning_agent.publish_learning_course",
    "language": "zh-CN",
    "requirements": []
  },
  "codexInstruction": "string"
}
```

The tool should not generate lesson prose. It should prepare enough context for Codex to write the course itself.

## Web Learning Shell

Replace the current vertical learning workspace with a fixed viewport application shell:

```text
┌──────────────────────┬──────────────────────────────┐
│ Sidebar              │ Main learning viewport        │
│                      │                              │
│ Course/project       │ Deck page fills available     │
│ Units                │ browser height                │
│ Learn                │                              │
│ Map                  │ No body/page vertical scroll   │
│ Sources              │ while studying a deck page     │
│ Practice             │                              │
│ Feedback/export      │                              │
└──────────────────────┴──────────────────────────────┘
```

Design rules:

- Learning mode uses `100dvh` / `h-screen` style viewport constraints.
- The deck page itself must not require vertical scrolling.
- Source anchors move out of the page body and into sidebar/source context.
- Course structure, project library, knowledge map, assessment, teacher, tutor, playground, feedback, and export are sidebar-selected function pages.
- If teaching content does not fit, the authoring layer should split or compress it instead of relying on scroll.

## Acceptance

- Codex-facing docs and skills recommend `create_learning_project -> get_authoring_context -> publish_learning_course -> get_learning_preview`.
- `generate_grounded_course` is documented as quick draft/smoke preview.
- `get_authoring_context` is listed by MCP and returns source anchors, recommended units, and a publish contract.
- Existing source regression and seed checks still pass.
- The learning app opens directly into a learner page with a persistent sidebar.
- In deck mode, `document.body.scrollHeight <= window.innerHeight` under normal viewport tests.
- Source anchors remain visible through sidebar or source panel, not inside the main teaching page body.

