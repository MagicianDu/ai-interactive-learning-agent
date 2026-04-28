import type { Lesson } from "../../schemas/lesson.schema";

export const generatedLesson = {
  id: "hash-table-foundations",
  title: "哈希表：为什么能快速找到数据",
  audience: "有基础编程经验但没建立数据结构心智模型的中文学习者",
  config: {
    targetPageCount: 8,
    minPageCount: 6,
    maxPageCount: 10
  },
  prerequisites: [
    "知道数组可以通过下标访问元素",
    "知道 Map、dict 或对象可以用 key 查 value",
    "理解循环遍历意味着逐个检查"
  ],
  learningObjectives: [
    "解释哈希表为什么通常比线性查找更快",
    "画出 key 到 bucket 再到 value 的查找路径",
    "解释冲突、负载因子和扩容如何影响性能",
    "判断缓存 key 或查找场景是否适合用哈希表思路"
  ],
  pages: [
    {
      id: "p01-problem",
      type: "problem_scene",
      title: "为什么别再从头找",
      learningGoal: "感受线性查找的成本，并形成“缩小搜索范围”的需求。",
      narrative: "你有 10 万个用户对象，只知道 userId。最直接的办法是从第一条开始比较，但数据越多，等待越久。哈希表要解决的不是“让数据消失”，而是让查找从“看很多个”变成“先去一个很小的候选位置”。",
      visualSpec: {
        kind: "diagram",
        description: "左侧展示线性扫描的长列表，右侧展示按 key 先跳到候选位置的路径。",
        keyElements: [
          "10 万条用户记录",
          "目标 userId",
          "线性扫描路径",
          "直接定位候选位置",
          "检查数量对比"
        ]
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "如果目标用户刚好在 10 万条列表最后，线性查找最坏要比较多少次？",
        options: [
          "1 次",
          "约 10 次",
          "10 万次",
          "不用比较"
        ],
        correctAnswer: "10 万次"
      },
      feedbackSpec: {
        correctFeedback: "对。线性查找最坏情况下要一路比较到最后，这正是哈希表要避免的搜索范围。",
        incorrectFeedback: "这里还没有任何索引结构，程序只能逐条确认 key。最坏情况下目标在最后，需要比较 10 万次。"
      }
    },
    {
      id: "p02-intuition",
      type: "intuition_visual",
      title: "把名字变成柜子编号",
      learningGoal: "建立 key 先变成位置的直觉。",
      narrative: "想象每个人的名字都能通过一个规则算出柜子编号。找人时，你不用看完整名单，而是先去对应柜子。哈希函数就像这个规则：它把 key 转换成一个可以访问的数组位置。",
      visualSpec: {
        kind: "flow",
        description: "key 卡片经过哈希规则机器，输出桶编号，再进入对应桶。",
        keyElements: [
          "key: alice",
          "hash(key)",
          "桶编号",
          "候选桶",
          "value"
        ],
        states: [
          "输入 key",
          "计算 hash",
          "定位 bucket",
          "读取候选项"
        ]
      }
    },
    {
      id: "p03-structure",
      type: "structure_diagram",
      title: "数组、桶和值怎么连起来",
      learningGoal: "看清哈希表的内部结构，而不是只记住 API。",
      narrative: "哈希表底层通常有一个数组。数组的每个位置可以理解为一个桶。桶里保存 entry，每个 entry 包含 key 和 value。查找时先用 key 算桶，再在桶里确认具体 key。",
      visualSpec: {
        kind: "architecture",
        description: "展示 bucket array、bucket index、entry 链和 key/value 的关系。",
        keyElements: [
          "bucket array",
          "bucket index",
          "entry",
          "key",
          "value",
          "next entry"
        ]
      },
      code: {
        language: "ts",
        value: "type Entry = { key: string; value: User; next?: Entry };\nconst buckets: Array<Entry | undefined> = new Array(8);"
      }
    },
    {
      id: "p04-process",
      type: "process_animation",
      title: "一次查找的完整路径",
      learningGoal: "把哈希表查找拆成可执行步骤。",
      narrative: "一次查找不是“神奇地直接出现”。它通常经历四步：计算 hash，用容量取模得到桶下标，进入桶，逐个比较 key，直到找到目标 value。",
      visualSpec: {
        kind: "timeline",
        description: "按时间线展示 hash、取模、进入桶、比较 key、返回 value。",
        keyElements: [
          "hash(key)",
          "hash % capacity",
          "bucket[index]",
          "compare key",
          "return value"
        ],
        states: [
          "计算",
          "定位",
          "确认",
          "返回"
        ]
      },
      interactionSpec: {
        kind: "stepper",
        learnerAction: "逐步执行一次 key='cat' 的查找路径。",
        expectedObservation: "先缩小到一个桶，再在桶内确认 key。",
        cognitivePurpose: "让学习者理解快来自候选范围变小，而不是省略 key 比较。"
      },
      assessmentSpec: {
        kind: "prediction",
        prompt: "hash('cat') = 17，bucket 数量是 8。应该先去哪个桶？",
        options: [
          "桶 0",
          "桶 1",
          "桶 7",
          "所有桶"
        ],
        correctAnswer: "桶 1"
      },
      feedbackSpec: {
        correctFeedback: "对。17 % 8 = 1，所以先进入桶 1。",
        incorrectFeedback: "先做取模：17 % 8 = 1。哈希表不会先看所有桶。"
      }
    },
    {
      id: "p05-collision",
      type: "interactive_model",
      title: "冲突不是错误，是常态",
      learningGoal: "理解不同 key 可能进入同一桶，以及冲突如何增加局部查找成本。",
      narrative: "哈希函数的输出空间有限，桶数量也有限。两个不同 key 落入同一桶很正常。哈希表需要冲突处理策略，例如链地址法：同一桶里挂一串 entry，查找时沿着这串继续比较 key。",
      visualSpec: {
        kind: "diagram",
        description: "多个 key 指向同一个 bucket，bucket 内形成 entry 链。",
        keyElements: [
          "key: cat",
          "key: dog",
          "bucket 1",
          "entry chain",
          "查找步数"
        ]
      },
      interactionSpec: {
        kind: "prediction",
        learnerAction: "选择一个 key，先预测它会落入哪个桶，再观察是否冲突。",
        expectedObservation: "不同 key 可能落入同一桶，桶内比较次数随链变长增加。",
        cognitivePurpose: "修正“哈希函数给每个 key 唯一位置”的误解。"
      },
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "两个不同 key 落入同一个桶，最合理的解释是什么？",
        options: [
          "哈希表坏了",
          "哈希函数输出空间有限，冲突正常",
          "这两个 key 必须相等",
          "数组下标访问不再可用"
        ],
        correctAnswer: "哈希函数输出空间有限，冲突正常"
      },
      feedbackSpec: {
        correctFeedback: "对。冲突是正常现象，关键是冲突处理策略能否让桶内路径保持可控。",
        incorrectFeedback: "冲突不代表哈希表坏了。有限桶里放很多 key，落到同一桶是必然可能发生的。"
      }
    },
    {
      id: "p06-load-factor",
      type: "interactive_model",
      title: "桶太挤，速度就会掉",
      learningGoal: "用负载因子解释为什么哈希表需要扩容。",
      narrative: "负载因子可以粗略理解为元素数量 / 桶数量。元素越来越多但桶不变时，桶会变挤，冲突更多，桶内比较路径更长。扩容和 rehash 是一次较贵的整理，用来换取后续更短的平均路径。",
      visualSpec: {
        kind: "graph",
        description: "显示负载因子升高时冲突数量和平均查找步数上升，扩容后下降。",
        keyElements: [
          "元素数量",
          "桶数量",
          "负载因子",
          "平均查找步数",
          "扩容阈值"
        ]
      },
      interactionSpec: {
        kind: "parameter_experiment",
        learnerAction: "调整元素数量和桶数量，观察负载因子与平均查找步数。",
        expectedObservation: "负载因子升高时桶更拥挤；扩容后冲突减少。",
        cognitivePurpose: "把空间、冲突概率和时间成本联系起来。"
      },
      assessmentSpec: {
        kind: "multiple_choice",
        prompt: "为什么哈希表通常会在还没完全装满时扩容？",
        options: [
          "因为数组不能存任何冲突",
          "为了降低负载因子，减少平均查找路径",
          "为了让 key 变短",
          "为了删除旧数据"
        ],
        correctAnswer: "为了降低负载因子，减少平均查找路径"
      },
      feedbackSpec: {
        correctFeedback: "对。扩容的核心是控制拥挤程度，让后续查找和插入保持较短路径。",
        incorrectFeedback: "扩容不是因为不能发生冲突，而是因为冲突太多会让平均路径变长。"
      }
    },
    {
      id: "p07-misconception",
      type: "misconception_check",
      title: "哈希表永远 O(1) 吗",
      learningGoal: "区分平均情况和最坏情况，形成准确性能判断。",
      narrative: "“哈希表查找是 O(1)”是常见简化说法，但它依赖前提：哈希分布足够均匀、负载因子受控、冲突处理有效。如果所有 key 都挤在同一个桶，查找就会退化成在桶内逐个比较。",
      visualSpec: {
        kind: "diagram",
        description: "对比均匀分布和极端冲突分布下的桶结构。",
        keyElements: [
          "均匀分布",
          "热点桶",
          "平均路径",
          "最坏路径",
          "复杂度前提"
        ]
      },
      assessmentSpec: {
        kind: "true_false",
        prompt: "“哈希表查找永远是 O(1)，所以不用关心哈希函数和冲突。”这句话可靠。",
        options: [
          "true",
          "false"
        ],
        correctAnswer: "false"
      },
      feedbackSpec: {
        correctFeedback: "对。平均 O(1) 不是无条件承诺，冲突严重时路径会变长。",
        incorrectFeedback: "这句话过度简化了。哈希函数、负载因子和冲突处理都会影响实际查找路径。",
        misconceptionAddressed: "哈希表查找永远是 O(1)"
      }
    },
    {
      id: "p08-transfer-summary",
      type: "summary_card",
      title: "把模型迁移到缓存 key",
      learningGoal: "把哈希表心智模型迁移到工程设计，并形成可回忆总结。",
      narrative: "当你设计缓存 key、路由表或去重集合时，都在做类似选择：如何把真实问题中的标识映射到可快速定位的位置。好的 key 要有足够区分度，避免大量请求挤到少数位置。",
      visualSpec: {
        kind: "flow",
        description: "缓存请求经过 key 设计进入分布位置，再反馈热点风险。",
        keyElements: [
          "请求",
          "cache key",
          "hash",
          "分布",
          "热点冲突",
          "总结规则"
        ]
      },
      assessmentSpec: {
        kind: "transfer",
        prompt: "你要设计一个缓存 key。方案 A 只用城市名，方案 B 使用 city:userId:day。哪个更可能减少热点冲突？为什么？",
        options: [
          "方案 A",
          "方案 B",
          "两者完全一样"
        ],
        correctAnswer: "方案 B"
      },
      feedbackSpec: {
        correctFeedback: "通常方案 B 更好，因为它包含更多区分度，更可能把请求分散到不同位置。",
        incorrectFeedback: "只用城市名会让同城请求集中到少数 key。更有区分度的 key 往往能减少热点，但仍要符合查询需求。"
      }
    }
  ],
  misconceptions: [
    {
      id: "hash-table-always-o1",
      statement: "哈希表查找永远是 O(1)",
      correction: "平均情况下接近 O(1)，但严重冲突、差哈希函数或过高负载会让路径变长。"
    },
    {
      id: "hash-function-unique",
      statement: "哈希函数会给每个 key 唯一位置",
      correction: "不同 key 可能映射到同一桶，所以需要冲突处理。"
    },
    {
      id: "collision-is-error",
      statement: "冲突说明哈希表坏了",
      correction: "冲突是正常现象。关键是分布、负载和处理策略是否让路径保持短。"
    }
  ],
  transferTasks: [
    {
      id: "cache-key-design",
      prompt: "为缓存用户每日统计结果设计 key，并说明如何避免大量请求挤到同一个 key。",
      targetMentalModel: "用 key 的区分度控制分布，用负载和冲突视角判断性能风险。"
    }
  ],
  summary: [
    "哈希表用哈希函数把 key 映射到桶，从而缩小候选范围。",
    "进入桶后仍要比较 key，因为冲突是正常现象。",
    "负载因子越高，桶越拥挤，平均查找路径越可能变长。",
    "扩容和 rehash 用一次较大成本换取后续更短路径。",
    "平均 O(1) 是有前提的工程判断，不是无条件承诺。"
  ]
} satisfies Lesson;
