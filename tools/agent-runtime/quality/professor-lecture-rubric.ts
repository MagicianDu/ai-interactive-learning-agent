import { isRecord } from "./validation-result.js";

export type ProfessorLectureStatus = "passed" | "warning";
export type ProfessorLectureMoveId =
  | "course_framing"
  | "concept_map"
  | "method_structure"
  | "worked_example"
  | "comparative_boundary"
  | "discussion_prompt"
  | "homework_or_reading"
  | "takeaway";

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
    description: "Frame the lecture with positioning, core question, prerequisites, or learning boundary.",
    markers: ["课程框架", "本讲定位", "核心问题", "学习边界", "先修要求", "lecture frame", "framing"]
  },
  {
    id: "concept_map",
    label: "concept map",
    description: "Name the lecture's key definitions, terms, taxonomy, or theory map.",
    markers: ["概念地图", "关键定义", "术语", "方法谱系", "理论结构", "concept map", "taxonomy"]
  },
  {
    id: "method_structure",
    label: "method structure",
    description: "Explain the method, mechanism, reasoning structure, or applicable conditions.",
    markers: ["方法结构", "机制结构", "推导", "适用条件", "reasoning structure", "method structure"]
  },
  {
    id: "worked_example",
    label: "worked example",
    description: "Use a worked example, classic example, case analysis, or derivation.",
    markers: ["经典例题", "案例分析", "case analysis", "worked example", "展开推导", "example"]
  },
  {
    id: "comparative_boundary",
    label: "comparative boundary",
    description: "Compare alternatives and name tradeoffs, boundaries, or counterexamples.",
    markers: ["方法比较", "比较", "权衡", "适用边界", "反例", "boundary", "tradeoff"]
  },
  {
    id: "discussion_prompt",
    label: "discussion prompt",
    description: "Prompt seminar-style critique, discussion, or reference points.",
    markers: ["课堂讨论题", "课堂讨论", "批判", "参考要点", "discussion prompt", "seminar"]
  },
  {
    id: "homework_or_reading",
    label: "homework or reading",
    description: "Assign reading, homework, a problem set, or post-class work.",
    markers: ["课后作业", "阅读路径", "problem set", "homework", "reading"]
  },
  {
    id: "takeaway",
    label: "takeaway",
    description: "Close with takeaways, review checklist, or next-lecture connection.",
    markers: ["takeaway", "复习清单", "下一讲", "总结要点", "takeaways"]
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
