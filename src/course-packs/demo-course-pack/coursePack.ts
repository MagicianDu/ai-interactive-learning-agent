import type { CoursePack } from "../../schemas/course-pack.schema";

export const generatedCoursePack = {
  id: "demo-course-pack",
  title: "Agentic Design Patterns 示例课程包：课程包",
  parentRunId: "demo-course-pack",
  sourceKind: "notes",
  strategy: "overview_plus_topic",
  units: [
    {
      unitId: "unit-overview",
      title: "Agentic Design Patterns 示例课程包：总览课",
      kind: "overview",
      lessonId: "demo-course-pack-unit-overview",
      targetPageCount: 8,
      sourceAnchorIds: [
        "source-001:paragraph-1"
      ],
      sourceNodeIds: [
        "source-001:root"
      ],
      conceptIds: [
        "agent-loop",
        "tool-use",
        "multi-agent-review"
      ]
    },
    {
      unitId: "unit-topic-01",
      title: "Agentic Design Patterns 示例课程包：核心机制",
      kind: "topic",
      lessonId: "demo-course-pack-unit-topic-01",
      targetPageCount: 8,
      sourceAnchorIds: [
        "source-001:paragraph-1"
      ],
      sourceNodeIds: [
        "source-001:root"
      ],
      conceptIds: [
        "agent-loop",
        "tool-use",
        "multi-agent-review"
      ]
    }
  ]
} satisfies CoursePack;
