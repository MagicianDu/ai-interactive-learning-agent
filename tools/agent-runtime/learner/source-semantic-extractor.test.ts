import { describe, expect, it } from "vitest";

import type { SourceAnchor } from "../corpus-types.js";
import { extractSourceSemantics } from "./source-semantic-extractor.js";

const anchors: SourceAnchor[] = [
  {
    anchorId: "a1",
    sourceId: "source-001",
    label: "page 1",
    locator: { kind: "page", page: 1 },
    quote: "Abstract: We propose an agentic workflow with planning, tool use, reflection, and evaluation."
  },
  {
    anchorId: "a2",
    sourceId: "source-001",
    label: "page 2",
    locator: { kind: "page", page: 2 },
    quote: "Experiments show limitations when tool feedback is missing."
  },
  {
    anchorId: "a3",
    sourceId: "source-001",
    label: "page 3",
    locator: { kind: "page", page: 3 },
    quote: "The workflow transfers to new review and planning settings when assumptions hold."
  }
];

function labelsFor(sourceKind: string): string[] {
  return extractSourceSemantics({ sourceKind, anchors }).concepts.map((concept) => concept.label);
}

describe("extractSourceSemantics", () => {
  it("extracts paper-specific teaching concepts", () => {
    const semantics = extractSourceSemantics({ sourceKind: "paper", anchors });

    expect(semantics.concepts.map((concept) => concept.label)).toEqual(["研究问题", "方法结构", "证据边界", "局限条件", "迁移应用"]);
    expect(semantics.examples[0]).toMatchObject({
      title: expect.stringContaining("研究问题"),
      sourceAnchorIds: expect.arrayContaining(["a1"])
    });
    expect(semantics.misconceptions[0].statement).toContain("贡献");
    expect(semantics.teachingAngles.join("\n")).toContain("问题、方法、证据和局限");
  });

  it("extracts patent-specific teaching concepts from claim anchors", () => {
    const semantics = extractSourceSemantics({
      sourceKind: "patent",
      anchors: [
        {
          anchorId: "c1",
          sourceId: "patent",
          label: "claim 1",
          locator: { kind: "claim", claimNumber: "1" },
          quote: "Claim 1 describes a technical solution and embodiment."
        }
      ]
    });

    expect(semantics.concepts.map((concept) => concept.label)).toEqual(["权利要求边界", "技术方案", "实施例", "术语定义", "风险边界"]);
    expect(semantics.examples[0].title).toContain("claim");
    expect(semantics.misconceptions[0].correction).toContain("权利要求");
  });

  it("extracts blog-specific teaching concepts", () => {
    const semantics = extractSourceSemantics({ sourceKind: "blog", anchors });

    expect(semantics.concepts.map((concept) => concept.label)).toEqual(["实践问题", "操作流程", "工具选择", "评估方式", "迁移应用"]);
    expect(semantics.misconceptions[0].statement).toContain("博客步骤");
    expect(semantics.teachingAngles.join("\n")).toContain("实践问题");
  });

  it("uses book/default concepts for book and unknown source kinds", () => {
    expect(labelsFor("book")).toEqual(["全局地图", "核心机制", "关键例子", "常见误区", "迁移应用"]);
    expect(labelsFor("unknown")).toEqual(["全局地图", "核心机制", "关键例子", "常见误区", "迁移应用"]);
  });

  it("extracts source-specific terms, evidence, and limitations from real anchors", () => {
    const semantics = extractSourceSemantics({
      sourceKind: "book",
      anchors: [
        {
          anchorId: "h1",
          sourceId: "book",
          label: "Tool Feedback and Reflection",
          locator: { kind: "heading", headingPath: ["Tool Feedback and Reflection"] },
          quote: "Tool feedback lets the agent observe whether an action worked before planning the next step."
        },
        {
          anchorId: "p1",
          sourceId: "book",
          label: "Evaluation",
          locator: { kind: "paragraph", paragraphId: "p1" },
          quote: "Experiments show that reflection and evaluation improve reliability when assumptions hold."
        },
        {
          anchorId: "p2",
          sourceId: "book",
          label: "Limitations",
          locator: { kind: "paragraph", paragraphId: "p2" },
          quote: "Limitations appear when tool feedback is missing; more agents do not automatically improve quality."
        }
      ]
    });

    expect(semantics.keyTerms.map((term) => term.term)).toEqual(
      expect.arrayContaining(["tool feedback", "reflection", "evaluation", "planning"])
    );
    expect(semantics.evidenceHints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statement: expect.stringContaining("Experiments show"),
          sourceAnchorIds: ["p1"]
        })
      ])
    );
    expect(semantics.limitationHints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statement: expect.stringContaining("Limitations appear"),
          sourceAnchorIds: ["p2"]
        })
      ])
    );
    expect(semantics.misconceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statement: expect.stringContaining("more agents do not automatically improve quality")
        })
      ])
    );
    expect(semantics.sourceSpecificTeachingMoves.join("\n")).toContain("tool feedback");
  });

  it("filters PDF structural noise from key terms", () => {
    const semantics = extractSourceSemantics({
      sourceKind: "paper",
      anchors: [
        {
          anchorId: "pdf-1",
          sourceId: "paper",
          label: "paragraph page 1",
          locator: { kind: "page", page: 1 },
          quote:
            "Preprint abstract: Language agents benefit from a Talker-Reasoner architecture where a talker handles interaction and a reasoner handles internal reasoning."
        },
        {
          anchorId: "pdf-2",
          sourceId: "paper",
          label: "paragraph page 2",
          locator: { kind: "page", page: 2 },
          quote: "The reasoner tracks evidence and tool feedback while the talker manages user-facing clarification."
        }
      ]
    });

    const terms = semantics.keyTerms.map((term) => term.term);
    expect(terms).toEqual(expect.arrayContaining(["talker-reasoner", "internal reasoning", "tool feedback"]));
    expect(terms).not.toEqual(expect.arrayContaining(["paragraph", "preprint", "abstract", "language"]));
  });
});
