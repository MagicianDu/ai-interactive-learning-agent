import type { SourceAnchor } from "../corpus-types.js";

export type SourceSemanticConcept = {
  id: string;
  label: string;
  sourceAnchorIds: string[];
};

export type SourceSemanticHint = {
  id: string;
  statement: string;
  sourceAnchorIds: string[];
};

export type SourceSemanticTerm = {
  term: string;
  sourceAnchorIds: string[];
};

export type SourceSemantics = {
  concepts: SourceSemanticConcept[];
  keyTerms: SourceSemanticTerm[];
  examples: Array<{ id: string; title: string; sourceAnchorIds: string[] }>;
  evidenceHints: SourceSemanticHint[];
  limitationHints: SourceSemanticHint[];
  misconceptions: Array<{ id: string; statement: string; correction: string; sourceAnchorIds: string[] }>;
  teachingAngles: string[];
  sourceSpecificTeachingMoves: string[];
};

export function extractSourceSemantics(input: { sourceKind: string; anchors: SourceAnchor[] }): SourceSemantics {
  const sourceKind = normalizeSourceKind(input.sourceKind);
  const sourceAnchorIds = input.anchors.map((anchor) => anchor.anchorId);
  const labels = labelsForKind(sourceKind);
  const keyTerms = extractKeyTerms(input.anchors);
  const evidenceHints = extractEvidenceHints(input.anchors);
  const limitationHints = extractLimitationHints(input.anchors);

  return {
    concepts: labels.map((label, index) => ({
      id: `concept-${String(index + 1).padStart(2, "0")}`,
      label,
      sourceAnchorIds: anchorSlice(sourceAnchorIds, index, labels.length)
    })),
    keyTerms,
    examples: labels.map((label, index) => ({
      id: `example-${String(index + 1).padStart(2, "0")}`,
      title: `${label} 的 ${sourceKind === "patent" ? "claim / embodiment" : "source"} 例子`,
      sourceAnchorIds: anchorSlice(sourceAnchorIds, index, labels.length)
    })),
    evidenceHints,
    limitationHints,
    misconceptions: [...sourceMisconceptions(input.anchors), ...misconceptionsForKind(sourceKind, sourceAnchorIds)],
    teachingAngles: teachingAnglesForKind(sourceKind)
      .concat(evidenceHints.length > 0 ? ["把来源证据链转成案例判断和判断依据。"] : [])
      .concat(limitationHints.length > 0 ? ["用来源局限或反例设计边界案例。"] : []),
    sourceSpecificTeachingMoves: sourceSpecificTeachingMoves(keyTerms, evidenceHints, limitationHints)
  };
}

function normalizeSourceKind(sourceKind: string): string {
  return sourceKind.trim().toLowerCase();
}

function labelsForKind(sourceKind: string): string[] {
  if (sourceKind === "paper") return ["研究问题", "方法结构", "证据边界", "局限条件", "迁移应用"];
  if (sourceKind === "patent") return ["权利要求边界", "技术方案", "实施例", "术语定义", "风险边界"];
  if (sourceKind === "blog") return ["实践问题", "操作流程", "工具选择", "评估方式", "迁移应用"];
  if (sourceKind === "documentation") return ["使用场景", "关键配置", "操作流程", "错误恢复", "迁移应用"];
  return ["全局地图", "核心机制", "关键例子", "常见误区", "迁移应用"];
}

function misconceptionsForKind(sourceKind: string, sourceAnchorIds: string[]): SourceSemantics["misconceptions"] {
  if (sourceKind === "paper") {
    return [
      {
        id: "paper-contribution",
        statement: "论文贡献等于方法一定可靠。",
        correction: "贡献需要和假设、证据、局限一起理解。",
        sourceAnchorIds: sourceAnchorIds.slice(0, 2)
      }
    ];
  }
  if (sourceKind === "patent") {
    return [
      {
        id: "patent-claim",
        statement: "专利说明书里的例子都等于权利要求保护范围。",
        correction: "保护边界主要由权利要求决定，实施例用于解释技术方案。",
        sourceAnchorIds: sourceAnchorIds.slice(0, 2)
      }
    ];
  }
  if (sourceKind === "blog") {
    return [
      {
        id: "blog-steps",
        statement: "照着博客步骤做完就等于理解。",
        correction: "还需要理解每一步解决的问题、失败条件和迁移方式。",
        sourceAnchorIds: sourceAnchorIds.slice(0, 2)
      }
    ];
  }
  return [
    {
      id: "summary-understanding",
      statement: "摘要越完整就越懂。",
      correction: "理解需要机制、行动、反馈和迁移。",
      sourceAnchorIds: sourceAnchorIds.slice(0, 2)
    }
  ];
}

function teachingAnglesForKind(sourceKind: string): string[] {
  if (sourceKind === "paper") return ["先分清问题、方法、证据和局限", "用迁移任务检查方法边界"];
  if (sourceKind === "patent") return ["先看权利要求边界，再看实施例", "区分技术方案和解释性类比"];
  if (sourceKind === "blog") return ["先还原实践问题，再把步骤变成决策点", "用失败场景检查是否真正会用"];
  return ["先建立全局地图，再进入核心机制", "用行动和反馈确认是否理解"];
}

const englishStopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "by",
  "benefit",
  "for",
  "from",
  "handles",
  "in",
  "into",
  "is",
  "it",
  "lets",
  "manages",
  "of",
  "on",
  "or",
  "that",
  "the",
  "then",
  "this",
  "to",
  "tracks",
  "when",
  "whether",
  "while",
  "with"
]);

const structuralNoiseTerms = new Set([
  "abstract",
  "appendix",
  "arxiv",
  "bibliography",
  "copyright",
  "figure",
  "introduction",
  "language",
  "license",
  "page",
  "pages",
  "paper",
  "paragraph",
  "preprint",
  "reference",
  "references",
  "section",
  "table"
]);

const technicalSignalWords = new Set([
  "agent",
  "agents",
  "assumption",
  "assumptions",
  "evaluation",
  "feedback",
  "reasoner",
  "reasoning",
  "planning",
  "reflection",
  "reliability",
  "retrieval",
  "routing",
  "talker",
  "talker-reasoner",
  "tool",
  "tools",
  "workflow"
]);

function extractKeyTerms(anchors: SourceAnchor[]): SourceSemanticTerm[] {
  const termToAnchorIds = new Map<string, Set<string>>();
  for (const anchor of anchors) {
    const terms = new Set([...termsFromLabel(anchor.label), ...termsFromQuote(anchor.quote ?? "")]);
    for (const term of terms) {
      if (!term.trim()) {
        continue;
      }
      const anchorIds = termToAnchorIds.get(term) ?? new Set<string>();
      anchorIds.add(anchor.anchorId);
      termToAnchorIds.set(term, anchorIds);
    }
  }

  return [...termToAnchorIds.entries()]
    .filter(([term]) => isUsefulKeyTerm(term))
    .map(([term, anchorIds]) => ({ term, sourceAnchorIds: [...anchorIds] }))
    .sort(
      (first, second) =>
        keyTermSortScore(second) - keyTermSortScore(first) ||
        second.sourceAnchorIds.length - first.sourceAnchorIds.length ||
        first.term.localeCompare(second.term, "en")
    )
    .slice(0, 20);
}

function keyTermSortScore(term: SourceSemanticTerm): number {
  const tokens = term.term.split(/\s+/u);
  const phraseBonus = tokens.length > 1 ? 20 : 0;
  const signalBonus = tokens.some((token) => technicalSignalWords.has(token)) ? 10 : 0;
  const hyphenBonus = term.term.includes("-") ? 8 : 0;
  return term.sourceAnchorIds.length * 100 + phraseBonus + signalBonus + hyphenBonus;
}

function isUsefulKeyTerm(term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (structuralNoiseTerms.has(normalized)) {
    return false;
  }
  if (normalized.split(/\s+/u).every((token) => structuralNoiseTerms.has(token))) {
    return false;
  }
  return true;
}

function termsFromLabel(label: string): string[] {
  return splitTermPhrases(label)
    .flatMap((phrase) => termsFromQuote(phrase))
    .filter((term) => term.length > 3);
}

function termsFromQuote(quote: string): string[] {
  const normalized = quote.toLowerCase();
  const tokens = normalized.match(/[a-z][a-z0-9-]*/gu) ?? [];
  const terms = new Set<string>();

  for (const token of tokens) {
    if (technicalSignalWords.has(token) || (token.length >= 8 && !englishStopWords.has(token))) {
      terms.add(token);
    }
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index] as string;
    const second = tokens[index + 1] as string;
    if (isGoodTermToken(first) && isGoodTermToken(second) && (technicalSignalWords.has(first) || technicalSignalWords.has(second))) {
      terms.add(`${first} ${second}`);
    }
  }

  return [...terms];
}

function splitTermPhrases(value: string): string[] {
  return value
    .split(/\b(?:and|or|with|without)\b|[，,。:：；;|/()]+/iu)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isGoodTermToken(token: string): boolean {
  return token.length > 2 && !englishStopWords.has(token);
}

function extractEvidenceHints(anchors: SourceAnchor[]): SourceSemanticHint[] {
  const evidencePattern = /experiments?\s+show|results?\s+show|we\s+(?:show|demonstrate|propose)|evidence|evaluation|评估|实验|结果|证据/iu;
  return anchors
    .filter((anchor) => evidencePattern.test(anchor.quote ?? anchor.label))
    .map((anchor, index) => ({
      id: `evidence-${String(index + 1).padStart(2, "0")}`,
      statement: sentenceSnippet(anchor.quote ?? anchor.label, evidencePattern),
      sourceAnchorIds: [anchor.anchorId]
    }))
    .slice(0, 6);
}

function extractLimitationHints(anchors: SourceAnchor[]): SourceSemanticHint[] {
  const limitationPattern = /limitations?|assumptions?|missing|do\s+not\s+automatically|fail(?:s|ure)?|boundary|局限|假设|缺失|失败|边界|不足/iu;
  return anchors
    .filter((anchor) => limitationPattern.test(anchor.quote ?? anchor.label))
    .map((anchor, index) => ({
      id: `limitation-${String(index + 1).padStart(2, "0")}`,
      statement: sentenceSnippet(anchor.quote ?? anchor.label, limitationPattern),
      sourceAnchorIds: [anchor.anchorId]
    }))
    .slice(0, 6);
}

function sourceMisconceptions(anchors: SourceAnchor[]): SourceSemantics["misconceptions"] {
  const misconceptionPattern = /misconception|do\s+not\s+automatically|not\s+always|不能|不是|并不|误区/iu;
  return anchors
    .filter((anchor) => misconceptionPattern.test(anchor.quote ?? anchor.label))
    .map((anchor, index) => ({
      id: `source-misconception-${String(index + 1).padStart(2, "0")}`,
      statement: sentenceSnippet(anchor.quote ?? anchor.label, misconceptionPattern).replace(/^Limitations appear when /iu, ""),
      correction: "需要回到来源中的证据、假设和边界，而不是把局部经验泛化成绝对规则。",
      sourceAnchorIds: [anchor.anchorId]
    }))
    .slice(0, 4);
}

function sourceSpecificTeachingMoves(
  keyTerms: SourceSemanticTerm[],
  evidenceHints: SourceSemanticHint[],
  limitationHints: SourceSemanticHint[]
): string[] {
  const moves = keyTerms.slice(0, 4).map((term) => `围绕来源术语 ${term.term} 设计预测、比较或解释任务。`);
  if (evidenceHints.length > 0) {
    moves.push("把来源中的 evidence / evaluation 片段改写成案例判断和判断依据。");
  }
  if (limitationHints.length > 0) {
    moves.push("把来源中的 limitation / boundary 片段改写成边界案例和适用条件。");
  }
  return moves;
}

function sentenceSnippet(value: string, preferredPattern?: RegExp): string {
  const sentences = value
    .replace(/\s+/gu, " ")
    .trim()
    .split(/(?<=[.!?。！？])\s+/u)
    .filter(Boolean);
  const selected = preferredPattern ? sentences.find((sentence) => preferredPattern.test(sentence)) : undefined;
  return (selected ?? sentences[0] ?? "").slice(0, 240);
}

function anchorSlice(anchorIds: string[], index: number, total: number): string[] {
  if (anchorIds.length <= 1 || total <= 1) {
    return anchorIds;
  }
  const chunkSize = Math.max(1, Math.ceil(anchorIds.length / total));
  const start = Math.min(index * chunkSize, Math.max(0, anchorIds.length - 1));
  const chunk = anchorIds.slice(start, start + chunkSize);
  return chunk.length > 0 ? chunk : anchorIds.slice(0, 1);
}
