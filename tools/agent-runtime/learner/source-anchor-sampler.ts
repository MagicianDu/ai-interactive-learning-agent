import type { SourceAnchor } from "../corpus-types.js";

export type SampleAuthoringAnchorsInput = {
  anchors: SourceAnchor[];
  sourceKind: string;
  maxAnchors: number;
  selectedTopics: string[];
  selectedChapters: string[];
  topic: string;
  chapterAnchorGroups?: Array<{
    title: string;
    anchorIds: string[];
  }>;
};

const frontMatterPatterns = [
  /\btable of contents\b/iu,
  /\bcontents\b/iu,
  /\bdedication\b/iu,
  /\bdedicated\b/iu,
  /\backnowledg(?:e)?ments?\b/iu,
  /\bforeword\b/iu,
  /\bspecial thanks\b/iu,
  /\bthanks to\b/iu,
  /\bgrateful\b/iu,
  /\bappreciation\b/iu,
  /\btotal\s+\d+\s+pages?\b/iu,
  /题献|献给|致谢|目录/u
];

const technicalContentPatterns = [
  /\bwhat makes\b/iu,
  /\bwhy\b/iu,
  /\bhow\b/iu,
  /\boverview\b/iu,
  /\bpattern\b/iu,
  /\bframework\b/iu,
  /\bsystem\b/iu,
  /\barchitecture\b/iu,
  /\bworkflow\b/iu,
  /\btool\b/iu,
  /\bmemory\b/iu,
  /\bplanning\b/iu,
  /\breflection\b/iu,
  /\bstate\b/iu,
  /\bagent\b/iu,
  /机制|结构|流程|架构|工具|记忆|规划|反思|状态|模式/u
];

export function sampleAuthoringAnchors(input: SampleAuthoringAnchorsInput): SourceAnchor[] {
  if (input.maxAnchors <= 0) {
    return [];
  }
  if (input.anchors.length <= input.maxAnchors) {
    return input.anchors;
  }

  const queryTerms = queryTermsFor(input);
  const chapterBalancedAnchors = chapterBalancedSample(input, queryTerms);
  if (chapterBalancedAnchors.length >= input.maxAnchors) {
    return chapterBalancedAnchors.slice(0, input.maxAnchors);
  }
  const selectedAnchorIds = new Set(chapterBalancedAnchors.map((anchor) => anchor.anchorId));
  const ranked = input.anchors
    .filter((anchor) => !selectedAnchorIds.has(anchor.anchorId))
    .map((anchor, index) => ({
      anchor,
      index,
      score: scoreAnchor(anchor, index, queryTerms, input.sourceKind)
    }))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      return scoreDelta !== 0 ? scoreDelta : left.index - right.index;
    });

  return [...chapterBalancedAnchors, ...ranked.slice(0, input.maxAnchors - chapterBalancedAnchors.length).map((item) => item.anchor)];
}

function chapterBalancedSample(input: SampleAuthoringAnchorsInput, queryTerms: string[]): SourceAnchor[] {
  if (input.sourceKind !== "book" || !input.chapterAnchorGroups?.length) {
    return [];
  }
  const anchorsById = new Map(input.anchors.map((anchor) => [anchor.anchorId, anchor]));
  const groups = prioritizeChapterGroups(input.chapterAnchorGroups, queryTerms);
  const selected: SourceAnchor[] = [];
  for (const group of groups) {
    const candidates = group.anchorIds.map((anchorId) => anchorsById.get(anchorId)).filter((anchor): anchor is SourceAnchor => Boolean(anchor));
    if (candidates.length === 0) {
      continue;
    }
    selected.push(bestChapterRepresentative(candidates, queryTerms, input.sourceKind));
    if (selected.length >= input.maxAnchors) {
      break;
    }
  }
  return dedupeAnchors(selected);
}

function prioritizeChapterGroups(
  groups: NonNullable<SampleAuthoringAnchorsInput["chapterAnchorGroups"]>,
  queryTerms: string[]
): NonNullable<SampleAuthoringAnchorsInput["chapterAnchorGroups"]> {
  if (queryTerms.length === 0) {
    return groups;
  }
  return [...groups].sort((left, right) => chapterGroupScore(right, queryTerms) - chapterGroupScore(left, queryTerms));
}

function chapterGroupScore(group: { title: string; anchorIds: string[] }, queryTerms: string[]): number {
  const title = group.title.toLowerCase();
  return queryTerms.reduce((score, term) => (title.includes(term) ? score + 1 : score), 0);
}

function bestChapterRepresentative(anchors: SourceAnchor[], queryTerms: string[], sourceKind: string): SourceAnchor {
  return [...anchors].sort((left, right) => {
    const scoreDelta = scoreAnchor(right, 0, queryTerms, sourceKind) - scoreAnchor(left, 0, queryTerms, sourceKind);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return locatorRank(left) - locatorRank(right);
  })[0] as SourceAnchor;
}

function locatorRank(anchor: SourceAnchor): number {
  if (anchor.locator.kind === "heading") {
    return 0;
  }
  if (anchor.locator.kind === "page") {
    return 1;
  }
  return 2;
}

function dedupeAnchors(anchors: SourceAnchor[]): SourceAnchor[] {
  const seen = new Set<string>();
  return anchors.filter((anchor) => {
    if (seen.has(anchor.anchorId)) {
      return false;
    }
    seen.add(anchor.anchorId);
    return true;
  });
}

function scoreAnchor(anchor: SourceAnchor, index: number, queryTerms: string[], sourceKind: string): number {
  const text = anchorText(anchor);
  const normalized = text.toLowerCase();
  let score = 1000 - index;

  for (const term of queryTerms) {
    if (term.length > 0 && normalized.includes(term)) {
      score += 5000;
    }
  }

  if (technicalContentPatterns.some((pattern) => pattern.test(text))) {
    score += 1200;
  }

  if (anchor.locator.kind === "heading") {
    score += 400;
  }

  if (sourceKind === "book" && frontMatterPatterns.some((pattern) => pattern.test(text))) {
    score -= 6000;
  }

  return score;
}

function queryTermsFor(input: SampleAuthoringAnchorsInput): string[] {
  return uniqueTerms([...input.selectedTopics, ...input.selectedChapters]).flatMap((value) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9\u3400-\u9fff]+/u)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
  );
}

function uniqueTerms(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function anchorText(anchor: SourceAnchor): string {
  return [anchor.label, anchor.quote, anchor.notes].filter((value): value is string => typeof value === "string").join("\n");
}
