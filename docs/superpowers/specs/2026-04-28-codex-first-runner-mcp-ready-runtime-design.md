# Codex-First Runner, MCP-Ready Runtime Design

## Purpose

The next project milestone is to turn the current runnable Web Deck MVP into a usable generation tool inside Codex.

The immediate interface is a project-local runner that Codex can operate through terminal commands and a dedicated project skill. The long-term target is an MCP/plugin tool server. The runner must therefore be built around a reusable runtime core rather than a command-line-only implementation.

This spec defines the system shape for the next implementation phase. It does not implement the runner.

## Product Position

The current project has:

- A Chinese-first interactive Web Deck renderer.
- A complete sample lesson for "数据库索引为什么更快".
- Structured lesson schema and reusable React components.
- Runtime, artifact, approval, and role contracts documented under `docs/runtime/`.

The missing capability is:

```text
Given a topic, page count, language, and model/runtime config,
run a resumable multi-agent workflow that produces reviewed artifacts,
promotes an approved lesson into the Web Deck app,
and keeps the path open for a future MCP server.
```

## Recommended Direction

Use a phased architecture:

```text
Phase 1: Codex Skill + local CLI runner
Phase 2: reusable runtime core
Phase 3: MCP server wrapping the same runtime core
Phase 4: Codex / Claude Code / Gemini CLI / custom UI clients
```

The CLI runner is the first usable interface. The MCP server is the target system interface. Both must share the same orchestration logic.

## Why Not Start With MCP Directly

MCP is the final target, but starting there would force early decisions about tool schemas, long-running execution, approval UX, model execution ownership, and client interoperability before the artifact workflow has been validated.

The highest-risk product question is whether the system can reliably generate high-quality Chinese, visual, action-based, feedback-rich lessons through a multi-agent artifact chain. A local runner validates that faster.

The implementation should avoid CLI-only shortcuts so that MCP can be added later as a thin adapter.

## MVP User Experience In Codex

The user should be able to ask Codex:

```text
用 learning-agent-runner 生成一个 8 页中文课程，主题是哈希表。
```

Codex should then use the local runner and project skill to execute a workflow like:

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN
npm run agent:run -- --run hash-table-001
npm run agent:approve -- --run hash-table-001 --gate learning-architecture
npm run agent:resume -- --run hash-table-001
npm run agent:promote -- --run hash-table-001
```

The exact command names may change during implementation, but the user-facing workflow should remain:

1. Create a run.
2. Generate or revise role artifacts.
3. Pause at approval gates.
4. Resume from durable run state.
5. Promote approved lesson into the Web Deck app.
6. Preview locally.

## MVP Scope

### In Scope

- Project-local CLI runner.
- Codex-facing skill documentation under `skills/learning-agent-runner/SKILL.md`.
- `runs/<run-id>/` directory creation.
- `run.config.json` validation.
- Artifact versioning:
  - `artifacts/<artifact-id>.vN.json`
  - `artifacts/<artifact-id>.draft.json`
  - `artifacts/<artifact-id>.approved.json`
- Approval records:
  - `approvals/<gate-id>.approved.json`
- Resume from existing run state.
- Promotion of approved lesson artifacts into `src/lessons/<lesson-id>/`.
- Chinese-first default generation via `outputLanguage: "zh-CN"`.
- Page count as user-specified config, not hard-coded.
- Mock or deterministic provider for first tests.
- Adapter interfaces for future real model providers.
- Tests for config validation, artifact versioning, approvals, resume, and promotion.

### Out Of Scope For First Implementation

- Production MCP server.
- Browser-based generation UI.
- Real multi-provider model execution as a required dependency.
- Cloud storage.
- Authentication.
- Multi-user collaboration.
- Deployment automation.
- Streaming UI for long-running agent steps.

These are not rejected. They are later phases after the local core is reliable.

## Architecture

The implementation should separate runtime core from interfaces.

```text
CLI commands
  -> Runtime Core
       -> RunStore
       -> ArtifactStore
       -> ApprovalService
       -> AgentWorkflow
       -> RuntimeAdapter
       -> LessonPromotionService
  -> Files under runs/
  -> Web Deck lesson source

Future MCP tools
  -> Same Runtime Core
```

### Runtime Core

The runtime core owns orchestration behavior that must be shared by CLI and future MCP.

Responsibilities:

- Load and validate run config.
- Resolve current run status.
- Determine next required role.
- Execute a role through an adapter.
- Write versioned artifacts.
- Record logs and events.
- Enforce approval gates.
- Resume safely after interruption.
- Promote approved artifacts to app source.

The runtime core must not depend on terminal prompts or process arguments. CLI and MCP are adapters around it.

### RunStore

Owns run directory layout.

Responsibilities:

- Create `runs/<run-id>/`.
- Read and write `run.config.json`.
- Ensure required subdirectories exist:
  - `artifacts/`
  - `approvals/`
  - `logs/`
  - `exports/`
- List runs.
- Load run metadata.

### ArtifactStore

Owns versioned artifact files.

Responsibilities:

- Write `artifacts/<artifact-id>.vN.json`.
- Update `artifacts/<artifact-id>.draft.json`.
- Read latest draft.
- Read approved artifact.
- Prevent ambiguous plain aliases such as `artifacts/lesson.json`.
- Compute next version number.
- Preserve immutable approved versions.

### ApprovalService

Owns approval gates.

Responsibilities:

- Know canonical gate ids:
  - `learning-architecture`
  - `lesson`
  - `critic-report`
  - `publish-package`
- Write `approvals/<gate-id>.approved.json`.
- Update `artifacts/<artifact-id>.approved.json` when approved.
- Support decisions:
  - `approved`
  - `approved_with_notes`
  - `revision_requested`
  - `rejected`
- Prevent gated downstream roles from using draft-only upstream artifacts.

### AgentWorkflow

Owns role sequencing.

Recommended role order:

```text
source-ingest
learning-architecture
visual-pedagogy
interaction-design
assessment-design
lesson-assembly
lesson-critic
publish-package
```

The first implementation can execute roles sequentially. Parallel role execution is postponed until the workflow is stable.

### RuntimeAdapter

Owns how a role is executed.

Initial adapters:

- `mock`: deterministic local artifact generation for tests and offline development.
- `codex-manual`: Codex reads role instructions and writes artifacts through the runner.

Future adapters:

- `openai`
- `anthropic`
- `gemini`
- `custom`

The adapter interface should accept:

- run config
- role id
- approved upstream artifacts
- draft upstream artifacts where allowed
- output artifact id

The adapter should return a structured artifact payload. The runtime core writes it to disk.

### LessonPromotionService

Owns promotion from approved lesson artifact to Web Deck source.

Responsibilities:

- Read approved `artifacts/lesson.approved.json`.
- Convert renderer-ready lesson JSON into project source format.
- Write a lesson under `src/lessons/<lesson-id>/`.
- Optionally update the default app lesson when requested.
- Write a promotion record into `artifacts/publish-package.vN.json`.

Promotion should not use generated build output as a source of truth.

## CLI Surface

The CLI should be thin and call runtime core services.

Recommended commands:

```bash
npm run agent:init -- --topic "哈希表" --pages 8 --language zh-CN
npm run agent:status -- --run hash-table-001
npm run agent:run -- --run hash-table-001
npm run agent:approve -- --run hash-table-001 --gate learning-architecture
npm run agent:revise -- --run hash-table-001 --gate learning-architecture --notes "增加误区检查"
npm run agent:resume -- --run hash-table-001
npm run agent:promote -- --run hash-table-001
```

If implementation complexity becomes high, `agent:run`, `agent:resume`, and `agent:status` may be implemented first, with approval and promotion following in separate tasks.

## Codex Skill Surface

Create `skills/learning-agent-runner/SKILL.md`.

The skill should tell Codex:

- How to create a run from user intent.
- How to default to Chinese output.
- How to preserve user-specified page count.
- How to inspect generated artifacts.
- How to ask the user for approval at gates.
- How to resume an interrupted run.
- How to promote and preview the lesson.
- Which verification commands to run.

The skill should treat the CLI as the durable state manager, not hidden chat history.

## Future MCP Surface

The future MCP server should expose the same runtime core through tools such as:

```text
create_run
list_runs
get_run_status
run_next_step
read_artifact
approve_artifact
request_revision
promote_lesson
get_preview_info
```

The MCP server should not duplicate orchestration logic. It should call the same `RunStore`, `ArtifactStore`, `ApprovalService`, `AgentWorkflow`, and `LessonPromotionService` used by the CLI.

## Data Flow

```text
User request in Codex
  -> Codex uses learning-agent-runner skill
  -> CLI creates run.config.json
  -> Runtime core executes next role
  -> Adapter returns artifact payload
  -> ArtifactStore writes versioned draft
  -> ApprovalService pauses at configured gates
  -> User approves or requests revision in Codex
  -> Runtime resumes from files
  -> Approved lesson promotes into src/lessons/
  -> Web Deck previews promoted lesson
```

## Error Handling

The runner should fail with clear, actionable messages.

Required error classes or categories:

- Invalid run config.
- Missing run id.
- Missing required upstream artifact.
- Approval required before next role.
- Artifact version conflict.
- Unsupported runtime adapter.
- Unsupported model/provider.
- Lesson promotion target already exists.
- Invalid lesson payload.

The CLI should exit non-zero for errors. The runtime core should return structured error objects so MCP can later expose the same failures.

## Testing Strategy

The implementation plan should include tests for:

- Run initialization creates the expected directory layout.
- Config defaults `outputLanguage` to `zh-CN`.
- Page count is stored from user input.
- ArtifactStore writes `v1`, then `v2`, and updates draft alias.
- ApprovalService writes approval records and approved aliases.
- AgentWorkflow stops at approval gates.
- Resume continues from the correct next role.
- Promotion writes a lesson source artifact without assuming 10 pages.
- Invalid lesson payload fails before promotion.

Mock adapter output should be deterministic so tests do not depend on external model APIs.

## Acceptance Criteria

The next implementation phase is complete when:

1. Codex can create a new lesson generation run through project commands.
2. The run creates durable files under `runs/<run-id>/`.
3. The run stores topic, page count, language, runtime, and model config.
4. The workflow writes versioned artifacts.
5. The workflow pauses at approval gates.
6. A user can approve or request revision through file-backed commands.
7. A run can resume after interruption.
8. An approved lesson can be promoted into the Web Deck source tree.
9. The promoted lesson can be previewed locally.
10. The runtime core is reusable by a future MCP server without rewriting orchestration.

## Open Design Decisions For Implementation Plan

These should be resolved in the implementation plan, not in this design spec:

- Whether to implement the CLI with plain TypeScript scripts or a lightweight CLI parser.
- Whether the first promoted lesson writes `.json` or `.ts`.
- Whether `codex-manual` adapter is implemented as a command that prints role instructions or as a scaffold that Codex fills.
- Whether the default app lesson updates automatically or only when a `--set-default` flag is provided.

## Spec Self-Review

- Gap scan: no unresolved marker text remains.
- Internal consistency: CLI, future MCP, and runtime core share the same service boundaries.
- Scope check: first implementation focuses on Codex-usable local runner and keeps MCP as final target.
- Ambiguity check: first implementation may use mock/deterministic provider; production MCP and real provider execution are explicitly out of scope.
