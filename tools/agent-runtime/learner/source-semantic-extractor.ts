import type { SourceAnchor } from "../corpus-types.js";

export type SourceSemanticConcept = {
  id: string;
  label: string;
  sourceAnchorIds: string[];
};

export type SourceSemantics = {
  concepts: SourceSemanticConcept[];
  examples: Array<{ id: string; title: string; sourceAnchorIds: string[] }>;
  misconceptions: Array<{ id: string; statement: string; correction: string; sourceAnchorIds: string[] }>;
  teachingAngles: string[];
};

export function extractSourceSemantics(input: { sourceKind: string; anchors: SourceAnchor[] }): SourceSemantics {
  const sourceKind = normalizeSourceKind(input.sourceKind);
  const sourceAnchorIds = input.anchors.map((anchor) => anchor.anchorId);
  const labels = labelsForKind(sourceKind);

  return {
    concepts: labels.map((label, index) => ({
      id: `concept-${String(index + 1).padStart(2, "0")}`,
      label,
      sourceAnchorIds: anchorSlice(sourceAnchorIds, index, labels.length)
    })),
    examples: labels.map((label, index) => ({
      id: `example-${String(index + 1).padStart(2, "0")}`,
      title: `${label} 的 ${sourceKind === "patent" ? "claim / embodiment" : "source"} 例子`,
      sourceAnchorIds: anchorSlice(sourceAnchorIds, index, labels.length)
    })),
    misconceptions: misconceptionsForKind(sourceKind, sourceAnchorIds),
    teachingAngles: teachingAnglesForKind(sourceKind)
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

function anchorSlice(anchorIds: string[], index: number, total: number): string[] {
  if (anchorIds.length <= 1 || total <= 1) {
    return anchorIds;
  }
  const chunkSize = Math.max(1, Math.ceil(anchorIds.length / total));
  const start = Math.min(index * chunkSize, Math.max(0, anchorIds.length - 1));
  const chunk = anchorIds.slice(start, start + chunkSize);
  return chunk.length > 0 ? chunk : anchorIds.slice(0, 1);
}
