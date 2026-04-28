import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeAdapter, RuntimeAdapterContext, RuntimeAdapterResult } from "./mock-adapter.js";

export class CodexManualAdapter implements RuntimeAdapter {
  async executeRole(context: RuntimeAdapterContext): Promise<RuntimeAdapterResult> {
    const promptPath = path.join(context.runPath, "manual-requests", `${context.artifactId}.md`);
    await mkdir(path.dirname(promptPath), { recursive: true });
    await writeFile(promptPath, renderPrompt(context), "utf8");

    return {
      kind: "manual_action_required",
      roleId: context.roleId,
      artifactId: context.artifactId,
      promptPath,
      message: `Codex manual step prepared for ${context.roleId}. Generate JSON and submit it with npm run agent:submit.`
    };
  }
}

function renderPrompt({ config, roleId, artifactId }: RuntimeAdapterContext): string {
  return `# Codex Manual Role Request

You are executing one role in the AI Interactive Learning Agent workflow.

## Run

- Run ID: ${config.runId}
- Topic: ${config.topic}
- Audience: ${config.audience}
- Output language: ${config.outputLanguage}
- Target output: ${config.targetOutput}
- Requested page count: ${config.pageCount.target}

## Role

- Role ID: ${roleId}
- Output artifact ID: ${artifactId}

## Instructions

Generate one valid JSON object for the output artifact. Keep the content Chinese-first unless the run config explicitly says otherwise. Preserve the requested page count where the role plans or assembles lesson pages.

After writing the JSON object to a temporary file, submit it with:

\`\`\`bash
npm run agent:submit -- --run ${config.runId} --artifact ${artifactId} --file <json-file>
\`\`\`

Do not approve the artifact automatically. After submission, inspect the versioned artifact under \`runs/${config.runId}/artifacts/\` and use the normal approval or revision gate.
`;
}
