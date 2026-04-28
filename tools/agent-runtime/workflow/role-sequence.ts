import type { ApprovalGateId } from "../types.js";

export type RoleId =
  | "corpus-ingest"
  | "concept-mapper"
  | "curriculum-planner"
  | "source-ingest"
  | "learning-architecture"
  | "visual-pedagogy"
  | "interaction-design"
  | "assessment-design"
  | "lesson-assembly"
  | "lesson-critic"
  | "publish-package";

export type WorkflowArtifactId =
  | "source-map"
  | "concept-map"
  | "curriculum-plan"
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
  { roleId: "corpus-ingest", artifactId: "source-map", createsGate: "source-map" },
  {
    roleId: "concept-mapper",
    artifactId: "concept-map",
    requiredApprovedGateBefore: "source-map",
    createsGate: "concept-map"
  },
  {
    roleId: "curriculum-planner",
    artifactId: "curriculum-plan",
    requiredApprovedGateBefore: "concept-map",
    createsGate: "curriculum-plan"
  },
  { roleId: "source-ingest", artifactId: "source-ingest", requiredApprovedGateBefore: "curriculum-plan" },
  {
    roleId: "learning-architecture",
    artifactId: "learning-architecture",
    requiredApprovedGateBefore: "curriculum-plan",
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
