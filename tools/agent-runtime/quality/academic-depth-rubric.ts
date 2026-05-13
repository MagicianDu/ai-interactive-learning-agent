import { isRecord } from "./validation-result.js";

export type AcademicDepthStatus = "passed" | "warning";
export type AcademicDepthMoveId =
  | "prerequisite_bridge"
  | "formal_abstraction"
  | "evidence_chain"
  | "assumption_boundary"
  | "case_analysis"
  | "boundary_application";

export type AcademicDepthRubricContext = {
  difficultyLevel?: string;
  sourceKind?: string;
};

export type AcademicDepthRubricMoveResult = {
  id: AcademicDepthMoveId;
  label: string;
  description: string;
  satisfied: boolean;
  evidence: string[];
};

export type AcademicDepthRubricResult = {
  status: AcademicDepthStatus;
  difficultyLevel: string;
  requiredMoveCount: number;
  satisfiedMoveCount: number;
  requiredMoves: AcademicDepthRubricMoveResult[];
  missingMoves: AcademicDepthRubricMoveResult[];
};

type AcademicDepthMove = {
  id: AcademicDepthMoveId;
  label: string;
  description: string;
  markers: string[];
};

const academicDepthMoves: AcademicDepthMove[] = [
  {
    id: "prerequisite_bridge",
    label: "prerequisite bridge",
    description: "Connect the learner's prior knowledge to the course's new abstraction.",
    markers: ["先修", "预备知识", "已有基础", "prerequisite"]
  },
  {
    id: "formal_abstraction",
    label: "formal abstraction",
    description: "Introduce formal terminology, definitions, formulas, algorithms, or notation after intuition.",
    markers: ["正式术语", "定义", "公式", "算法", "notation", "formal"]
  },
  {
    id: "evidence_chain",
    label: "evidence chain",
    description: "Tie claims to source anchors, experiments, examples, or explicit evidence paths.",
    markers: ["证据链", "来源锚点", "实验现象", "source anchor", "evidence"]
  },
  {
    id: "assumption_boundary",
    label: "assumption and boundary",
    description: "Name assumptions, applicability limits, failure modes, or boundary conditions.",
    markers: ["假设", "适用条件", "适用边界", "局限", "边界条件", "failure mode", "limitation"]
  },
  {
    id: "case_analysis",
    label: "case analysis",
    description: "Use examples, comparisons, or case analysis to make the abstraction operational.",
    markers: ["案例分析", "经典例题", "应用案例", "反例", "权衡", "case analysis", "worked example"]
  },
  {
    id: "boundary_application",
    label: "boundary application",
    description: "Name adjacent applications, boundary cases, or conditions under which the claim changes.",
    markers: ["边界案例", "相邻场景", "保留条件", "断裂条件", "迁移边界", "适用条件", "transfer boundary"]
  }
];

export function evaluateAcademicDepthRubric(
  lessons: unknown[],
  context: AcademicDepthRubricContext | undefined
): AcademicDepthRubricResult | undefined {
  if (!requiresAcademicDepthRubric(lessons, context)) {
    return undefined;
  }

  const lessonText = lessons.map((lesson) => JSON.stringify(lesson)).join("\n").toLocaleLowerCase();
  const requiredMoves = academicDepthMoves.map((move) => evaluateMove(move, lessons, lessonText));
  const missingMoves = requiredMoves.filter((move) => !move.satisfied);

  return {
    status: missingMoves.length > 0 ? "warning" : "passed",
    difficultyLevel: context?.difficultyLevel ?? inferDifficultyLevelFromLessons(lessons),
    requiredMoveCount: requiredMoves.length,
    satisfiedMoveCount: requiredMoves.length - missingMoves.length,
    requiredMoves,
    missingMoves
  };
}

export function formatMissingAcademicDepthMoves(result: AcademicDepthRubricResult): string {
  return result.missingMoves.map((move) => move.label).join(", ");
}

function requiresAcademicDepthRubric(lessons: unknown[], context: AcademicDepthRubricContext | undefined): boolean {
  if (context?.difficultyLevel === "upper_undergraduate_or_graduate" || context?.difficultyLevel === "research") {
    return true;
  }
  const lessonText = lessons.map((lesson) => {
    if (!isRecord(lesson)) {
      return "";
    }
    return [lesson.audience, lesson.title].filter((value): value is string => typeof value === "string").join(" ");
  }).join(" ");
  return /研究生|大学高年级|论文精读|前沿讨论/u.test(lessonText);
}

function inferDifficultyLevelFromLessons(lessons: unknown[]): string {
  const lessonText = lessons.map((lesson) => (isRecord(lesson) ? [lesson.audience, lesson.title].join(" ") : "")).join(" ");
  if (/论文精读|前沿讨论/u.test(lessonText)) {
    return "research";
  }
  return "upper_undergraduate_or_graduate";
}

function evaluateMove(
  move: AcademicDepthMove,
  lessons: unknown[],
  lessonText: string
): AcademicDepthRubricMoveResult {
  const evidence = move.markers.filter((marker) => lessonText.includes(marker.toLocaleLowerCase()));
  if (move.id === "evidence_chain" && lessons.some(hasSourceAnchors)) {
    evidence.push("sourceAnchorIds");
  }
  if (move.id === "boundary_application" && lessons.some(hasTransferTask)) {
    evidence.push("transferTasks");
  }

  return {
    id: move.id,
    label: move.label,
    description: move.description,
    satisfied: evidence.length > 0,
    evidence: Array.from(new Set(evidence))
  };
}

function hasSourceAnchors(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (Array.isArray(value.sourceAnchorIds) && value.sourceAnchorIds.length > 0) {
    return true;
  }
  if (Array.isArray(value.pages) && value.pages.some(hasSourceAnchors)) {
    return true;
  }
  return false;
}

function hasTransferTask(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (Array.isArray(value.transferTasks) && value.transferTasks.length > 0) {
    return true;
  }
  return Array.isArray(value.pages) && value.pages.some((page) => isRecord(page) && page.type === "transfer_challenge");
}
