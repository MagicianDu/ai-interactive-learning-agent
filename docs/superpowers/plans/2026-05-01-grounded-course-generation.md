# Grounded Course Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for behavior changes and superpowers:verification-before-completion before claiming completion.

**Goal:** Move the learner-first MCP path from project readiness to direct source-grounded Chinese preview generation for books, papers, patents, and blogs.

**Architecture:** Add a learner-facing grounded generation service that reads a learner project, normalizes the source, writes `source-ingest`, builds a Chinese overview + focused unit bundle with source anchors, runs existing quality checks through `LearningCoursePublisher`, and applies the latest learner feedback brief on regeneration.

---

### Task 1: Service Behavior

- [x] Write failing tests for source-backed grounded generation.
- [x] Verify the tests fail because `GroundedCourseService` does not exist.
- [x] Implement source normalization, source-ingest writing, grounded bundle generation, critic reports, and publish.
- [x] Verify the service tests pass.

### Task 2: Feedback Iteration

- [x] Write failing test for `revise_learning_course` followed by grounded regeneration.
- [x] Read latest revision brief from `runs/<runId>/learning-revisions`.
- [x] Apply the feedback marker in generated lesson content and publish notes.
- [x] Verify the feedback test passes.

### Task 3: MCP Entry

- [x] Expose `learning_agent.generate_grounded_course`.
- [x] Add MCP JSON-RPC coverage for create -> generate grounded preview.
- [x] Keep advanced/operator approval flow separate.

### Task 4: Real Source Regression

- [x] Extend `source:regression` to run grounded preview generation.
- [x] Record source anchor counts and grounded preview status.
- [x] Update docs with the latest four-source regression result.
