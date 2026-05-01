import type { CoursePack } from "../../schemas/course-pack.schema";

export const generatedCoursePack = {
  id: "demo-agentic-design-grounded",
  title: "Agentic Design Patterns中文课程：课程包",
  parentRunId: "demo-agentic-design-grounded",
  sourceKind: "book",
  strategy: "hybrid",
  audience: "有编程基础但缺少智能体系统心智模型的中文学习者",
  language: "zh-CN",
  overviewUnitId: "unit-overview",
  units: [
    {
      unitId: "unit-overview",
      title: "Agentic Design Patterns中文课程：总览课",
      kind: "overview",
      lessonId: "demo-agentic-design-grounded-overview",
      targetPageCount: 8,
      sourceAnchorIds: [
        "source-001:page-1",
        "source-001:paragraph-page-1-1",
        "source-001:page-3",
        "source-001:paragraph-page-3-1",
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      sourceNodeIds: [
        "source-001:root"
      ],
      conceptIds: [
        "concept-01",
        "concept-02",
        "concept-03",
        "concept-04",
        "concept-05"
      ]
    },
    {
      unitId: "unit-topic-01",
      title: "Agentic Design Patterns中文课程：agent loop",
      kind: "hybrid",
      lessonId: "demo-agentic-design-grounded-topic-01",
      targetPageCount: 8,
      sourceAnchorIds: [
        "source-001:paragraph-page-3-2",
        "source-001:paragraph-page-3-3",
        "source-001:page-4",
        "source-001:paragraph-page-4-1"
      ],
      sourceNodeIds: [
        "source-001:root"
      ],
      conceptIds: [
        "concept-02"
      ]
    }
  ]
} satisfies CoursePack;
