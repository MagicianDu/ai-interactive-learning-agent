export class AgentRuntimeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_RUN_CONFIG"
      | "MISSING_RUN"
      | "MISSING_ARTIFACT"
      | "APPROVAL_REQUIRED"
      | "VERSION_CONFLICT"
      | "UNSUPPORTED_ADAPTER"
      | "PROMOTION_CONFLICT"
      | "INVALID_LESSON"
  ) {
    super(message);
    this.name = "AgentRuntimeError";
  }
}
