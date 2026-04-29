import type { SourceAnchor, SourceAnchorLocator } from "../corpus-types.js";

export type CreateSourceAnchorInput = {
  sourceId: string;
  label: string;
  locator: SourceAnchorLocator;
  quote?: string;
  notes?: string;
};

const chineseSlugMap: Record<string, string> = {
  第: "di",
  一: "yi",
  二: "er",
  三: "san",
  四: "si",
  五: "wu",
  六: "liu",
  七: "qi",
  八: "ba",
  九: "jiu",
  十: "shi",
  章: "zhang",
  节: "jie"
};

export function createSourceAnchor(input: CreateSourceAnchorInput): SourceAnchor {
  return {
    sourceId: input.sourceId,
    anchorId: createSourceAnchorId(input.sourceId, locatorIdParts(input.locator, input.label)),
    label: input.label,
    locator: input.locator,
    ...(input.quote ? { quote: input.quote } : {}),
    ...(input.notes ? { notes: input.notes } : {})
  };
}

export function createSourceAnchorId(sourceId: string, parts: string[]): string {
  const slug = parts
    .map(slugify)
    .filter(Boolean)
    .join("-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return `${sourceId}:${slug || "anchor"}`;
}

export function locatorLabel(locator: SourceAnchorLocator): string {
  if (locator.kind === "page") {
    return `page ${locator.page}`;
  }
  if (locator.kind === "heading") {
    return locator.headingPath.join(" > ");
  }
  if (locator.kind === "paragraph") {
    return `paragraph ${locator.paragraphId}`;
  }
  if (locator.kind === "range") {
    return `${locator.start}-${locator.end}`;
  }
  if (locator.kind === "claim") {
    return `claim ${locator.claimNumber}`;
  }
  if (locator.kind === "figure") {
    return `figure ${locator.figureNumber}`;
  }
  if (locator.kind === "table") {
    return `table ${locator.tableNumber}`;
  }
  return locator.fragment ? `${locator.url}#${locator.fragment}` : locator.url;
}

export function slugify(value: string): string {
  const normalized = Array.from(value.trim())
    .map((char) => (chineseSlugMap[char] ? ` ${chineseSlugMap[char]} ` : char))
    .join("");
  return normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

function locatorIdParts(locator: SourceAnchorLocator, label: string): string[] {
  if (locator.kind === "claim") {
    return [`claim-${locator.claimNumber}`];
  }
  if (locator.kind === "page") {
    return [`page-${locator.page}`];
  }
  if (locator.kind === "paragraph") {
    return [`paragraph-${locator.paragraphId}`];
  }
  if (locator.kind === "figure") {
    return [`figure-${locator.figureNumber}`];
  }
  if (locator.kind === "table") {
    return [`table-${locator.tableNumber}`];
  }
  if (locator.kind === "heading") {
    return [locator.headingPath.at(-1) ?? label];
  }
  if (locator.kind === "url_fragment") {
    return [locator.fragment ?? label];
  }
  return [label];
}
