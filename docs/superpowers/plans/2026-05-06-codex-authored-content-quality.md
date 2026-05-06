# Codex-Authored Content Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Content Blueprint V1 so Codex-authored lessons receive concrete page-by-page teaching constraints before publishing.

**Architecture:** Create a focused `content-quality-blueprint.ts` module that turns planned course units into page blueprints. `AuthoringContextService` will attach the blueprint to `get_authoring_context`, persist it in the authoring-context artifact, and surface it in Codex instructions. Skills and docs will tell Codex to follow the blueprint. Publish validation will then read the persisted blueprint and block previews when authored pages drift from the page-level contract.

**Tech Stack:** TypeScript, Vitest, existing learner runtime services, existing MCP skills bundle.

---

## File Map

- Create: `tools/agent-runtime/learner/content-quality-blueprint.ts`
- Create: `tools/agent-runtime/learner/content-quality-blueprint.test.ts`
- Create: `tools/agent-runtime/learner/content-blueprint-compliance.ts`
- Create: `tools/agent-runtime/learner/content-blueprint-compliance.test.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.ts`
- Modify: `tools/agent-runtime/learner/authoring-context-service.test.ts`
- Modify: `tools/agent-runtime/learner/publish-validation.ts`
- Modify: `tools/agent-runtime/learner/learning-course-publisher.ts`
- Modify: `tools/agent-runtime/learner/learning-course-publisher.test.ts`
- Modify: `skills/learning-agent-operator/SKILL.md`
- Modify: `skills/source-to-course/SKILL.md`
- Modify: `docs/runtime/codex-user-trial-script.md`

## Task 1: Content Blueprint Module

- [ ] Write failing tests for 8-page, 10-page, and compact unit blueprints in `content-quality-blueprint.test.ts`.
- [ ] Run `npm run test:unit -- tools/agent-runtime/learner/content-quality-blueprint.test.ts`; expected failure: module missing.
- [ ] Implement `buildContentBlueprint` in `content-quality-blueprint.ts`.
- [ ] Re-run the same test; expected pass.

## Task 2: Authoring Context Integration

- [ ] Extend `authoring-context-service.test.ts` to require `contentBlueprint.version`, per-unit `pageBlueprints`, source requirements, and Codex instruction references.
- [ ] Run `npm run test:unit -- tools/agent-runtime/learner/authoring-context-service.test.ts`; expected failure: `contentBlueprint` missing.
- [ ] Modify `AuthoringContextResult` and `getContext` to include and persist `contentBlueprint`.
- [ ] Re-run the same test; expected pass.

## Task 3: Skills And Trial Docs

- [ ] Add skill-contract expectations that `learning-agent-operator` and `source-to-course` mention `contentBlueprint.units[*].pageBlueprints`.
- [ ] Run `npm run test:unit -- tools/mcp-server/skill-mcp-contract.test.ts`; expected failure.
- [ ] Update the skills and trial docs.
- [ ] Re-run the same test; expected pass.

## Task 4: Publish-Time Blueprint Compliance Gate

- [ ] Write failing tests for page type drift, missing source support, topic-only source tolerance, and missing learner action in `content-blueprint-compliance.test.ts`.
- [ ] Add a publisher integration test where a persisted authoring-context blueprint blocks a drifted lesson with `publish.blueprint.page-type-mismatch`.
- [ ] Run `npm run test:unit -- tools/agent-runtime/learner/content-blueprint-compliance.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts`; expected failure.
- [ ] Implement `validateContentBlueprintCompliance` and merge its issues into `validatePublishBundle`.
- [ ] Teach `LearningCoursePublisher` to read `authoring-context.draft.json` and pass `contentBlueprint` into publish validation.
- [ ] Re-run the same tests; expected pass.

## Validation

Run:

```bash
npm run test:unit -- tools/agent-runtime/learner/content-quality-blueprint.test.ts tools/agent-runtime/learner/authoring-context-service.test.ts tools/mcp-server/skill-mcp-contract.test.ts
npm run test:unit -- tools/agent-runtime/learner/content-blueprint-compliance.test.ts tools/agent-runtime/learner/learning-course-publisher.test.ts
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run bundle:check
npm run seed:check
```

## Done Definition

- `get_authoring_context` includes Content Blueprint V1.
- The blueprint gives page-level authoring guidance for every recommended unit.
- Compact page counts are explicitly flagged.
- Skills route Codex to the blueprint before writing lessons.
- `publish_learning_course` blocks persisted-blueprint drift through `publish.blueprint.*` issues.
- Validation commands pass.
