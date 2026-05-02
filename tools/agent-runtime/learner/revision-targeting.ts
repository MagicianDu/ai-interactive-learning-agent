export type RevisionTarget =
  | { scope: "course"; requestedChange: string }
  | { scope: "unit"; unitId?: string; requestedChange: string }
  | { scope: "page"; pageIndex: number; requestedChange: string }
  | { scope: "interaction"; pageIndex?: number; requestedChange: string }
  | { scope: "assessment"; pageIndex?: number; requestedChange: string }
  | { scope: "source"; requestedChange: string };

export function parseRevisionTarget(feedback: string, focus?: string): RevisionTarget {
  const requestedChange = feedback.trim();
  const targetText = `${focus ?? ""} ${feedback}`;
  const page = /第\s*(?<page>[0-9一二三四五六七八九十]+)\s*页/u.exec(targetText)?.groups?.page;
  if (page) {
    return { scope: "page", pageIndex: chineseNumberToIndex(page), requestedChange };
  }
  if (/结构|章节|topic|单元|路径/iu.test(targetText)) {
    return { scope: "course", requestedChange };
  }
  if (/互动|操作|选择|实验/iu.test(targetText)) {
    return { scope: "interaction", requestedChange };
  }
  if (/测验|题|评估/iu.test(targetText)) {
    return { scope: "assessment", requestedChange };
  }
  if (/来源|引用|锚点/iu.test(targetText)) {
    return { scope: "source", requestedChange };
  }
  return { scope: "unit", requestedChange };
}

function chineseNumberToIndex(value: string): number {
  return Math.max(0, chineseNumberToNumber(value) - 1);
}

function chineseNumberToNumber(value: string): number {
  const direct = Number(value);
  if (Number.isInteger(direct) && direct > 0) {
    return direct;
  }

  const digitMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };
  if (value === "十") {
    return 10;
  }
  if (value.includes("十")) {
    const [tensText, onesText] = value.split("十");
    const tens = tensText.length > 0 ? digitMap[tensText] ?? 1 : 1;
    const ones = onesText.length > 0 ? digitMap[onesText] ?? 0 : 0;
    return tens * 10 + ones;
  }

  return digitMap[value] ?? 1;
}
