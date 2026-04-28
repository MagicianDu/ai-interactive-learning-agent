import type { ApprovalGateId } from "../types.js";

export type RoleId =
  | "source-ingest"
  | "learning-architecture"
  | "visual-pedagogy"
  | "interaction-design"
  | "assessment-design"
  | "lesson-assembly"
  | "lesson-critic"
  | "publish-package";

export type WorkflowArtifactId =
  | "source-ingest"
  | "learning-architecture"
  | "visual-plan"
  | "interaction-plan"
  | "assessment-plan"
  | "lesson"
  | "critic-report"
  | "publish-package";

export type RoleStep = {
  roleId: RoleId;
  artifactId: WorkflowArtifactId;
  requiredApprovedGateBefore?: ApprovalGateId;
  createsGate?: ApprovalGateId;
};

export const roleSequence: readonly RoleStep[] = [
  { roleId: "source-ingest", artifactId: "source-ingest" },
  {
    roleId: "learning-architecture",
    artifactId: "learning-architecture",
    createsGate: "learning-architecture"
  },
  {
    roleId: "visual-pedagogy",
    artifactId: "visual-plan",
    requiredApprovedGateBefore: "learning-architecture"
  },
  {
    roleId: "interaction-design",
    artifactId: "interaction-plan",
    requiredApprovedGateBefore: "learning-architecture"
  },
  {
    roleId: "assessment-design",
    artifactId: "assessment-plan",
    requiredApprovedGateBefore: "learning-architecture"
  },
  {
    roleId: "lesson-assembly",
    artifactId: "lesson",
    requiredApprovedGateBefore: "learning-architecture",
    createsGate: "lesson"
  },
  {
    roleId: "lesson-critic",
    artifactId: "critic-report",
    requiredApprovedGateBefore: "lesson",
    createsGate: "critic-report"
  },
  {
    roleId: "publish-package",
    artifactId: "publish-package",
    requiredApprovedGateBefore: "critic-report",
    createsGate: "publish-package"
  }
];
