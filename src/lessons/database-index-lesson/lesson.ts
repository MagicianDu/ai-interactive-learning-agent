import type { Lesson } from "../../schemas/lesson.schema";

export const generatedLesson = {
  id: "database-index-lesson",
  title: "为什么数据库索引能让查询更快",
  audience: "具备基础技术背景、希望通过中文互动课程建立心智模型的学习者。",
  config: {
    targetPageCount: 8,
    minPageCount: 6,
    maxPageCount: 10
  },
  prerequisites: [
    "会读简单 SELECT 查询",
    "理解表、行、列的基本关系"
  ],
  learningObjectives: [
    "解释索引如何减少查询需要检查的数据范围",
    "区分全表扫描和索引查找的执行路径",
    "判断查询条件是否具有足够选择性",
    "说明索引带来的写入和存储成本"
  ],
  pages: [
    {
      id: "page-01",
      type: "problem_scene",
      title: "1000 万行里找一条记录",
      learningGoal: "感受无索引查询的搜索压力",
      narrative: "先从慢查询问题出发，而不是直接定义索引。"
    },
    {
      id: "page-02",
      type: "intuition_visual",
      title: "有目录和没有目录的书",
      learningGoal: "建立索引缩小查找范围的直觉",
      narrative: "目录让读者跳到相关页，索引让数据库跳到相关范围。"
    },
    {
      id: "page-03",
      type: "structure_diagram",
      title: "表行与索引结构",
      learningGoal: "看见数据表和索引之间的不同组织方式",
      narrative: "表按存储顺序排列，索引按键值组织并指向行。"
    },
    {
      id: "page-04",
      type: "process_animation",
      title: "全表扫描如何工作",
      learningGoal: "理解逐行检查为什么随数据量增长变慢",
      narrative: "数据库需要把不匹配的行也检查一遍。"
    },
    {
      id: "page-05",
      type: "process_animation",
      title: "索引查找如何缩小路径",
      learningGoal: "理解 B+ 树直觉下的路径选择",
      narrative: "索引先定位键值范围，再访问少量候选行。"
    },
    {
      id: "page-06",
      type: "interactive_model",
      title: "选择查询条件并观察路径",
      learningGoal: "判断查询是否能利用索引",
      narrative: "学习者改变条件，系统反馈全表扫描或索引查找。"
    },
    {
      id: "page-07",
      type: "misconception_check",
      title: "索引总是有帮助吗",
      learningGoal: "识别低选择性和写入成本带来的反例",
      narrative: "索引不是免费加速器，它需要维护和空间。"
    },
    {
      id: "page-08",
      type: "code_walkthrough",
      title: "从 SQL 看到索引选择",
      learningGoal: "把直觉连接到 CREATE INDEX 和查询条件",
      narrative: "短 SQL 示例展示单列索引和复合索引顺序。"
    }
  ],
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
  summary: [
    "索引通过缩小搜索空间提升读取效率",
    "高选择性条件更容易从索引获益",
    "索引会增加写入维护和存储成本"
  ]
} satisfies Lesson;
