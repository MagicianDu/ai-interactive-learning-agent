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
${roleSpecificInstructions(roleId, artifactId)}

## Instructions

Generate one valid JSON object for the output artifact. Keep the content Chinese-first unless the run config explicitly says otherwise. Preserve the requested page count where the role plans or assembles lesson pages.

After writing the JSON object to a temporary file, submit it with:

\`\`\`bash
npm run agent:submit -- --run ${config.runId} --artifact ${artifactId} --file <json-file>
\`\`\`

Do not approve the artifact automatically. After submission, inspect the versioned artifact under \`runs/${config.runId}/artifacts/\` and use the normal approval or revision gate.
`;
}

function roleSpecificInstructions(roleId: string, artifactId: string): string {
  if (artifactId === "source-map") {
    return `- Output Contract: SourceMap JSON
- Required fields: corpusId, sources, structure, anchors, extractionNotes
- Every source-derived item must have a SourceAnchor.
- For topic-only sources, create an anchor such as \`source-001:topic\`.
`;
  }

  if (artifactId === "concept-map") {
    return `- Output Contract: ConceptMap JSON
- Required fields: concepts, dependencies, misconceptions, examples
- Every concept, edge, misconception, and example must include sourceAnchorIds.
- Mark inferred concepts with inferred: true when appropriate.
`;
  }

  if (artifactId === "curriculum-plan") {
    return `- Output Contract: CurriculumPlan JSON
- Required fields: mode, userProfile, coveragePolicy, units, sourceCoverage, conceptCoverage, rationale
- Use the selected curriculumPlanningMode from the run config.
- Preserve preferredPageCountPerUnit when defining each unit targetPageCount.
`;
  }

  return `- Output Contract: return a valid JSON object for artifact ${artifactId}.
`;
}
