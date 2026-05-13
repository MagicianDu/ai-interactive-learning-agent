import { isRecord } from "./validation-result.js";

export type ProfessorLectureStatus = "passed" | "warning";
export type ProfessorLectureMoveId =
  | "course_framing"
  | "prerequisites"
  | "concept_framework"
  | "definitions"
  | "key_link"
  | "worked_example"
  | "comparison"
  | "boundary_case"
  | "lecture_takeaway";

export type ProfessorLectureRubricMoveResult = {
  id: ProfessorLectureMoveId;
  label: string;
  description: string;
  satisfied: boolean;
  evidence: string[];
};

export type ProfessorLectureRubricResult = {
  status: ProfessorLectureStatus;
  requiredMoveCount: number;
  satisfiedMoveCount: number;
  requiredMoves: ProfessorLectureRubricMoveResult[];
  missingMoves: ProfessorLectureRubricMoveResult[];
};

type ProfessorLectureMove = {
  id: ProfessorLectureMoveId;
  label: string;
  description: string;
  markers: string[];
};

const professorLectureMoves: ProfessorLectureMove[] = [
  {
    id: "course_framing",
    label: "course framing",
    description: "Frame the unit with lecture positioning, core question, and coverage boundary.",
    markers: ["本讲定位", "课程框架", "核心问题", "覆盖边界", "learning boundary"]
  },
  {
    id: "prerequisites",
    label: "prerequisites",
    description: "Name the prerequisite knowledge or preparation learners need for the lecture.",
    markers: ["先修", "预备知识", "已有基础", "prerequisite", "prerequisites"]
  },
  {
    id: "concept_framework",
    label: "concept framework",
    description: "Map the lecture's conceptual framework, taxonomy, theory structure, or method family.",
    markers: ["知识节点", "概念地图", "概念框架", "方法谱系", "理论结构", "concept framework", "concept map", "taxonomy"]
  },
  {
    id: "definitions",
    label: "definitions",
    description: "Introduce key definitions, terms, or formal terminology as explicit lecture content.",
    markers: ["关键定义", "定义", "术语", "正式术语", "definition", "definitions", "terminology"]
  },
  {
    id: "key_link",
    label: "key link",
    description: "Explain the key links among concepts, mechanisms, states, or steps.",
    markers: ["关键链路", "因果角色", "状态变化", "推导链", "机制模型", "key link"]
  },
  {
    id: "worked_example",
    label: "worked example",
    description: "Use a worked example, classic example, case analysis, or derivation.",
    markers: ["经典例题", "案例分析", "case analysis", "worked example", "展开推导", "example"]
  },
  {
    id: "comparison",
    label: "comparison",
    description: "Compare alternatives and name tradeoffs, boundaries, or counterexamples.",
    markers: ["方法比较", "比较", "权衡", "适用边界", "反例", "comparison", "tradeoff"]
  },
  {
    id: "boundary_case",
    label: "boundary case",
    description: "Use boundary cases, counterexamples, or adjacent scenarios to limit claims.",
    markers: ["边界案例", "边界条件", "相邻场景", "反例", "保留条件", "断裂条件", "boundary case"]
  },
  {
    id: "lecture_takeaway",
    label: "summary map",
    description: "Close with a summary map, key takeaways, or next-unit connection.",
    markers: ["总结图", "总结要点", "下一讲", "下一单元", "summary map", "takeaway", "takeaways"]
  }
];

export function evaluateProfessorLectureRubric(lessons: unknown[]): ProfessorLectureRubricResult {
  const text = lessonText(lessons).toLocaleLowerCase();
  const requiredMoves = professorLectureMoves.map((move) => evaluateMove(move, text));
  const missingMoves = requiredMoves.filter((move) => !move.satisfied);

  return {
    status: missingMoves.length > 0 ? "warning" : "passed",
    requiredMoveCount: requiredMoves.length,
    satisfiedMoveCount: requiredMoves.length - missingMoves.length,
    requiredMoves,
    missingMoves
  };
}

function evaluateMove(move: ProfessorLectureMove, text: string): ProfessorLectureRubricMoveResult {
  const evidence = move.markers.filter((marker) => text.includes(marker.toLocaleLowerCase()));
  return {
    id: move.id,
    label: move.label,
    description: move.description,
    satisfied: evidence.length > 0,
    evidence: Array.from(new Set(evidence))
  };
}

function lessonText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(lessonText).join("\n");
  }
  if (!isRecord(value)) {
    return "";
  }
  return Object.values(value).map(lessonText).join("\n");
}
