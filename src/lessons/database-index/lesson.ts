import type { Lesson } from "../../schemas/lesson.schema";

export const databaseIndexLesson = {
  id: "database-index-speed",
  title: "数据库索引为什么更快",
  audience: "面向已经理解数据库表、字段和简单 SELECT 查询的中文学习者。",
  config: {
    targetPageCount: 10,
    minPageCount: 6,
    maxPageCount: 14,
  },
  prerequisites: [
    "表由行和列组成。",
    "WHERE 条件用来筛选行。",
    "数据库为了回答查询，可能需要检查候选行。",
  ],
  learningObjectives: [
    "解释为什么表越大，全表扫描越容易变慢。",
    "说明索引如何为选择性查询缩小搜索空间。",
    "预测某个查询会走索引查找还是全表扫描。",
    "识别索引的读性能收益、写入维护成本和存储成本。",
    "把索引的访问路径思想迁移到新的查询或系统设计场景。",
  ],
  pages: [
    {
      id: "p01-problem-10m-rows",
      type: "problem_scene",
      title: "问题引入：为什么全表扫描慢？",
      learningGoal: "理解查询性能问题来自“必须检查多少候选行”。",
      narrative:
        "一张 users 表有 1000 万行。产品需要按 email 找到一个用户。如果没有可用索引，数据库可能只能从头到尾逐行检查，直到找到匹配行或确认不存在。",
      visualSpec: {
        kind: "table",
        component: "table_scan",
        description: "用一张很长的用户表展示逐行扫描的路径，目标行藏在大量候选行中。",
        keyElements: [
          "1000 万行数据",
          "目标 email 行",
          "逐行扫描箭头",
          "已检查行数",
        ],
        states: ["不知道目标位置", "扫描开始", "大量行被检查", "找到目标行"],
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "如果 email 上没有索引，最坏情况下数据库可能检查多少行？",
        options: ["1 行", "约 log2(10,000,000) 行", "最多 10,000,000 行", "只检查 email 域名相同的行"],
        correctAnswer: "最多 10,000,000 行",
      },
      feedbackSpec: {
        correctFeedback:
          "对。没有可用访问路径时，数据库没有办法直接跳到目标位置，最坏情况下要检查整张表。",
        incorrectFeedback:
          "容易误以为数据库天然知道目标行在哪里。但没有索引或其他访问路径时，它只能用条件逐行判断。",
      },
    },
    {
      id: "p02-book-index-intuition",
      type: "intuition_visual",
      title: "直觉：书后的索引就是快捷路径",
      learningGoal: "用书本索引理解“先查小结构，再跳到目标位置”。",
      narrative:
        "找一个术语时，逐页翻书很慢。书后的索引把术语按顺序组织好，并指向页码。你先在小而有序的索引里定位，再跳到目标页。",
      visualSpec: {
        kind: "diagram",
        component: "book_index",
        description: "对比逐页阅读和“查索引再跳转”的两条路径。",
        keyElements: ["书页", "书后索引", "术语条目", "页码跳转箭头", "搜索空间变小"],
      },
    },
    {
      id: "p03-table-vs-index-structure",
      type: "structure_diagram",
      title: "结构：表数据和索引不是同一个东西",
      learningGoal: "看见索引是额外维护的有序结构，里面存 key 和行指针。",
      narrative:
        "表保存完整行。索引只保存被索引的 key，并按照可搜索的结构组织起来，再指向对应数据行。查询可以先搜索引，再回表取需要的行。",
      visualSpec: {
        kind: "tree",
        component: "index_tree",
        description: "用简化 B+ 树展示根节点、分支、叶子 key 和指向表行的指针。",
        keyElements: ["根节点", "分支节点", "叶子 key 范围", "行指针", "表数据行"],
      },
    },
    {
      id: "p04-full-table-scan",
      type: "process_animation",
      title: "过程：全表扫描怎样工作",
      learningGoal: "理解全表扫描的机制：读一行，判断一行。",
      narrative:
        "全表扫描会读取表中的候选行，并把 WHERE 条件应用到每一行。表很小或查询很宽时它可以接受；表很大且结果很少时，成本会迅速升高。",
      visualSpec: {
        kind: "animation",
        component: "table_scan",
        description: "行被依次点亮，WHERE 条件逐行判断，计数器持续增加。",
        keyElements: ["行流", "WHERE email = target@example.com", "已检查行数", "匹配行"],
        states: ["开始", "逐行检查", "大量不匹配", "找到匹配", "扫描结束"],
      },
    },
    {
      id: "p05-indexed-lookup",
      type: "process_animation",
      title: "过程：索引查找怎样缩小范围",
      learningGoal: "理解索引把路径从“检查很多行”改成“先定位范围，再取行”。",
      narrative:
        "有合适索引时，数据库先在有序 key 结构里比较，逐层缩小范围，定位到叶子节点附近，再根据指针取回目标行。",
      visualSpec: {
        kind: "animation",
        component: "access_path",
        description: "从根节点到分支节点，再到叶子 key，最后通过指针跳到数据行。",
        keyElements: ["根节点比较", "选择分支范围", "叶子 key 命中", "行指针跳转", "检查集合变小"],
        states: ["从根开始", "选择分支", "找到叶子范围", "取回行", "返回结果"],
      },
    },
    {
      id: "p06-query-path-visualizer",
      type: "interactive_model",
      title: "互动：选择查询条件，看访问路径",
      learningGoal: "预测查询是否能使用 email 索引。",
      narrative:
        "不同 WHERE 条件会触发不同访问路径。email 上的索引适合按 email 精确查找，但不会自动让所有条件都变快。",
      visualSpec: {
        kind: "flow",
        component: "access_path",
        description: "展示查询条件、可用索引、选择性和最终访问路径之间的关系。",
        keyElements: ["可用索引", "查询条件", "选择性", "访问路径", "反馈解释"],
      },
      interactionSpec: {
        kind: "query_path",
        learnerAction: "选择一个查询条件，然后判断它是否能使用 email 索引。",
        expectedObservation: "路径会在索引查找、全表扫描和有限收益之间变化。",
        cognitivePurpose: "建立规则：只有查询条件匹配索引 key，并且选择性足够好时，索引才真正有用。",
        options: [
          {
            id: "email",
            label: "WHERE email = 'sam@example.com'",
            resultTitle: "走索引查找",
            outcomeId: "index_lookup",
            resultTone: "success",
            explanation:
              "条件正好匹配 email 索引，数据库可以先搜索有序 key 结构，再取回对应行。",
          },
          {
            id: "created",
            label: "WHERE created_at > '2026-01-01'",
            resultTitle: "走全表扫描",
            outcomeId: "full_scan",
            resultTone: "neutral",
            explanation:
              "当前可用索引在 email 上，不在 created_at 上，所以这个条件没有合适的快捷路径。",
          },
          {
            id: "domain",
            label: "WHERE email LIKE '%@example.com'",
            resultTitle: "索引收益有限或不可用",
            outcomeId: "partial_index",
            resultTone: "warning",
            explanation:
              "前导通配符让有序索引很难从左侧前缀开始定位，因此不能像精确 email 查询那样直接缩小范围。",
          },
        ],
      },
      feedbackSpec: {
        correctFeedback:
          "这条路径和索引结构对齐，所以数据库能先缩小搜索空间，再访问表行。",
        incorrectFeedback:
          "关键是把查询条件和索引 key 对齐。某一列上的索引不会让无关条件自动可搜索。",
      },
    },
    {
      id: "p07-indexes-always-help",
      type: "misconception_check",
      title: "误区：索引是不是总能让查询更快？",
      learningGoal: "理解索引有收益，也有写入和存储成本。",
      narrative:
        "索引可能加速读查询，但每次插入、更新、删除都可能要维护索引。索引还占存储。低选择性、很少使用或写入很重的场景，索引可能是净成本。",
      visualSpec: {
        kind: "diagram",
        component: "tradeoff",
        description: "用天平图对比读查询收益、写入维护成本、存储成本和工作负载匹配度。",
        keyElements: ["读查询收益", "写入维护成本", "存储成本", "选择性", "工作负载比例"],
      },
      interactionSpec: {
        kind: "index_tradeoff",
        learnerAction: "在几个工作负载场景里判断是否应该添加索引。",
        expectedObservation: "有些场景收益明显，有些场景会被写入维护或低收益抵消。",
        cognitivePurpose: "把“索引越多越好”的简单规则替换成“按工作负载做权衡”。",
        options: [
          {
            id: "unique-email",
            label: "为高频唯一 email 查询添加索引",
            resultTitle: "通常值得",
            outcomeId: "good_tradeoff",
            resultTone: "success",
            explanation:
              "高频、选择性强的读查询通常能节省大量扫描工作，足以抵消维护和存储成本。",
          },
          {
            id: "tiny-report",
            label: "为小表上的偶发报表查询添加索引",
            resultTitle: "收益偏弱",
            outcomeId: "weak_read_savings",
            resultTone: "warning",
            explanation:
              "表很小或查询很少发生时，节省的读成本有限，可能不值得额外维护索引。",
          },
          {
            id: "write-heavy",
            label: "给写入很重的事件表添加很多索引",
            resultTitle: "风险较高",
            outcomeId: "write_heavy_cost",
            resultTone: "danger",
            explanation:
              "每次写入都要维护更多索引结构，写入密集型表可能因此明显变慢。",
          },
        ],
      },
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "下面哪种情况最不可能从新增索引中获得明显收益？",
        options: [
          "高频按唯一 email 查找",
          "小表上的偶发报表过滤",
          "高频按尚未索引的订单编号查找",
          "大表上的高选择性查询",
        ],
        correctAnswer: "小表上的偶发报表过滤",
      },
      feedbackSpec: {
        correctFeedback:
          "对。表小或查询很少发生时，节省的读工作可能不足以覆盖维护和存储成本。",
        incorrectFeedback:
          "索引不是免费的。判断时要看查询是否频繁、是否选择性强、是否足够昂贵。",
        misconceptionAddressed: "m01-indexes-always-help",
      },
    },
    {
      id: "p08-sql-walkthrough",
      type: "code_walkthrough",
      title: "SQL：把心智模型落到语句上",
      learningGoal: "把索引直觉连接到 CREATE INDEX 和复合索引顺序。",
      narrative:
        "CREATE INDEX 会为指定列建立搜索结构。复合索引的列顺序很重要，因为结构先按最左列排序，再按后续列继续组织。",
      visualSpec: {
        kind: "table",
        component: "access_path",
        description: "把 SQL 片段和可能的访问路径放在一起看。",
        keyElements: [
          "CREATE INDEX users_email_idx ON users(email)",
          "WHERE email = ?",
          "CREATE INDEX orders_user_status_idx ON orders(user_id, status)",
          "最左前缀",
        ],
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "如果有索引 (user_id, status)，哪个查询最可能有效使用索引的开头部分？",
        options: [
          "WHERE status = 'paid'",
          "WHERE user_id = 42",
          "WHERE created_at > '2026-01-01'",
          "WHERE total > 100",
        ],
        correctAnswer: "WHERE user_id = 42",
      },
      feedbackSpec: {
        correctFeedback:
          "正确。这个复合索引先按 user_id 排序，因此按 user_id 过滤能利用最左 key。",
        incorrectFeedback:
          "复合索引的顺序很关键。(user_id, status) 不等于单独的 status 索引。",
        misconceptionAddressed: "m02-any-index-helps-any-query",
      },
      code: {
        language: "sql",
        value: [
          "CREATE INDEX users_email_idx ON users(email);",
          "",
          "SELECT *",
          "FROM users",
          "WHERE email = 'sam@example.com';",
          "",
          "CREATE INDEX orders_user_status_idx ON orders(user_id, status);",
          "",
          "SELECT *",
          "FROM orders",
          "WHERE user_id = 42 AND status = 'paid';",
        ].join("\n"),
      },
    },
    {
      id: "p09-transfer-cache-lookup",
      type: "transfer_challenge",
      title: "迁移：在缓存系统里选择访问路径",
      learningGoal: "把索引思想迁移到相关系统设计问题。",
      narrative:
        "一个服务保存了数百万个缓存对象，经常需要按 customer_id 找出某个客户的全部对象。是否应该增加 customer_id 到对象列表的辅助查找结构？",
      visualSpec: {
        kind: "architecture",
        component: "tradeoff",
        description: "展示缓存对象、可选的 customer_id 二级查找表、读路径和写入维护成本。",
        keyElements: ["缓存对象", "customer_id", "二级查找表", "读路径", "写入维护"],
      },
      assessmentSpec: {
        kind: "transfer",
        prompt:
          "判断 customer_id 查找结构是否有帮助，并说明读查询收益、写入维护成本和存储成本。",
        correctAnswer:
          "如果按 customer_id 查询很频繁，并且每次能从大量对象中缩小到较小集合，它就有帮助；代价是对象新增、变更和删除时都要维护这张辅助结构，并占用额外存储。",
      },
      feedbackSpec: {
        correctFeedback:
          "迁移到位。同一个模型仍然成立：当重复、选择性强的访问能节省足够读成本时，维护额外访问路径才值得。",
        incorrectFeedback:
          "仍然问三个问题：访问路径是否匹配查询？是否缩小搜索空间？维护成本是否值得？",
      },
    },
    {
      id: "p10-summary",
      type: "summary_card",
      title: "总结：可迁移的索引心智模型",
      learningGoal: "把索引理解压缩成可以复用的判断规则。",
      narrative:
        "索引是额外维护的有序访问路径。它通过缩小搜索空间让某些读查询更快，但会带来写入维护和存储成本。真正的问题不是“索引有没有用”，而是“这个索引是否匹配这个工作负载”。",
      visualSpec: {
        kind: "diagram",
        component: "summary",
        description: "用四条规则压缩本课心智模型。",
        keyElements: ["全表扫描检查很多行", "索引先缩小范围", "选择性很关键", "写入要维护索引", "复合索引顺序重要"],
      },
    },
  ],
  misconceptions: [
    {
      id: "m01-indexes-always-help",
      statement: "索引总能让查询更快。",
      correction:
        "只有当索引匹配访问模式，并且减少的读工作足以覆盖存储和写入维护成本时，索引才真正有价值。",
    },
    {
      id: "m02-any-index-helps-any-query",
      statement: "任何索引都能帮助任何 WHERE 条件。",
      correction:
        "查询条件必须和被索引的 key 或复合索引的最左部分对齐。",
    },
    {
      id: "m03-index-removes-row-access",
      statement: "有索引就完全不需要读取表行。",
      correction:
        "很多索引只是先定位行位置；如果查询需要更多列，数据库仍可能回表读取完整行。",
    },
  ],
  transferTasks: [
    {
      id: "t01-cache-customer-lookup",
      prompt:
        "缓存系统有数百万对象，并且高频按 customer_id 查询。判断是否要添加二级查找结构，并解释权衡。",
      targetMentalModel:
        "当重复、选择性强的查找节省的读成本超过写入维护和存储成本时，维护额外访问路径是合理的。",
    },
  ],
  summary: [
    "全表扫描慢，是因为没有快捷路径，只能检查大量候选行。",
    "索引是围绕特定 key 额外维护的有序访问路径。",
    "有用的索引会在访问表行之前先缩小搜索空间。",
    "索引是否有用取决于选择性，以及查询条件是否和索引 key 对齐。",
    "复合索引顺序重要，因为结构先按最左 key 排序。",
    "索引用读性能换取写入维护成本和存储成本。",
  ],
} satisfies Lesson;
