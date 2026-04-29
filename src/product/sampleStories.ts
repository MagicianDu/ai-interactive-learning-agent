export const sampleStories = [
  {
    id: "book",
    sourceKind: "book",
    sourceType: "书籍",
    title: "一本技术书 -> 总览课 + topic 课程包",
    promise: "适合快速建立系统心智模型。",
    examplePrompt: "请用这本书生成中文课程包：先做总览课，再按核心 topic 拆课。"
  },
  {
    id: "paper",
    sourceKind: "paper",
    sourceType: "论文",
    title: "一篇论文 -> 方法解释 + 复现实验路径",
    promise: "适合理解论文贡献、方法边界和实验逻辑。",
    examplePrompt: "请用这篇论文生成中文学习材料，重点解释方法、实验和局限。"
  },
  {
    id: "patent",
    sourceKind: "patent",
    sourceType: "专利",
    title: "一份专利 -> 权利要求地图 + 技术方案课",
    promise: "适合理解 claims、实施例和技术差异。",
    examplePrompt: "请用这份专利生成中文学习材料，保留权利要求和实施例映射。"
  }
] as const;

export type SampleStory = (typeof sampleStories)[number];
