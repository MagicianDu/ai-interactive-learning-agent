export type QualityIssue = {
  rule: string;
  path: string;
  message: string;
  severity: "error" | "warning";
};

export type QualityValidationResult = {
  ok: boolean;
  issues: QualityIssue[];
};

export function validationResult(issues: QualityIssue[]): QualityValidationResult {
  return {
    ok: issues.filter((issue) => issue.severity === "error").length === 0,
    issues
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
