import type { ArtifactVersion } from "../artifact-store.js";
import type { RunConfig } from "../types.js";
import type { RoleId, WorkflowArtifactId } from "../workflow/role-sequence.js";

export type RuntimeAdapter = {
  executeRole(context: RuntimeAdapterContext): Promise<RuntimeAdapterResult>;
};

export type RuntimeAdapterContext = {
  config: RunConfig;
  runPath: string;
  roleId: RoleId;
  artifactId: WorkflowArtifactId;
};

export type RuntimeAdapterResult =
  | {
      kind: "artifact";
      payload: unknown;
    }
  | {
      kind: "manual_action_required";
      roleId: RoleId;
      artifactId: WorkflowArtifactId;
      promptPath: string;
      expectedVersion?: ArtifactVersion;
      message: string;
    };

export class MockRuntimeAdapter implements RuntimeAdapter {
  async executeRole({ config, roleId, artifactId }: RuntimeAdapterContext): Promise<RuntimeAdapterResult> {
    if (roleId === "source-ingest") {
      return artifactResult({
        artifactId,
        roleId,
        language: "zh-CN",
        topic: config.topic,
        concepts: ["全表扫描", "索引查找", "选择性", "B+树直觉", "复合索引顺序", "写入与存储成本"],
        dependencies: ["基础 SQL 查询", "表、行、列的概念"],
        examples: ["在 1000 万行订单表中查找某个用户的订单", "比较无索引扫描和按 user_id 索引查找"],
        misconceptions: ["索引总是让所有查询更快", "建越多索引越好", "复合索引中的列顺序不重要"],
        candidateInteractions: ["选择查询条件并观察扫描路径", "判断是否值得为某个场景添加索引"]
      });
    }

    if (roleId === "learning-architecture") {
      return artifactResult({
        artifactId,
        roleId,
        language: "zh-CN",
        audience: config.audience,
        pageCount: {
          ...config.pageCount,
          planned: config.pageCount.target
        },
        prerequisites: ["会读简单 SELECT 查询", "理解表由多行记录组成"],
        learningObjectives: [
          "解释为什么全表扫描会随数据量增长变慢",
          "用 B+ 树直觉说明索引如何缩小搜索空间",
          "判断某个查询条件是否可能利用索引",
          "说明索引带来的写入和存储代价"
        ],
        pageSequence: buildPageSequence(config.pageCount.target)
      });
    }

    if (roleId === "lesson-assembly" && artifactId === "lesson") {
      return artifactResult({
        id: "database-index-lesson",
        title: "为什么数据库索引能让查询更快",
        audience: config.audience,
        config: {
          targetPageCount: config.pageCount.target,
          minPageCount: config.pageCount.min,
          maxPageCount: config.pageCount.max
        },
        language: "zh-CN",
        prerequisites: ["会读简单 SELECT 查询", "理解表、行、列的基本关系"],
        learningObjectives: [
          "解释索引如何减少查询需要检查的数据范围",
          "区分全表扫描和索引查找的执行路径",
          "判断查询条件是否具有足够选择性",
          "说明索引带来的写入和存储成本"
        ],
        pages: buildLessonPages(config.pageCount.target),
        misconceptions: [
          {
            id: "misconception-index-always-fast",
            statement: "索引并不总是让查询更快",
            correction: "索引只在能显著缩小候选数据范围时更有价值；低选择性查询可能仍然接近全表扫描。"
          },
          {
            id: "misconception-composite-order",
            statement: "复合索引中的列顺序不会影响查询",
            correction: "复合索引通常优先利用最左侧列，查询条件顺序和选择性会影响可用路径。"
          },
          {
            id: "misconception-more-indexes",
            statement: "索引越多数据库越快",
            correction: "每个索引都需要额外存储，并在写入、更新、删除时付出维护成本。"
          }
        ],
        transferTasks: [
          {
            id: "transfer-user-order-index",
            prompt: "判断用户订单查询是否适合为 user_id 建索引",
            targetMentalModel: "用读取频率、选择性、写入成本三项共同判断索引是否值得。"
          },
          {
            id: "transfer-log-search",
            prompt: "把选择性直觉迁移到日志检索和缓存键设计",
            targetMentalModel: "任何加速结构都在用额外组织方式换取更小的搜索空间。"
          }
        ],
        summary: ["索引通过缩小搜索空间提升读取效率", "高选择性条件更容易从索引获益", "索引会增加写入维护和存储成本"]
      });
    }

    return artifactResult({
      artifactId,
      roleId,
      language: "zh-CN",
      topic: config.topic,
      status: "mocked",
      notes: `${roleId} 已生成 ${artifactId} 的占位草稿。`
    });
  }
}

function artifactResult(payload: unknown): RuntimeAdapterResult {
  return {
    kind: "artifact",
    payload
  };
}

function buildPageSequence(targetPageCount: number): string[] {
  const baseSequence = [
    "问题场景：1000 万行查询",
    "直觉：有目录和没有目录的书",
    "结构：表行与索引结构",
    "过程：全表扫描",
    "过程：索引查找",
    "互动：选择条件观察路径",
    "误区：索引总是有帮助",
    "SQL 走读：创建和使用索引",
    "迁移挑战：是否应该加索引",
    "总结卡片"
  ];

  return Array.from({ length: targetPageCount }, (_, index) => baseSequence[index % baseSequence.length]);
}

function buildLessonPages(targetPageCount: number): Array<{
  id: string;
  type: string;
  title: string;
  learningGoal: string;
  narrative: string;
}> {
  const basePages = [
    {
      type: "problem_scene",
      title: "1000 万行里找一条记录",
      learningGoal: "感受无索引查询的搜索压力",
      narrative: "先从慢查询问题出发，而不是直接定义索引。"
    },
    {
      type: "intuition_visual",
      title: "有目录和没有目录的书",
      learningGoal: "建立索引缩小查找范围的直觉",
      narrative: "目录让读者跳到相关页，索引让数据库跳到相关范围。"
    },
    {
      type: "structure_diagram",
      title: "表行与索引结构",
      learningGoal: "看见数据表和索引之间的不同组织方式",
      narrative: "表按存储顺序排列，索引按键值组织并指向行。"
    },
    {
      type: "process_animation",
      title: "全表扫描如何工作",
      learningGoal: "理解逐行检查为什么随数据量增长变慢",
      narrative: "数据库需要把不匹配的行也检查一遍。"
    },
    {
      type: "process_animation",
      title: "索引查找如何缩小路径",
      learningGoal: "理解 B+ 树直觉下的路径选择",
      narrative: "索引先定位键值范围，再访问少量候选行。"
    },
    {
      type: "interactive_model",
      title: "选择查询条件并观察路径",
      learningGoal: "判断查询是否能利用索引",
      narrative: "学习者改变条件，系统反馈全表扫描或索引查找。"
    },
    {
      type: "misconception_check",
      title: "索引总是有帮助吗",
      learningGoal: "识别低选择性和写入成本带来的反例",
      narrative: "索引不是免费加速器，它需要维护和空间。"
    },
    {
      type: "code_walkthrough",
      title: "从 SQL 看到索引选择",
      learningGoal: "把直觉连接到 CREATE INDEX 和查询条件",
      narrative: "短 SQL 示例展示单列索引和复合索引顺序。"
    },
    {
      type: "transfer_challenge",
      title: "迁移到订单查询设计",
      learningGoal: "在新场景中决定是否加索引",
      narrative: "根据读取频率、选择性、写入成本做取舍。"
    },
    {
      type: "summary_card",
      title: "可迁移心智模型",
      learningGoal: "压缩索引决策规则",
      narrative: "索引用额外结构换取更小的搜索空间，但要支付维护成本。"
    }
  ];

  return Array.from({ length: targetPageCount }, (_, index) => {
    const page = basePages[index % basePages.length];
    return {
      id: `page-${String(index + 1).padStart(2, "0")}`,
      ...page
    };
  });
}
