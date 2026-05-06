import type { SourceAnchor, SourceMaterialKind, SourceStructureNode } from "../corpus-types.js";
import type { SourceSemantics } from "../learner/source-semantic-extractor.js";

export type SourceGraphSourceKind = SourceMaterialKind | "folder" | "topic";

export type SourceGraphUnitKind = "chapter" | "section" | "claim" | "figure" | "paragraph" | "heading" | "note" | "topic";

export type SourceGraphUnitRole =
  | "chapter"
  | "problem"
  | "method"
  | "experiment"
  | "limitation"
  | "conclusion"
  | "claim"
  | "background"
  | "embodiment"
  | "figure"
  | "process"
  | "evaluation"
  | "caveat"
  | "argument"
  | "supporting_detail"
  | "topic";

export type SourceGraph = {
  runId: string;
  sourceKind: SourceGraphSourceKind;
  sourceUnits: SourceGraphUnit[];
  anchors: SourceAnchor[];
  concepts: SourceGraphConcept[];
  examples: SourceGraphExample[];
  misconceptions: SourceGraphMisconception[];
  candidateInteractions: SourceGraphInteraction[];
  coverage: SourceGraphCoverage;
};

export type SourceGraphUnit = {
  id: string;
  title: string;
  kind: SourceGraphUnitKind;
  role: SourceGraphUnitRole;
  order: number;
  anchorIds: string[];
  sourceNodeId?: string;
  headingPath?: string[];
};

export type SourceGraphConcept = {
  id: string;
  label: string;
  sourceUnitIds: string[];
  sourceAnchorIds: string[];
  prerequisiteIds: string[];
  exampleAnchorIds: string[];
  misconceptionIds: string[];
};

export type SourceGraphExample = {
  id: string;
  title: string;
  sourceUnitIds: string[];
  anchorIds: string[];
};

export type SourceGraphMisconception = {
  id: string;
  claim: string;
  correction: string;
  sourceUnitIds: string[];
  anchorIds: string[];
};

export type SourceGraphInteraction = {
  id: string;
  conceptId: string;
  kind: "prediction" | "stepper" | "comparison" | "parameter_experiment" | "debugging" | "build_from_parts";
  learnerAction: string;
  expectedObservation: string;
  anchorIds: string[];
};

export type SourceGraphCoverage = {
  anchorCount: number;
  sourceUnitCount: number;
  conceptCount: number;
  misconceptionCount: number;
  candidateInteractionCount: number;
  sourceUnitsWithAnchors: number;
  anchorsMappedToUnits: number;
};

export type BuildSourceGraphInput = {
  runId: string;
  sourceKind: string;
  structure: SourceStructureNode[];
  anchors: SourceAnchor[];
  semantics: SourceSemantics;
};

export function buildSourceGraph(input: BuildSourceGraphInput): SourceGraph {
  const sourceKind = normalizeSourceKind(input.sourceKind);
  const units = buildSourceUnits({
    sourceKind,
    structure: input.structure,
    anchors: input.anchors
  });
  const unitLookup = new Map(units.map((unit) => [unit.id, unit]));
  const anchorToUnitIds = buildAnchorToUnitIds(units);
  const examples = buildExamples(input.semantics, anchorToUnitIds, units);
  const misconceptions = buildMisconceptions(input.semantics, anchorToUnitIds, units);
  const concepts = input.semantics.concepts.map((concept, index) => {
    const sourceUnitIds = mapAnchorsToUnitIds(concept.sourceAnchorIds, anchorToUnitIds, units);
    const example = examples[index] ?? examples[0];
    return {
      id: concept.id,
      label: concept.label,
      sourceUnitIds,
      sourceAnchorIds: withFallbackAnchorIds(concept.sourceAnchorIds, input.anchors),
      prerequisiteIds: index > 0 ? [input.semantics.concepts[index - 1]?.id ?? "concept-01"] : [],
      exampleAnchorIds: example?.anchorIds ?? withFallbackAnchorIds(concept.sourceAnchorIds, input.anchors),
      misconceptionIds: misconceptions.slice(0, Math.max(1, Math.min(2, misconceptions.length))).map((misconception) => misconception.id)
    };
  });
  const candidateInteractions = buildCandidateInteractions(concepts, misconceptions, input.anchors);

  return {
    runId: input.runId,
    sourceKind,
    sourceUnits: units.filter((unit) => unitLookup.has(unit.id)),
    anchors: input.anchors,
    concepts,
    examples,
    misconceptions,
    candidateInteractions,
    coverage: {
      anchorCount: input.anchors.length,
      sourceUnitCount: units.length,
      conceptCount: concepts.length,
      misconceptionCount: misconceptions.length,
      candidateInteractionCount: candidateInteractions.length,
      sourceUnitsWithAnchors: units.filter((unit) => unit.anchorIds.length > 0).length,
      anchorsMappedToUnits: new Set(units.flatMap((unit) => unit.anchorIds)).size
    }
  };
}

function buildSourceUnits(input: {
  sourceKind: SourceGraphSourceKind;
  structure: SourceStructureNode[];
  anchors: SourceAnchor[];
}): SourceGraphUnit[] {
  const anchorsById = new Map(input.anchors.map((anchor) => [anchor.anchorId, anchor]));
  const nonRootNodes = input.structure.filter((node) => !node.id.endsWith(":root") && node.type !== "document");
  const nodes = nonRootNodes.length > 0 ? nonRootNodes : input.anchors.map(anchorToStructureNode);

  return nodes.map((node, index) => {
    const firstAnchor = node.anchorIds.map((anchorId) => anchorsById.get(anchorId)).find(Boolean);
    return {
      id: node.id,
      title: node.title,
      kind: unitKindForNode(node, firstAnchor),
      role: unitRoleForNode(input.sourceKind, node, firstAnchor),
      order: index + 1,
      anchorIds: node.anchorIds,
      sourceNodeId: node.id,
      ...(firstAnchor?.locator.kind === "heading" ? { headingPath: firstAnchor.locator.headingPath } : {})
    };
  });
}

function anchorToStructureNode(anchor: SourceAnchor): SourceStructureNode {
  return {
    id: anchor.anchorId,
    sourceId: anchor.sourceId,
    type: anchor.locator.kind === "claim" ? "claim" : anchor.locator.kind === "figure" ? "figure" : anchor.locator.kind === "paragraph" ? "paragraph" : "section",
    title: anchor.label,
    anchorIds: [anchor.anchorId],
    children: []
  };
}

function unitKindForNode(node: SourceStructureNode, anchor: SourceAnchor | undefined): SourceGraphUnitKind {
  if (node.type === "chapter") return "chapter";
  if (node.type === "claim") return "claim";
  if (node.type === "figure") return "figure";
  if (node.type === "paragraph") return "paragraph";
  if (anchor?.locator.kind === "heading") {
    return "heading";
  }
  if (anchor?.locator.kind === "claim") {
    return "claim";
  }
  if (anchor?.locator.kind === "figure") {
    return "figure";
  }
  if (anchor?.locator.kind === "paragraph") {
    return "paragraph";
  }
  return "section";
}

function unitRoleForNode(sourceKind: SourceGraphSourceKind, node: SourceStructureNode, anchor: SourceAnchor | undefined): SourceGraphUnitRole {
  const text = `${node.title} ${anchor?.quote ?? ""}`.toLowerCase();
  if (sourceKind === "book") {
    return node.type === "chapter" || /chapter|第\s*[一二三四五六七八九十\d]+\s*[章节部篇]/iu.test(text) ? "chapter" : "supporting_detail";
  }
  if (sourceKind === "paper") {
    if (/abstract|introduction|problem|motivation|摘要|引言|问题/u.test(text)) return "problem";
    if (/experiment|evaluation|result|实验|评估|结果/u.test(text)) return "experiment";
    if (/method|approach|architecture|model|方法|架构|模型/u.test(text)) return "method";
    if (/limitation|threat|局限|限制|边界/u.test(text)) return "limitation";
    if (/conclusion|discussion|结论|讨论/u.test(text)) return "conclusion";
    return "supporting_detail";
  }
  if (sourceKind === "patent") {
    if (node.type === "claim" || anchor?.locator.kind === "claim" || /claim|权利要求/u.test(text)) return "claim";
    if (node.type === "figure" || anchor?.locator.kind === "figure" || /figure|fig\.?|附图|图\s*\d+/u.test(text)) return "figure";
    if (/background|prior art|背景技术|现有技术/u.test(text)) return "background";
    if (/embodiment|implementation|具体实施|实施例/u.test(text)) return "embodiment";
    return "supporting_detail";
  }
  if (sourceKind === "blog") {
    if (/why|problem|fail|challenge|问题|挑战|失败/u.test(text)) return "problem";
    if (/step|implementation|process|workflow|journey|how|步骤|流程|实现|操作/u.test(text)) return "process";
    if (/evaluation|measure|metric|评估|指标/u.test(text)) return "evaluation";
    if (/caveat|risk|limit|注意|风险|局限/u.test(text)) return "caveat";
    return "argument";
  }
  if (sourceKind === "topic") {
    return "topic";
  }
  return "supporting_detail";
}

function buildExamples(
  semantics: SourceSemantics,
  anchorToUnitIds: Map<string, string[]>,
  units: SourceGraphUnit[]
): SourceGraphExample[] {
  return semantics.examples.map((example) => ({
    id: example.id,
    title: example.title,
    sourceUnitIds: mapAnchorsToUnitIds(example.sourceAnchorIds, anchorToUnitIds, units),
    anchorIds: withFallbackAnchorIds(example.sourceAnchorIds, [])
  }));
}

function buildMisconceptions(
  semantics: SourceSemantics,
  anchorToUnitIds: Map<string, string[]>,
  units: SourceGraphUnit[]
): SourceGraphMisconception[] {
  const sourceMisconceptions = semantics.misconceptions.map((misconception) => ({
    id: misconception.id,
    claim: misconception.statement,
    correction: misconception.correction,
    sourceUnitIds: mapAnchorsToUnitIds(misconception.sourceAnchorIds, anchorToUnitIds, units),
    anchorIds: withFallbackAnchorIds(misconception.sourceAnchorIds, [])
  }));
  const fallbackAnchors = units.flatMap((unit) => unit.anchorIds).slice(0, 2);
  const fallback: SourceGraphMisconception = {
    id: "source-boundary",
    claim: "只要资料里出现过一个说法，就可以把它当成通用结论。",
    correction: "需要同时检查来源位置、适用条件、证据边界和能否迁移到新场景。",
    sourceUnitIds: units.slice(0, 2).map((unit) => unit.id),
    anchorIds: fallbackAnchors
  };
  return sourceMisconceptions.some((misconception) => misconception.id === fallback.id)
    ? sourceMisconceptions
    : [...sourceMisconceptions, fallback];
}

function buildCandidateInteractions(
  concepts: SourceGraphConcept[],
  misconceptions: SourceGraphMisconception[],
  anchors: SourceAnchor[]
): SourceGraphInteraction[] {
  const primaryConceptId = concepts[0]?.id ?? "concept-01";
  const secondaryConceptId = concepts[1]?.id ?? primaryConceptId;
  const anchorIds = anchors.map((anchor) => anchor.anchorId);

  return [
    {
      id: "predict-source-support",
      conceptId: primaryConceptId,
      kind: "prediction",
      learnerAction: "先预测一个解释最可能由哪段来源支持",
      expectedObservation: "系统展示预测锚点和真实锚点的差异，帮助学习者建立来源定位能力。",
      anchorIds: anchorIds.slice(0, 2)
    },
    {
      id: "compare-misconception-boundary",
      conceptId: secondaryConceptId,
      kind: "comparison",
      learnerAction: `比较正确解释和误区：${misconceptions[0]?.claim ?? "摘要等于理解"}`,
      expectedObservation: "系统解释两个说法在证据、机制和边界上的差别。",
      anchorIds: anchorIds.slice(0, 2)
    }
  ];
}

function buildAnchorToUnitIds(units: SourceGraphUnit[]): Map<string, string[]> {
  const lookup = new Map<string, string[]>();
  for (const unit of units) {
    for (const anchorId of unit.anchorIds) {
      lookup.set(anchorId, [...(lookup.get(anchorId) ?? []), unit.id]);
    }
  }
  return lookup;
}

function mapAnchorsToUnitIds(anchorIds: string[], anchorToUnitIds: Map<string, string[]>, units: SourceGraphUnit[]): string[] {
  const mapped = uniqueStrings(anchorIds.flatMap((anchorId) => anchorToUnitIds.get(anchorId) ?? []));
  if (mapped.length > 0) {
    return mapped;
  }
  return units.slice(0, 1).map((unit) => unit.id);
}

function withFallbackAnchorIds(anchorIds: string[], anchors: SourceAnchor[]): string[] {
  if (anchorIds.length > 0) {
    return uniqueStrings(anchorIds);
  }
  return anchors.slice(0, 1).map((anchor) => anchor.anchorId);
}

function normalizeSourceKind(sourceKind: string): SourceGraphSourceKind {
  const normalized = sourceKind.trim().toLowerCase();
  if (
    normalized === "book" ||
    normalized === "paper" ||
    normalized === "patent" ||
    normalized === "blog" ||
    normalized === "documentation" ||
    normalized === "notes" ||
    normalized === "course" ||
    normalized === "mixed" ||
    normalized === "folder" ||
    normalized === "topic"
  ) {
    return normalized;
  }
  return "unknown";
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
