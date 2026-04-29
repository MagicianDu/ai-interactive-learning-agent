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
      message: `${runtimeEntryLabel(context.config.runtime.adapter, context.config.models?.defaultModel?.provider)} manual step prepared for ${context.roleId}. Generate JSON and submit it with npm run agent:submit.`
    };
  }
}

function renderPrompt({ config, roleId, artifactId }: RuntimeAdapterContext): string {
  const modelHint = runtimeEntryLabel(config.runtime.adapter, config.models.defaultModel.provider);
  return `# Codex Manual Role Request

You are executing one role in the AI Interactive Learning Agent workflow via ${modelHint}.

## Run

- Run ID: ${config.runId}
- Topic: ${config.topic}
- Source kind: ${config.sourceKind ?? "unknown"}
- Audience: ${config.audience}
- Output language: ${config.outputLanguage}
- Target output: ${config.targetOutput}
- Requested page count per unit: ${config.coursePack?.unitPageCount ?? config.pageCount.target}
- Curriculum planning mode: ${config.curriculumPlanningMode}
- Course pack strategy: ${config.coursePack?.strategy ?? "single_lesson"}
- Include overview unit: ${String(config.coursePack?.includeOverview ?? false)}
- Preserve source/chapter mapping: ${String(config.coursePack?.preserveSourceMapping ?? false)}

## Sources

\`\`\`json
${JSON.stringify(config.sources, null, 2)}
\`\`\`

${config.selectedUnit ? `## Selected Learning Unit

\`\`\`json
${JSON.stringify(config.selectedUnit, null, 2)}
\`\`\`
` : ""}

## Role

- Role ID: ${roleId}
- Output artifact ID: ${artifactId}
${roleSpecificInstructions(roleId, artifactId)}

## Instructions

Generate one valid JSON object for the output artifact. Keep the content Chinese-first unless the run config explicitly says otherwise. For source-backed runs, keep source anchors and chapter/section mappings instead of compressing the whole source into one short lesson. If a selected learning unit is present, generate only for that unit and use its source anchors, concept ids, chapter refs, and targetPageCount. Preserve the requested per-unit page count where the role plans or assembles lesson pages.
This is a natural-language workflow: you can reason in Chinese or English, then output only the JSON artifact.

After writing the JSON object to a temporary file, submit it with:

\`\`\`bash
npm run agent:submit -- --run ${config.runId} --artifact ${artifactId} --file <json-file>
\`\`\`

Do not approve the artifact automatically. After submission, inspect the versioned artifact under \`runs/${config.runId}/artifacts/\` and use the normal approval or revision gate.
`;
}

function runtimeEntryLabel(adapterId: string, provider: string): string {
  const normalizedProvider = provider.toLowerCase();
  if (normalizedProvider === "claude") {
    return "Claude-compatible operator session";
  }
  if (normalizedProvider === "openclaw") {
    return "OpenClaw-compatible operator session";
  }
  if (normalizedProvider === "codex") {
    return "Codex-compatible operator session";
  }
  if (adapterId === "mock") {
    return "mock runner";
  }
  return `${normalizedProvider || adapterId}-compatible operator session`;
}

function roleSpecificInstructions(roleId: string, artifactId: string): string {
  if (artifactId === "source-map") {
    return `- Output Contract: SourceMap JSON
- Required fields: corpusId, sources, structure, anchors, extractionNotes, extractionWarnings
- Every source-derived item must have a SourceAnchor.
- For topic-only sources, create an anchor such as \`source-001:topic\`.
- For books, preserve page/heading/chapter anchors when available.
- For papers, preserve abstract, method, experiment, result, limitation, and citation-related anchors when present.
- For patents, preserve claim, figure, embodiment, and prior-art anchors when present.
- For blogs and docs, preserve heading hierarchy and URL anchors.
- If extraction fidelity is limited, record it in extractionWarnings instead of silently dropping source regions.
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
- Default strategy is overview_plus_topic when configured: create one overview unit first, then topic-focused units.
- Preserve preferredPageCountPerUnit / coursePack.unitPageCount when defining each unit targetPageCount.
- Preserve original chapter, section, claim, or source-node references in each unit even when the teaching sequence is topic-guided.
`;
  }

  return `- Output Contract: return a valid JSON object for artifact ${artifactId}.
`;
}
