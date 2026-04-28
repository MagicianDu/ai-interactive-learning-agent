# Run Config Contract

## Purpose

A run config is the portable contract for one learning-experience generation run. It records the topic, source material, audience, output constraints, runtime adapter, model choices, and approval gates before any agent role produces artifacts.

The config keeps the workflow independent of a single agent environment. Codex, Claude Code, Gemini CLI, an MCP server, or a custom runner should be able to read the same run config and produce the same artifact sequence, even if their execution mechanics differ.

The local runner now implements the current Codex-first path through TypeScript CLI and orchestration code. It supports deterministic `mock` execution and operator-driven `codex-manual` execution. Real provider API adapters and the MCP server remain future interfaces that should reuse this same run config contract.

## Database Index Run Example

This is the current runnable local-runner example. It uses the deterministic `mock` adapter and `mock-learning-agent` model placeholder used by the CLI workflow.

```json
{
  "runId": "database-index-001",
  "topic": "Why database indexes make queries faster",
  "source": {
    "type": "topic",
    "value": "Why database indexes make queries faster",
    "notes": "Use mock data and accurate database-index concepts. Do not connect to a real database."
  },
  "audience": "Learners who understand basic tables and SQL SELECT queries but have not built a mental model of indexes",
  "outputLanguage": "zh-CN",
  "targetOutput": "web_deck",
  "pageCount": {
    "target": 10,
    "min": 8,
    "max": 12
  },
  "runtime": {
    "adapter": "mock",
    "mode": "interactive"
  },
  "models": {
    "defaultModel": {
      "provider": "mock",
      "model": "mock-learning-agent",
      "reasoningEffort": "medium",
      "temperature": 0.3
    }
  },
  "modelFallbackPolicy": "require_approval",
  "approvalGates": [
    "learning-architecture",
    "lesson",
    "critic-report",
    "publish-package"
  ]
}
```

## Fields

### `runId`

Stable identifier for this generation run. It is used as the directory name under `runs/<run-id>/` and should be unique within the project.

Recommended format:

```text
<lesson-or-topic-slug>-<sequence-or-date>
```

Example:

```json
"runId": "database-index-001"
```

### `topic`

Human-readable learning topic for the run. This is the shared anchor used by agents, logs, and approval screens.

Example:

```json
"topic": "Why database indexes make queries faster"
```

### `source`

Describes the input material. The first runs may use only a topic string. Later runs may point to pasted notes, local files, URLs, books, transcripts, or mixed sources.

Recommended shape:

```json
{
  "type": "topic",
  "value": "Why database indexes make queries faster",
  "notes": "Use the approved MVP outline as the product constraint."
}
```

Supported `type` values:

- `topic`: A topic string is the primary source.
- `text`: Pasted or generated source text.
- `file`: A local source file path.
- `url`: A web source URL captured by the operator or runtime.
- `mixed`: Multiple source items are provided.

For `topic`, `text`, `file`, and `url`, use:

```json
{
  "type": "file",
  "value": "docs/source-notes/database-index.md",
  "label": "Database index notes",
  "notes": "Use as source context for the first run."
}
```

For `mixed`, use an `items` array. Each item uses one non-mixed source type:

```json
{
  "type": "mixed",
  "items": [
    {
      "type": "topic",
      "value": "Why database indexes make queries faster",
      "label": "Topic"
    },
    {
      "type": "file",
      "value": "docs/source-notes/database-index.md",
      "label": "Source notes",
      "notes": "Prefer this file for examples and constraints."
    }
  ]
}
```

### `audience`

Defines prior knowledge, skill level, and learning context. Agents should use this to set prerequisite assumptions, examples, language, assessment difficulty, and transfer tasks.

Example:

```json
"audience": "Learners who understand basic tables and SQL SELECT queries"
```

### `outputLanguage`

Defines the primary language for generated learning artifacts and learner-facing UI labels.

The default for this project is:

```json
"outputLanguage": "zh-CN"
```

Rules:

- Agents should generate page titles, narratives, feedback, quiz prompts, learner actions, and summary cards in the requested language.
- For the default `zh-CN` setting, explanations must be Chinese-first.
- Standard technical tokens such as SQL, WHERE, index, key, B+ tree, cache, and API may remain in English when that is the term learners need to recognize.
- A runtime should not silently switch to English just because the source material or model prompt is English.

### `targetOutput`

The intended output form. The initial MVP output is `web_deck`, but the contract allows other product forms.

Recommended values:

- `web_deck`
- `canvas_map`
- `playground`
- `ai_tutor`
- `teacher_mode`
- `assessment_mode`
- `package`

### `pageCount`

Planning constraint for lesson architecture. It is not a renderer constant and must not be hard-coded into deck components.

Required shape:

```json
{
  "target": 10,
  "min": 8,
  "max": 12
}
```

Rules:

- `target` is the desired number of learner-facing pages.
- `min` is the fewest acceptable pages after planning tradeoffs.
- `max` is the most acceptable pages after planning tradeoffs.
- Learning Architecture Agent should justify any count that differs from `target`.
- Renderers should render the lesson object they receive rather than assuming a fixed page count.

### `runtime`

Selects the agent runtime adapter and execution mode for the run.

Required shape:

```json
{
  "adapter": "mock",
  "mode": "interactive"
}
```

Current CLI-executed `adapter` values:

- `mock`: deterministic local runner adapter used by the CLI.
- `codex-manual`: operator-driven Codex mode. The CLI writes a role prompt under `runs/<run-id>/manual-requests/`, returns `manual_action_required`, and expects the operator to submit generated JSON with `npm run agent:submit`.

Future-facing adapter values may include real provider-backed or environment-specific adapters such as `openai`, `anthropic`, `gemini`, or `custom`. These require implementation and provider validation before use.

Recommended `mode` values:

- `interactive`: The operator can approve gates, answer clarifying questions, and redirect the run.
- `supervised`: The runtime proceeds through known steps but pauses at approval gates.
- `batch`: The runtime runs from a complete config and writes artifacts for later review.

### Current Implementation Note

The first implemented interface is a Codex-first local runner using `mock` and `codex-manual` adapters. It uses the same run config contract and stores state under `runs/<run-id>/`. Real provider API adapters and the MCP server remain future work; the MCP server should wrap the same runtime core rather than duplicating orchestration logic.

### `models`

Provider-neutral model selection for the run. A runtime adapter should treat these as requested model assignments and either honor them or clearly report unsupported choices.

The current runnable CLI path uses the mock model placeholder:

Required shape:

```json
{
  "defaultModel": {
    "provider": "mock",
    "model": "mock-learning-agent",
    "reasoningEffort": "medium",
    "temperature": 0.3
  }
}
```

Future provider-backed examples may add real model ids and role overrides after the matching adapter exists:

```json
{
  "defaultModel": {
    "provider": "openai",
    "model": "future-openai-learning-model",
    "reasoningEffort": "medium",
    "temperature": 0.3
  },
  "roleModels": {
    "lesson-critic": {
      "provider": "anthropic",
      "model": "future-anthropic-critic-model",
      "reasoningEffort": "high",
      "temperature": 0.2
    }
  }
}
```

`defaultModel` applies to every role unless overridden.

`roleModels` maps role ids to role-specific model choices. Valid role ids are:

- `source-ingest`
- `learning-architecture`
- `visual-pedagogy`
- `interaction-design`
- `assessment-design`
- `lesson-assembly`
- `component-build`
- `lesson-critic`
- `publish-package`

Model reference fields:

- `provider`: Current runnable provider is `mock` for deterministic runs. `codex-manual` may use a descriptive provider/model pair such as `codex` / `manual-codex-session` because the active Codex session performs the generation. Future real-provider values may include `openai`, `anthropic`, `google`, `local`, or `custom` after the matching adapter exists.
- `model`: Provider-specific model name.
- `reasoningEffort`: Optional value of `low`, `medium`, or `high`.
- `temperature`: Optional numeric generation setting.

Model selection is separate from runtime selection. For example, a Codex run may use the Codex environment while requesting different provider models for particular roles when the runtime can support that mapping.

### `modelFallbackPolicy`

Defines what the runtime should do when a requested model cannot be used because the provider, model id, credentials, or role-level routing is unavailable.

Recommended value for interactive runs:

```json
"modelFallbackPolicy": "require_approval"
```

Supported values:

- `require_approval`: In `interactive` or `supervised` mode, pause and ask the operator before substituting a different model. In `batch` mode, fail with an actionable error that names the unavailable provider, model, and role.
- `use_default`: If a role-specific model is unavailable, use `models.defaultModel`. If `models.defaultModel` is unavailable, `interactive` and `supervised` modes pause for operator approval and `batch` mode fails with an actionable error. This policy never permits silent provider substitution beyond the configured default model.
- `fail`: Fail immediately when any requested model is unavailable, including role-specific models and `models.defaultModel`.

Interactive and supervised runs should prefer `require_approval` so model substitutions remain visible to the operator. Batch runs may use `fail` when reproducibility is more important than completing the run.

### `approvalGates`

Ordered list of artifacts or workflow points that require operator approval before the run proceeds.

Canonical gate ids:

- `learning-architecture`
- `lesson`
- `critic-report`
- `publish-package`

Gate-to-artifact mapping:

| Gate id | Approved artifact |
| --- | --- |
| `learning-architecture` | Exact version recorded in `approvals/learning-architecture.approved.json`; optional alias `artifacts/learning-architecture.approved.json` |
| `lesson` | Exact version recorded in `approvals/lesson.approved.json`; optional alias `artifacts/lesson.approved.json` |
| `critic-report` | Exact version recorded in `approvals/critic-report.approved.json`; optional alias `artifacts/critic-report.approved.json` |
| `publish-package` | Exact version recorded in `approvals/publish-package.approved.json`; optional alias `artifacts/publish-package.approved.json` |

Approval gates protect the learning design process. They prevent the system from jumping directly from a topic or source into UI implementation without first producing explicit, reviewable learning artifacts.

Additional review points may be configured by a future orchestrator, but these four ids are the canonical current approval gates.
