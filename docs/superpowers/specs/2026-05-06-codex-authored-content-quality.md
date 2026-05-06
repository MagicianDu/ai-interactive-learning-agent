# Codex-Authored Content Quality Spec

Date: 2026-05-06

## Purpose

Improve the quality of Codex-authored Chinese learning courses by giving the authoring agent a concrete per-unit, per-page teaching blueprint before it writes `coursePack` and `lessons`.

The product problem is that MCP can validate and publish lessons, but content quality still depends heavily on how clearly Codex understands the expected learning experience. The next kernel should make high-quality output easier by default.

## Product Goals

1. `learning_agent.get_authoring_context` returns a learner-experience blueprint that Codex can directly follow.
2. Each recommended unit includes a page-by-page plan with page type, teaching move, learner action, visual requirement, feedback requirement, and source requirement.
3. The blueprint supports books, papers, patents, blogs, notes, documentation, and topic-only courses.
4. The blueprint preserves user-selected page count while warning when fewer than eight pages requires compact combined pages.
5. The blueprint remains authoring guidance, not a new lesson schema and not a learner approval artifact.
6. Publish-time validation checks whether Codex-authored pages actually follow the persisted blueprint before showing a preview.

## Non-Goals

- Do not build a new UI surface in this slice.
- Do not replace `Lesson` JSON, `CoursePack`, Course IR, or existing validators.
- Do not make deterministic content generation the high-quality default.
- Do not force every page sequence into one rigid template when a source kind needs different emphasis.

## Content Blueprint V1

`AuthoringContextResult` should include:

```ts
contentBlueprint: {
  version: "content-blueprint/v1";
  globalRules: string[];
  units: Array<{
    unitId: string;
    lessonId: string;
    title: string;
    targetPageCount: number;
    unitKind: string;
    focusConcepts: string[];
    sourceAnchorIds: string[];
    sourceRequirement: string;
    pageBlueprints: Array<{
      pageNumber: number;
      pageType: string;
      teachingMove: string;
      learnerAction: string;
      visualRequirement: string;
      feedbackRequirement: string;
      sourceRequirement: string;
      mustInclude: string[];
    }>;
  }>;
};
```

## Acceptance

- An 8-page unit gets a complete sequence: problem scene, intuition visual, structure diagram, interactive model, quiz, misconception check, transfer challenge, summary card.
- A 10-page unit adds deepening pages without losing final transfer and summary.
- A compact unit under 8 pages keeps learner action and transfer, and emits a compact-page warning in `globalRules`.
- Source-backed units require page-level `sourceAnchorIds` or explicit inferred/analogy grounding.
- `get_authoring_context` returns `contentBlueprint` and writes it into the authoring-context artifact.
- Codex-facing skills mention following `contentBlueprint.units[*].pageBlueprints`.
- `publish_learning_course` returns `revision_required` with `publish.blueprint.*` issues when a persisted blueprint detects page type drift, missing learner action, missing feedback, missing source support, or missing visual structure.
- Targeted unit tests, typecheck, lint, and seed checks pass.
