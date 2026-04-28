---
name: learning-agent-runner
description: Use when generating, resuming, approving, revising, or promoting an interactive Chinese learning lesson through the local agent runner.
---

# Learning Agent Runner

Use this skill when the user asks Codex to generate a learning lesson, run the multi-agent learning workflow, inspect an approval gate, approve or revise artifacts, resume a run, or promote a generated lesson into the Web Deck lesson source.

## Defaults

- Output language: `zh-CN`
- Target output: `web_deck`
- Runtime adapter: `mock` unless the user explicitly asks for `codex-manual` or another configured adapter
- Preserve the user's requested page count

## Workflow

1. Initialize a durable run:

```bash
npm run agent:init -- --topic "<topic>" --pages <count> --language zh-CN
```

2. Run the next workflow step:

```bash
npm run agent:run -- --run <run-id>
```

3. If the run uses `codex-manual` and returns `manual_action_required`, open the generated prompt at `promptPath`, produce the requested JSON artifact, and submit it:

```bash
npm run agent:submit -- --run <run-id> --artifact <artifact-id> --file <json-file>
```

Then continue with `agent:run` or `agent:resume`. Do not mark a manual artifact approved until the submitted versioned artifact has been inspected under `runs/<run-id>/artifacts/`.

4. Treat either of these results as an approval gate signal:

- `artifact_written` with `createsGate`
- `approval_required`

When a gate is signaled, inspect the matching artifact under:

```text
runs/<run-id>/artifacts/
```

Read the exact draft or versioned artifact for the required gate before asking the user to approve or revise it. Use the exact artifact `<version>` returned by the runtime output or recorded for the draft, not a hard-coded `v1`. Do not skip this inspection.

5. Ask the user whether to approve the artifact or request a revision. Summarize the artifact version, gate, and any material concerns.

6. Approve an acceptable artifact:

```bash
npm run agent:approve -- --run <run-id> --gate <gate-id> --version <version> --notes "<notes>"
```

7. Request revision when the artifact should not pass the gate:

```bash
npm run agent:revise -- --run <run-id> --gate <gate-id> --version <version> --notes "<requested changes>"
```

8. Resume after approval or revision. Continue running or resuming until the next gated artifact is written, `manual_action_required` is returned, or `approval_required` is returned:

```bash
npm run agent:resume -- --run <run-id>
```

9. Repeat manual submission, gate inspection, approval, or revision through the lesson gate. Inspect and approve the `lesson` artifact before promotion.

10. Promote only after the lesson artifact has been approved:

```bash
npm run agent:promote -- --run <run-id>
```

11. Verify the project:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Quality Rules

- Do not generate English-first lessons unless the user explicitly requests it.
- Do not hard-code a 10-page lesson; use the requested page count from the run config.
- Do not skip approval gates, even for mock runs.
- Do not rely on chat history as durable state; use `runs/<run-id>/`.
- Do not promote draft lessons; promote approved lesson artifacts only.
- Do not approve an artifact without inspecting the relevant file under `runs/<run-id>/artifacts/`.
- Do not assume one `resume` reaches the lesson gate; continue until the runtime reports the next gate or completes.
- Do not treat `manual_action_required` as a completed artifact; submit JSON with `agent:submit` first.
