# Runtime Adapter Contract

## Purpose

A runtime adapter maps the portable learning-agent workflow into a concrete execution environment. The product contract is the same whether a run is executed in Codex, Claude Code, Gemini CLI, or a custom runner.

Adapters are responsible for executing role requests, honoring or reporting model selections, reading and writing file artifacts, surfacing approval gates, and recording runtime events. They should not redefine the lesson schema, role contracts, or artifact contracts.

The current implementation includes two local CLI adapters: deterministic `mock` execution and operator-driven `codex-manual` execution. `codex-manual` does not call an external model API; it writes a role prompt for the active Codex session, pauses, and waits for the operator to submit the generated JSON artifact. The repository also includes a stdio MCP entrypoint under `tools/mcp-server/`; it exposes stable tool contracts over JSON-RPC and calls the same runtime services as the CLI.

Current MCP-ready tool names:

```text
learning_agent.init_run
learning_agent.plan_run
learning_agent.init_from_plan
learning_agent.status
learning_agent.beta_status
learning_agent.run_until_gate
learning_agent.list_artifacts
learning_agent.read_artifact
learning_agent.submit_artifact
learning_agent.approve_gate
learning_agent.revise_gate
learning_agent.list_units
learning_agent.run_next
learning_agent.run_course
learning_agent.promote_units
learning_agent.promote_lesson
```

`learning_agent.plan_run` is the natural-language entrypoint for Codex/Claude-style operation. It writes `runs/<run-id>/run.plan.json` from a Chinese request and returns review items. `learning_agent.init_from_plan` initializes the run after the operator approves the plan. Structured `init_run` remains available for scripts and tests.

`learning_agent.beta_status` is the beta-level operator status primitive. It summarizes parent artifacts, approved gates, current review gates, child unit runs, and next actions without returning full source anchors or lesson payloads.

## Conceptual TypeScript Shape

```ts
type RuntimeAdapterId = "mock" | "codex-manual" | "openai" | "anthropic" | "gemini" | "custom";

type RuntimeMode = "interactive" | "supervised" | "batch";

type AgentRoleId =
  | "source-ingest"
  | "learning-architecture"
  | "visual-pedagogy"
  | "interaction-design"
  | "assessment-design"
  | "lesson-assembly"
  | "component-build"
  | "lesson-critic"
  | "publish-package";

type ModelRef = {
  provider: "mock" | "openai" | "anthropic" | "google" | "local" | "custom";
  model: string;
  reasoningEffort?: "low" | "medium" | "high";
  temperature?: number;
};

type AgentRunRequest = {
  runId: string;
  role: AgentRoleId;
  mode: RuntimeMode;
  model: ModelRef;
  inputArtifacts: string[];
  outputArtifacts: string[];
  approvalGate?: string;
  instructions: string;
};

type AgentRunResult = {
  runId: string;
  role: AgentRoleId;
  status: "completed" | "needs_user_input" | "blocked" | "failed";
  outputArtifacts: string[];
  logRef?: string;
  message: string;
};

type RuntimeAdapter = {
  id: RuntimeAdapterId;
  supportsSubagents: boolean;
  supportsSkills: boolean;
  supportsToolCalls: boolean;
  supportsFileArtifacts: boolean;
  runAgent: (request: AgentRunRequest) => Promise<AgentRunResult>;
};
```

This shape is conceptual. Future implementation may adapt names and transport details, but it should preserve the same responsibilities.

## Adapter Expectations

### Mock

`mock` is the deterministic adapter currently used for automated local verification. It writes Chinese-first artifacts, preserves the requested page count, and exists to make the artifact, approval, resume, and promotion workflow testable before real provider execution is added.

Expected behavior:

- Read the run config from `runs/<run-id>/run.config.json`.
- Write structured artifacts under `runs/<run-id>/artifacts/`.
- Pause through the same approval gates as future model-backed adapters.
- Preserve `outputLanguage: "zh-CN"` and `pageCount.target`.
- Use `models.defaultModel.provider: "mock"` and `models.defaultModel.model: "mock-learning-agent"` in current runnable examples.

### Codex Manual

`codex-manual` is implemented as an operator-driven Codex execution mode. When a role is due, the CLI writes a durable prompt under `runs/<run-id>/manual-requests/<artifact-id>.md` and returns `manual_action_required` instead of writing a draft artifact. Codex then produces a JSON file and submits it through:

```bash
npm run agent:submit -- --run <run-id> --artifact <artifact-id> --file <json-file>
```

Expected behavior:

- Generate role-specific prompts from the run config.
- Preserve the same artifact names, versioning, and approval gates as `mock`.
- Keep the operator in control of inspecting and approving submitted artifacts.
- Avoid hidden chat state by writing prompts and submitted artifacts to disk.
- Report manual work as `manual_action_required`, not as a completed artifact.

### Codex

Codex is the preferred initial interactive runtime for this repository.

Expected behavior:

- Read the run config and approved artifacts from files.
- Execute roles in the current agent session or through available subagent-like workflows when supported.
- Use skills and tool calls for repository edits, browser verification, document work, and build checks.
- Write all intermediate outputs to `runs/<run-id>/artifacts/`.
- Pause at configured approval gates when the operator needs to review or redirect.
- Report unsupported model routing if the active Codex environment cannot call a requested provider or role model directly.

Recommended future use:

- Model-backed or operator-driven role execution.
- Interactive design and implementation where file edits, checks, and previews are needed.

### Claude Code

Claude Code should be able to execute the same artifact-backed workflow using its own task, skill, and tool conventions.

Expected behavior:

- Treat the run config and artifacts as the durable source of context.
- Map agent roles to Claude Code tasks or manual role prompts.
- Preserve approval gates through explicit operator prompts or approval files.
- Write outputs with the same filenames and versioning rules.
- Record runtime-specific limitations in logs rather than changing the product contract.

Recommended use:

- Alternative implementation runtime.
- Independent lesson critique or revision pass.
- Runs where the operator prefers Anthropic models as the default.

### Gemini CLI

Gemini CLI can participate as a role executor or full-run adapter when it can read and write local artifacts.

Expected behavior:

- Read `run.config.json` and required input artifacts.
- Execute a focused role request using the requested model when available.
- Write the expected output artifact and a runtime log entry.
- Use file artifacts as the handoff mechanism instead of relying on conversation memory.
- Report gaps in subagent, skill, or tool-call support through `AgentRunResult`.

Recommended use:

- Model-diversity experiments.
- Independent generation or critique for source ingest, architecture, assessment, or lesson review.
- Batch-style artifact production when interactive UI work is not required.

### Custom Runners

Custom runners are future orchestration processes owned by this project or by downstream users.

Expected behavior:

- Load the same run config fields.
- Dispatch role requests in sequence or parallel according to artifact dependencies.
- Resolve model references through provider-specific clients or local model runtimes.
- Enforce approval gates through files, command-line prompts, web UI, or another explicit operator mechanism.
- Validate artifact presence and version references before starting each role.
- Keep renderer and publisher stages dependent on approved lesson artifacts.

Recommended use:

- Phase 1B and later orchestration.
- Repeatable batch generation.
- Hosted or team workflows with explicit audit logs.

## Compatibility Matrix

| Adapter | Subagents | Skills | Tool calls | File artifacts | Recommended use |
| --- | --- | --- | --- | --- | --- |
| Mock | Not applicable. | Not applicable. | Not applicable. | Implemented. | Current CLI runner, tests, deterministic demos. |
| Codex manual | Uses the current Codex session/operator. | Strong support through project and installed skills. | Uses local shell/file tooling through the operator. | Implemented through prompts plus `agent:submit`. | Current human-in-the-loop real content generation. |
| Codex | Supported when environment provides subagent or parallel-agent mechanisms; otherwise roles run sequentially in session. | Strong support through project and installed skills. | Strong support for shell, file edits, browser checks, and local verification. | Strong support; required for this project. | Future interactive repository work and model-backed role execution. |
| Claude Code | Supported through Claude Code task patterns when available. | Supported through Claude Code conventions and project instructions. | Strong support in environments configured for local tools. | Strong support; must follow the same artifact names. | Alternative runtime, critique, revision, Anthropic-model-led runs. |
| Gemini CLI | Environment-dependent. | Limited or environment-dependent. | Environment-dependent. | Required for compatibility; adapter should refuse runs it cannot write. | Focused generation, critique, model-diversity checks, batch role execution. |
| Custom | Defined by the runner. | Optional. | Optional. | Required. | Automated orchestration, hosted workflows, repeatable batch generation. |

## Model Selection And Runtime Adapters

Model selection belongs to the run config, not to a specific runtime adapter. The `models.defaultModel` value sets the requested model for all roles, and `models.roleModels` can override individual roles such as `lesson-critic` or `component-build`.

Runtime adapters decide how to honor model requests:

- If the runtime can call or route to the requested model, it should use that model.
- If the runtime has a fixed model, it should record the mismatch in logs and continue only when the operator accepts the substitution.
- If a role-specific model is unsupported, the adapter should follow `modelFallbackPolicy` from `run.config.json`.
- If a provider requires credentials or external access, the adapter should report the missing capability without changing artifact contracts.

`modelFallbackPolicy` values:

- `require_approval`: In `interactive` or `supervised` mode, pause and ask the operator before substituting a model. In `batch` mode, fail with an actionable error that names the unavailable provider, model, and role.
- `use_default`: If a role-specific model is unavailable, use `models.defaultModel`. If the default model is unavailable, `interactive` and `supervised` modes pause for operator approval and `batch` mode fails. No silent provider substitution is allowed beyond the configured default model.
- `fail`: Fail immediately when any requested model is unavailable, including role-specific models and `models.defaultModel`.

Runtime selection and model selection are separate axes. For example:

- A Codex runtime can execute file edits while the config records a requested Anthropic model for `lesson-critic`.
- A Claude Code runtime can follow the same `web_deck` artifact workflow and write the same lesson artifact contract, such as `artifacts/lesson.vN.json` and `artifacts/lesson.approved.json`.
- A custom runner can dispatch different roles to different providers while preserving the same run directory.

## Non-Goals

- Runtime adapters do not replace Codex, Claude Code, Gemini CLI, or other agent environments.
- Real provider API adapters are not implemented yet.
- Adapters do not change the lesson object contract per runtime.
- Adapters do not make hidden chat history the source of truth.
- Adapters do not require every runtime to support subagents, skills, or tool calls equally.
- Adapters do not call multiple model APIs directly unless a later implementation phase explicitly adds that capability.
