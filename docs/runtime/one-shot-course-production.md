# One-Shot Course Production

One-shot course production turns a learner request into a preview-ready self-study Web Deck through one production state machine.

## Default Gates

1. Course bundle is authored and published.
2. Content review loop completes 3 concrete rounds or blocks.
3. Imagegen batch records every page image and validates assets.
4. Layout smoke passes for all preview pages.
5. Final handoff returns only preview URL, quality summary, and evidence paths.

## Learner-Facing Rule

Learners should not approve intermediate artifacts. They should see a concise clarification question when needed, then the final preview and quality summary.

Do not show these artifacts unless the learner explicitly asks for expert details:

- source graph
- course plan
- content blueprint
- content-review brief
- content-review state
- imagegen manifest
- imagegen batch state
- layout smoke report

## MCP Loop

1. `learning_agent.prepare_learning_course`
2. `learning_agent.start_course_production`
3. Codex authors and publishes `coursePack` and `lessons`
4. `learning_agent.record_course_production_event`
5. `learning_agent.next_course_production_action`
6. Complete the returned action and repeat step 5 until `handoff_preview`

## Action Handling

- `author_course_bundle`: Codex authors and publishes the initial bundle.
- `run_content_review`: Codex calls `learning_agent.prepare_content_review`, critiques the course, revises it, republishes, then records a concrete review report.
- `revise_from_content_review`: Codex fixes the listed content-review blockers before imagegen.
- `generate_imagegen_assets`: Codex calls imagegen for every pending page and records each result with `learning_agent.record_imagegen_batch_item`.
- `fix_imagegen_assets`: Codex regenerates failed images and records them again.
- `run_layout_smoke`: Codex runs the returned `npm run smoke:layout` command.
- `fix_layout`: Codex fixes pages named in the layout report and reruns smoke.
- `handoff_preview`: Codex returns the preview URL and quality summary to the learner.

## Commands

```bash
npm run pipeline:fixture
npm run smoke:layout -- --runId <run-id> --desktop-only
```

## Verification Record

The implementation must finish with:

- `npm run test:ci`
- `npm run test:regression`
- `npm run codex:mcp:check`
- `npm run pipeline:fixture`
- `npm run smoke:layout -- --runId self-study-agentic-design-patterns-quality-v1 --desktop-only`
- `git diff --check`
