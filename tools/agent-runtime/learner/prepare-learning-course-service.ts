import { AuthoringContextService, type AuthoringContextResult } from "./authoring-context-service.js";
import {
  LearnerProjectService,
  type CreateLearnerProjectInput,
  type CreateLearnerProjectResult,
  type LearnerBrief
} from "./learner-project-service.js";

export type PrepareLearningCourseInput = CreateLearnerProjectInput & {
  maxAnchors?: number;
};

export type PrepareLearningCourseResult =
  | {
      status: "clarification_required";
      runId: string;
      clarificationQuestions: string[];
      brief: LearnerBrief;
      project: Extract<CreateLearnerProjectResult, { status: "clarification_required" }>;
      next: {
        recommendedTool: "learning_agent.prepare_learning_course";
        instruction: string;
      };
    }
  | (AuthoringContextResult & {
      project: Extract<CreateLearnerProjectResult, { status: "project_ready" }>;
      next: {
        recommendedTool: "learning_agent.publish_learning_course";
        codexInstruction: string;
      };
    });

export class PrepareLearningCourseService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async prepare(input: PrepareLearningCourseInput): Promise<PrepareLearningCourseResult> {
    const project = await new LearnerProjectService(this.workspaceRoot).createProject(input);
    if (project.status === "clarification_required") {
      return {
        status: "clarification_required",
        runId: project.runId,
        clarificationQuestions: project.clarificationQuestions,
        brief: project.brief,
        project,
        next: {
          recommendedTool: "learning_agent.prepare_learning_course",
          instruction: "请先让学习者回答 clarificationQuestions，再用补充后的自然语言需求重新调用本工具。"
        }
      };
    }

    const context = await new AuthoringContextService(this.workspaceRoot).getContext({
      runId: project.runId,
      maxAnchors: input.maxAnchors
    });
    return {
      ...context,
      project,
      next: {
        recommendedTool: "learning_agent.publish_learning_course",
        codexInstruction: context.codexInstruction
      }
    };
  }
}
