import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { LearningAgentRuntimeTools } from "../tools/mcp-server/runtime-tools.js";

type BoardEmphasis = "definition" | "mechanism" | "example" | "boundary" | "note";

type BoardSection = {
  label: string;
  emphasis: BoardEmphasis;
  items: string[];
};

type ChapterMeta = {
  number: number;
  title: string;
  englishTitle: string;
  part: string;
  role: string;
  coreQuestion: string;
  centralMove: string;
  keyTerms: string[];
  formulas: string[];
  practiceLens: string;
  boundary: string;
  carryForward: string;
};

type UnitPage = {
  title: string;
  narrative: string;
  headline: string;
  core: string;
  left: BoardSection[];
  right: BoardSection[];
  bottomLine: string;
};

const runId = "active-portfolio-book-full-chapters-v1";
const sourcePdf = "/Users/dm/Documents/1.书籍资料/BOOKS/主动投资组合管理：创造高收益并控制风险的量化投资方法 原书第2版(高清).pdf";
const fullTextPath = "runs/active-portfolio-book-full-source/full.txt";
const normalizedSourceDir = "runs/active-portfolio-book-full-normalized-source";

const chapterStartLines = [
  603, 934, 2161, 4093, 5066, 6658, 7619, 8595, 9710, 11085, 12455, 13378, 14713, 15783, 17591, 18388, 19642, 21039,
  22009, 22759, 23232, 23474
];

const chapters: ChapterMeta[] = [
  {
    number: 1,
    title: "绪论",
    englishTitle: "Introduction",
    part: "基础理论",
    role: "把主动管理从个人直觉改写成可组织、可复盘、可制度化的投资流程。",
    coreQuestion: "主动管理为什么不能只靠选股天赋，而必须成为一套流程技术？",
    centralMove: "用基准、主动偏离、风险承载和流程分工，替代英雄式投资叙事。",
    keyTerms: ["主动管理", "基准", "流程", "信息", "附加值"],
    formulas: ["主动价值 = 可解释偏离 × 风险承载纪律"],
    practiceLens: "读任何策略说明时，先问它是否能落入研究、风险、组合和复盘四个环节。",
    boundary: "如果收益只能事后讲故事，不能说明偏离基准的机制，就不应被记为主动管理能力。",
    carryForward: "后续章节会把这条流程拆成收益起点、风险模型、信息比率和组合实现。"
  },
  {
    number: 2,
    title: "一致预期收益：资本资产定价模型",
    englishTitle: "Consensus Expected Returns: The Capital Asset Pricing Model",
    part: "基础理论",
    role: "给主动偏离建立共同参照面，让 alpha 不再是无起点的主观判断。",
    coreQuestion: "在宣称超额收益之前，市场共同起点是什么？",
    centralMove: "先用 CAPM 或一致预期收益定义可辩论的收益坐标，再讨论主动偏离。",
    keyTerms: ["一致预期收益", "CAPM", "beta", "市场组合", "alpha"],
    formulas: ["E(r_n) = beta_n × E(r_M)", "alpha = 个人预期收益 - 一致预期收益"],
    practiceLens: "把任何“我看好”重写为：相对共同起点偏离多少、证据是什么、风险由谁承担。",
    boundary: "一致收益只让偏离可识别，不保证偏离正确。",
    carryForward: "风险模型和组合构建都要围绕这个偏离对象工作。"
  },
  {
    number: 3,
    title: "风险模型",
    englishTitle: "Risk",
    part: "基础理论",
    role: "把风险从单一波动率改写成可拆解的暴露结构。",
    coreQuestion: "组合到底在承担哪些风险，而不是表面上波动多少？",
    centralMove: "用协方差、因子暴露和残差风险，把收益波动拆成可归因来源。",
    keyTerms: ["协方差矩阵", "因子风险", "特异风险", "残差风险", "主动风险"],
    formulas: ["V = XFX' + Δ", "active risk = 偏离基准头寸的风险"],
    practiceLens: "看一个组合时，不先问收益高低，先问暴露来自共同因子还是特异判断。",
    boundary: "风险模型不是风险真相，只是把可观察结构压缩成可操作语言。",
    carryForward: "后续附加值、信息比率和组合优化都依赖风险模型给出的承载边界。"
  },
  {
    number: 4,
    title: "非凡收益、业绩基准和附加值",
    englishTitle: "Exceptional Return, Benchmarks, and Value Added",
    part: "基础理论",
    role: "把收益评价改写成相对基准、相对风险的附加值问题。",
    coreQuestion: "一个经理创造了价值，还是只是承担了不同的基准风险？",
    centralMove: "用基准、主动收益和风险惩罚，将绩效评价从绝对收益转成附加值目标。",
    keyTerms: ["非凡收益", "业绩基准", "附加值", "主动风险", "目标函数"],
    formulas: ["value added ≈ active return - 风险惩罚", "IR = active return / active risk"],
    practiceLens: "评价策略时，把收益拆成基准贡献、主动偏离和风险成本。",
    boundary: "没有合适基准时，附加值会被市场方向或风格暴露污染。",
    carryForward: "第5章会进一步把残差收益和残差风险压成信息比率语言。"
  },
  {
    number: 5,
    title: "残差风险和残差收益：信息比率",
    englishTitle: "Residual Risk and Residual Return: The Information Ratio",
    part: "基础理论",
    role: "用信息比率把主动能力压成单位主动风险能产生多少残差收益。",
    coreQuestion: "给定承担的主动风险，研究判断到底有多有效？",
    centralMove: "把残差收益、残差风险和机会集统一到信息比率框架。",
    keyTerms: ["残差收益", "残差风险", "信息比率", "机会集", "风险厌恶"],
    formulas: ["IR = residual return / residual risk", "alpha score = alpha / omega"],
    practiceLens: "比较两个策略时，不只比 alpha，还要比每单位残差风险的产出。",
    boundary: "高 alpha 如果靠巨大未识别风险换来，信息比率未必高。",
    carryForward: "第6章会说明信息比率由 skill 和 breadth 共同决定。"
  },
  {
    number: 6,
    title: "主动管理的基本定律",
    englishTitle: "The Fundamental Law of Active Management",
    part: "基础理论",
    role: "把主动管理能力拆成预测能力和独立下注次数。",
    coreQuestion: "长期信息比率来自少数大判断，还是大量小优势的重复下注？",
    centralMove: "用 IC 和 breadth 解释主动管理规模化的核心条件。",
    keyTerms: ["信息系数", "广度", "独立赌注", "信息比率", "传递系数"],
    formulas: ["IR ≈ IC × sqrt(BR)", "value added ∝ IR²"],
    practiceLens: "设计研究流程时，既要问信号有多准，也要问每年能独立复用多少次。",
    boundary: "名义上很多交易不等于 breadth；高度相关的判断不能重复计数。",
    carryForward: "第二部分会讨论这些预测优势可以从哪里来。"
  },
  {
    number: 7,
    title: "预期收益和套利定价理论",
    englishTitle: "Expected Returns and Arbitrage Pricing Theory",
    part: "预期收益和估值",
    role: "把预期收益放进多因子定价语言，说明系统性收益从哪些共同风险或错价中来。",
    coreQuestion: "除了市场 beta，还有哪些共同因子能解释或组织预期收益？",
    centralMove: "用 APT 和因子组合把收益预测从单资产直觉扩展到结构化风险源。",
    keyTerms: ["APT", "因子收益", "因子暴露", "特征组合", "套利"],
    formulas: ["r = Xf + u", "expected return = factor exposure × factor premia"],
    practiceLens: "看一个 alpha 时，先扣除它其实来自哪些已知因子。",
    boundary: "因子解释不是免费 alpha；被共同因子解释的部分通常不该冒充选股能力。",
    carryForward: "第8-9章会从估值角度讨论预期收益的经济来源。"
  },
  {
    number: 8,
    title: "估值理论",
    englishTitle: "Valuation in Theory",
    part: "预期收益和估值",
    role: "从理论上说明资产价值如何来自未来现金流、状态价格和折现关系。",
    coreQuestion: "资产价格为什么能被看成未来收益的折现表达？",
    centralMove: "把估值写成跨状态、跨时间的现金流定价问题，而不是静态倍数比较。",
    keyTerms: ["折现", "状态价格", "现金流", "无套利", "终值"],
    formulas: ["price = expected discounted cash flows", "return links price and future payoff"],
    practiceLens: "做估值判断时，分清你是在改现金流、改折现率，还是改终值假设。",
    boundary: "理论估值提供坐标，不会自动解决输入变量不确定性。",
    carryForward: "第9章会把理论估值落到实际信号与模型中。"
  },
  {
    number: 9,
    title: "估值实践",
    englishTitle: "Valuation in Practice",
    part: "预期收益和估值",
    role: "把估值理论转成可用于预测的实际变量和信号。",
    coreQuestion: "如何从财务数据和市场价格中构造有用的收益预测？",
    centralMove: "用盈利、增长、账面价值、现金流和相对估值，把错价判断转成预测输入。",
    keyTerms: ["价值信号", "增长", "盈利", "相对估值", "错误定价"],
    formulas: ["expected return ≈ 收益率修正 + 估值回归", "value signal = price 与 fundamentals 的偏离"],
    practiceLens: "评估一个价值信号时，问它反映的是便宜、质量、增长，还是会计噪声。",
    boundary: "便宜本身不是 alpha；必须说明市场为什么会修正以及何时可能不修正。",
    carryForward: "第三部分会讨论如何把这些原始信号加工成可用预测。"
  },
  {
    number: 10,
    title: "预测基础",
    englishTitle: "Forecasting Basics",
    part: "信息处理",
    role: "把原始信号转换成标准化预测，并度量预测能力。",
    coreQuestion: "一个信号怎样从观察值变成可进入组合的 alpha？",
    centralMove: "用标准分、IC、波动率和 alpha 转换，把信号从描述变量变成收益预测。",
    keyTerms: ["预测", "标准分", "IC", "alpha", "波动率"],
    formulas: ["alpha ≈ IC × score × volatility", "forecast = signal normalized by noise"],
    practiceLens: "看到一个信号，先估计它的相关性、尺度和噪声，再谈头寸。",
    boundary: "样本内相关不等于真实预测能力，必须考虑估计误差和稳定性。",
    carryForward: "第11章会处理多信号、多资产和更复杂的预测合成。"
  },
  {
    number: 11,
    title: "高级预测",
    englishTitle: "Advanced Forecasting",
    part: "信息处理",
    role: "处理多个预测来源、多个资产和不确定预测能力之间的组合问题。",
    coreQuestion: "多个信号同时存在时，怎样合成而不是重复计算同一信息？",
    centralMove: "用相关矩阵、信号协方差和贝叶斯/收缩思想，把多源预测压成稳健 alpha。",
    keyTerms: ["多信号合成", "相关矩阵", "收缩", "贝叶斯更新", "预测不确定性"],
    formulas: ["combined forecast ∝ ρ⁻¹ × signal vector", "shrink noisy alpha toward zero"],
    practiceLens: "合成信号时，先问信息是否独立，再决定权重。",
    boundary: "信号多不代表信息多；相关信号会放大过度自信。",
    carryForward: "第12章会进一步评估信号中到底有多少信息。"
  },
  {
    number: 12,
    title: "信息分析",
    englishTitle: "Information Analysis",
    part: "信息处理",
    role: "评估信号质量，区分真实信息、统计噪声和数据挖掘幻觉。",
    coreQuestion: "一个信号到底有多少可用信息，还是只是样本巧合？",
    centralMove: "用分组收益、t 统计、IC 稳定性和信息衰减评估预测质量。",
    keyTerms: ["信息含量", "分组收益", "t统计", "IC稳定性", "数据挖掘"],
    formulas: ["t-stat ≈ effect / standard error", "IC stability matters more than one high observation"],
    practiceLens: "看研究结果时，先检查样本外、分组单调性和经济解释。",
    boundary: "统计显著不等于可交易；交易成本和拥挤会吞掉信息。",
    carryForward: "第13章会处理信息在时间上的持续和衰减。"
  },
  {
    number: 13,
    title: "信息时间尺度",
    englishTitle: "The Information Horizon",
    part: "信息处理",
    role: "把信号从单点预测扩展到随时间衰减、更新和重平衡的动态过程。",
    coreQuestion: "一个信号的有效期有多长，应该多久更新一次组合？",
    centralMove: "用衰减、半衰期和跨期相关，决定信号持有期和再平衡节奏。",
    keyTerms: ["信息期限", "半衰期", "信号衰减", "再平衡", "跨期相关"],
    formulas: ["signal_t+1 = decay × signal_t + new information", "turnover trades off freshness and cost"],
    practiceLens: "为每个信号定义预测 horizon，而不是所有 alpha 都按同一频率交易。",
    boundary: "过快交易会被成本吞掉，过慢更新会持有过期信息。",
    carryForward: "第四部分会把预测、成本和组合约束合在一起落地。"
  },
  {
    number: 14,
    title: "组合构建",
    englishTitle: "Portfolio Construction",
    part: "实施",
    role: "把 alpha、风险模型和约束转成实际持仓。",
    coreQuestion: "给定预测和风险，应该持有哪些头寸、持有多少？",
    centralMove: "用优化目标把预期残差收益、风险惩罚和约束统一成持仓决策。",
    keyTerms: ["优化", "头寸", "约束", "风险预算", "主动权重"],
    formulas: ["maximize alpha'h - λ h'Vh", "optimal holding ∝ V⁻¹ alpha"],
    practiceLens: "检查优化结果时，问每个大头寸来自 alpha、风险低估还是约束漏洞。",
    boundary: "优化器会放大输入错误；坏 alpha 和坏风险模型会被更高效地犯错。",
    carryForward: "第15章会讨论多空约束放松后组合语言如何改变。"
  },
  {
    number: 15,
    title: "多空投资",
    englishTitle: "Long-Short Investing",
    part: "实施",
    role: "说明放开做空与杠杆后，主动判断可以更直接地表达为相对头寸。",
    coreQuestion: "多空结构为什么能提高主动管理的信息利用效率？",
    centralMove: "把收益判断从只能超配/低配，扩展为可正可负的残差头寸。",
    keyTerms: ["多空组合", "市场中性", "杠杆", "空头约束", "残差头寸"],
    formulas: ["long-short portfolio isolates alpha", "gross exposure differs from net exposure"],
    practiceLens: "看多空策略时，分清净敞口、总敞口和因子中性。",
    boundary: "做空不是免费表达；借券、挤仓、成本和风控都会改变理论优势。",
    carryForward: "第16章会把交易成本和换手引入组合实现。"
  },
  {
    number: 16,
    title: "交易成本、换手和交易",
    englishTitle: "Transaction Costs, Turnover, and Trading",
    part: "实施",
    role: "把理论最优头寸放回真实市场摩擦中。",
    coreQuestion: "一个 alpha 值得交易吗，还是会被成本吃掉？",
    centralMove: "用成本、冲击、换手和再平衡阈值，决定从当前组合到目标组合的路径。",
    keyTerms: ["交易成本", "换手", "市场冲击", "买卖价差", "再平衡"],
    formulas: ["net alpha = alpha - transaction cost", "trade only when benefit exceeds cost"],
    practiceLens: "每次调仓都问：信息变新了多少，成本增加了多少。",
    boundary: "忽略成本会把短周期信号伪装成高价值 alpha。",
    carryForward: "第17章会在结果出来后回看绩效究竟来自哪里。"
  },
  {
    number: 17,
    title: "绩效分析",
    englishTitle: "Performance Analysis",
    part: "实施",
    role: "把已经发生的收益拆回预测、风险、成本和运气。",
    coreQuestion: "组合表现好坏，到底是能力、暴露、成本还是偶然？",
    centralMove: "用归因、实现 alpha、实现风险和信息比率，复盘主动管理流程。",
    keyTerms: ["绩效归因", "实现 alpha", "实现风险", "归因", "运气与能力"],
    formulas: ["realized IR = realized active return / realized active risk", "performance = forecast + exposure + cost + noise"],
    practiceLens: "复盘时不要只看收益，必须定位是哪一环贡献或拖累。",
    boundary: "短期好业绩可能来自未识别风险，短期差业绩也未必否定信号。",
    carryForward: "第18-19章会把主动管理拓展到资产配置和基准选择。"
  },
  {
    number: 18,
    title: "资产配置",
    englishTitle: "Asset Allocation",
    part: "实施",
    role: "把主动管理框架从证券选择扩展到资产类别层面的风险和收益权衡。",
    coreQuestion: "资产配置中的主动判断如何与基准、风险预算和长期目标相连？",
    centralMove: "用战略配置、战术偏离和风险预算，把大类资产决策纳入主动管理语言。",
    keyTerms: ["战略资产配置", "战术配置", "风险预算", "负债", "跨资产相关"],
    formulas: ["portfolio risk depends on asset-class covariance", "active allocation = allocation - benchmark"],
    practiceLens: "看资产配置建议时，区分长期政策组合和短期主动偏离。",
    boundary: "资产配置容易把宏观叙事误当 alpha，必须回到风险预算和基准偏离。",
    carryForward: "第19章继续追问基准本身是否可以主动择时。"
  },
  {
    number: 19,
    title: "基准择时",
    englishTitle: "Benchmark Timing",
    part: "实施",
    role: "讨论主动调整相对基准 beta 或风格暴露的收益和风险。",
    coreQuestion: "什么时候应该偏离基准本身，而不是只在基准内部选证券？",
    centralMove: "把基准择时看成一种主动 beta 决策，需要独立预测能力和风险预算。",
    keyTerms: ["基准择时", "主动 beta", "风格暴露", "市场择时", "政策组合"],
    formulas: ["active beta contributes benchmark timing risk", "timing value depends on forecast skill"],
    practiceLens: "评估基准择时时，问预测频率、预测准确率和可承受回撤是否匹配。",
    boundary: "基准择时 breadth 通常低、风险大，不能轻易当作稳定 alpha 来源。",
    carryForward: "第20章用历史证据检验主动管理能否长期实现这些目标。"
  },
  {
    number: 20,
    title: "主动管理的历史绩效",
    englishTitle: "The Historical Record of Active Management",
    part: "实施",
    role: "用历史证据检验主动管理是否真的创造了可持续附加值。",
    coreQuestion: "历史上主动管理者是否表现出可识别、可持续的能力？",
    centralMove: "把基金和经理业绩放进信息比率、持久性、幸存者偏差和选择问题中检验。",
    keyTerms: ["历史绩效", "持久性", "幸存者偏差", "经理选择", "能力识别"],
    formulas: ["observed performance = skill + luck + exposure + fees", "persistence tests require clean samples"],
    practiceLens: "看历史排名时，先校正样本选择、费用和风险暴露。",
    boundary: "历史好业绩不是自动可复制能力，尤其在样本短、经理多、噪声大的环境中。",
    carryForward: "第21章承认仍有许多流程和研究问题没有被解决。"
  },
  {
    number: 21,
    title: "开放问题",
    englishTitle: "Open Questions",
    part: "总结与边界",
    role: "标出主动组合管理理论尚未完全解决的研究前沿。",
    coreQuestion: "这套框架在哪些地方仍然过于静态、简化或未完成？",
    centralMove: "把动态模型、交易成本、负债、非线性、税后投资和行为金融列为开放边界。",
    keyTerms: ["动态模型", "交易成本", "负债", "非线性", "行为金融"],
    formulas: ["static optimum is not enough when alpha, risk, and cost evolve over time"],
    practiceLens: "读到模型结论时，主动问它忽略了哪些动态条件。",
    boundary: "承认开放问题不是削弱框架，而是避免把静态模型误用成完整现实。",
    carryForward: "第22章会把全书重新压缩成主动管理的核心工作流。"
  },
  {
    number: 22,
    title: "总结：主动管理流程",
    englishTitle: "Summary: The Active Management Process",
    part: "总结与边界",
    role: "把全书压缩成从高质量信息到组合、交易和复盘的完整闭环。",
    coreQuestion: "读完全书后，主动管理最小可迁移框架是什么？",
    centralMove: "把基准、收益预测、风险模型、信息比率、组合实现和绩效复盘合成一条流程。",
    keyTerms: ["主动管理流程", "高质量信息", "信息比率", "组合实现", "复盘"],
    formulas: ["information -> forecast -> portfolio -> trade -> performance review"],
    practiceLens: "用这条闭环审查任何量化投资团队或策略。",
    boundary: "数学不能补足没有信息的策略；流程只能放大真实信息，不能凭空制造 alpha。",
    carryForward: "完整学习结束后，应能把任何策略放入这条流程并指出最薄弱环节。"
  }
];

async function main(): Promise<void> {
  const fullText = await readFile(fullTextPath, "utf8");
  await writeNormalizedChapterSources(fullText);

  const tools = new LearningAgentRuntimeTools(process.cwd());
  const coursePack = {
    id: runId,
    title: "主动投资组合管理：22章完整自学 Web Deck",
    parentRunId: runId,
    sourceKind: "book",
    strategy: "chapter_guided",
    audience: "有金融工程或量化投资基础、希望系统掌握主动组合管理框架的中文研究生/从业者",
    language: "zh-CN",
    sourcePath: sourcePdf,
    units: chapters.map((chapter) => ({
      unitId: chapterUnitId(chapter),
      title: `第${chapter.number}章：${chapter.title}`,
      kind: "chapter",
      lessonId: lessonIdForChapter(chapter),
      targetPageCount: 12,
      sourceAnchorIds: sourceAnchorIdsForChapter(chapter),
      chapterRefs: [`第${chapter.number}章-${chapter.title}`],
      conceptIds: chapter.keyTerms.map((term, index) => `chapter-${String(chapter.number).padStart(2, "0")}-concept-${index + 1}`)
    }))
  };

  const lessons = chapters.map((chapter) => buildLesson(chapter));
  const publishResult = await tools.callTool("learning_agent.publish_learning_course", {
    runId,
    coursePack,
    lessons,
    publishNotes: "按全书 22 个章节发布《主动投资组合管理》完整章节化自学 Web Deck：每章 12 页。"
  });
  const manifestResult = await tools.callTool("learning_agent.create_imagegen_manifest", { runId });

  process.stdout.write(`${JSON.stringify({ publishResult, manifestResult }, null, 2)}\n`);
}

async function writeNormalizedChapterSources(fullText: string): Promise<void> {
  await mkdir(normalizedSourceDir, { recursive: true });
  const lines = fullText.split(/\r?\n/u);
  const starts = chapterStartLines.map((line) => Math.max(line - 1, 0));
  for (const chapter of chapters) {
    const index = chapter.number - 1;
    const start = starts[index] ?? 0;
    const end = starts[index + 1] ?? lines.length;
    const raw = lines.slice(start, end).join("\n");
    const cleaned = cleanExtractedChapterText(raw);
    const filename = `第${String(chapter.number).padStart(2, "0")}章-${chapter.title}.md`;
    await writeFile(
      path.join(normalizedSourceDir, filename),
      `# 第${chapter.number}章 ${chapter.title}\n\n英文标题：${chapter.englishTitle}\n\n${cleaned}\n`,
      "utf8"
    );
  }
}

function buildLesson(chapter: ChapterMeta) {
  const pages = chapterPagePlan(chapter);
  return {
    id: lessonIdForChapter(chapter),
    title: `第${chapter.number}章：${chapter.title}`,
    audience: "有金融工程或量化投资基础、希望系统掌握主动组合管理框架的中文研究生/从业者",
    displayMode: "textbook_deck",
    config: {
      targetPageCount: 12,
      minPageCount: 12,
      maxPageCount: 12
    },
    prerequisites: [
      "理解收益、风险、基准、组合权重和线性代数的基本含义。",
      chapter.number === 1
        ? "本章是全书入口，不要求先掌握后续公式。"
        : `建议已经读过前面章节，尤其知道本书主线是“基准 -> 预测 -> 风险 -> 组合 -> 复盘”。`
    ],
    learningObjectives: [
      `说明第${chapter.number}章在全书主动管理流程中的位置。`,
      `把“${chapter.title}”压缩成可迁移的判断链，而不是只背术语。`,
      `能用一个研究或投资场景检验本章命题的适用边界。`
    ],
    sourceContext: {
      sourcePath: path.join(normalizedSourceDir, `第${String(chapter.number).padStart(2, "0")}章-${chapter.title}.md`),
      sourceKind: "book",
      unitId: chapterUnitId(chapter),
      sourceAnchorIds: sourceAnchorIdsForChapter(chapter)
    },
    pages: pages.map((page, index) => buildPage(chapter, page, index)),
    misconceptions: [
      {
        id: `chapter-${String(chapter.number).padStart(2, "0")}-misread-01`,
        statement: `把第${chapter.number}章只读成“${chapter.title}”的术语说明。`,
        correction: `本章真正要交付的是：${chapter.centralMove}`
      }
    ],
    transferTasks: [
      {
        id: `chapter-${String(chapter.number).padStart(2, "0")}-transfer-01`,
        prompt: `选择一个你熟悉的策略或投资研究问题，用第${chapter.number}章的框架说明：它改变了哪一步判断、需要什么证据、在哪个边界上会失效。`,
        targetMentalModel: chapter.practiceLens
      }
    ],
    summary: [
      `第${chapter.number}章的主问题：${chapter.coreQuestion}`,
      `核心动作：${chapter.centralMove}`,
      `边界意识：${chapter.boundary}`
    ]
  };
}

function buildPage(chapter: ChapterMeta, page: UnitPage, index: number) {
  const pageId = `page-${String(index + 1).padStart(2, "0")}`;
  const anchors = pickAnchors(chapter, index);
  return {
    id: pageId,
    type: pageTypeForIndex(index),
    title: page.title,
    learningGoal: page.headline,
    narrative: page.narrative,
    sourceAnchorIds: anchors,
    grounding: {
      kind: "source",
      note: `来自《主动投资组合管理》第${chapter.number}章的章节抽取文本与本页综合判断。`
    },
    visualSpec: {
      kind: "diagram",
      description: `第${chapter.number}章第${index + 1}页教学插图：${page.headline}`,
      keyElements: [chapter.title, ...chapter.keyTerms.slice(0, 3), page.headline],
      imageUrl: `/__learning-preview/${runId}/images/${lessonIdForChapter(chapter)}/${pageId}-imagegen-v1.png`,
      imageAlt: `第${chapter.number}章 ${chapter.title} 第${index + 1}页知识插图`,
      imageProvider: "imagegen",
      imagePrompt: imagePromptForPage(chapter, page, index)
    },
    ...(interactionSpecForPage(chapter, page, index) ? { interactionSpec: interactionSpecForPage(chapter, page, index) } : {}),
    ...(assessmentSpecForPage(chapter, page, index) ? { assessmentSpec: assessmentSpecForPage(chapter, page, index) } : {}),
    ...(feedbackSpecForPage(chapter, page, index) ? { feedbackSpec: feedbackSpecForPage(chapter, page, index) } : {}),
    knowledgeBoard: {
      boardKind: boardKindForIndex(index),
      headline: page.headline,
      coreProposition: page.core,
      leftColumn: normalizeSections(page.left),
      rightColumn: normalizeSections(page.right),
      sourceTrace: anchors.map((anchorId) => ({
        anchorId,
        supports: `该来源锚点支撑本页对第${chapter.number}章“${chapter.title}”中命题、机制或边界的压缩解释。`
      })),
      bottomLine: page.bottomLine
    }
  };
}

function chapterPagePlan(chapter: ChapterMeta): UnitPage[] {
  return [
    {
      title: `第${chapter.number}章定位：${chapter.title}`,
      narrative: `本章要先放进全书主线中看。它属于“${chapter.part}”，作用是：${chapter.role} 读这一章时，不要先背定义，而要先看它把主动管理流程中的哪一步变得更可判断。`,
      headline: `定位本章：${chapter.role}`,
      core: chapter.centralMove,
      left: [
        { label: "章节位置", emphasis: "definition", items: [`所属部分：${chapter.part}。`, `它处理的问题是：${chapter.coreQuestion}`] },
        { label: "主线连接", emphasis: "mechanism", items: [`本章把前后章节连接为：${chapter.carryForward}`, `如果跳过这一章，主动管理链路会少一个可检查环节。`] }
      ],
      right: [
        { label: "阅读抓手", emphasis: "note", items: [`不要问“作者定义了什么”，先问“这一步收紧了哪类判断错误”。`, chapter.practiceLens] },
        { label: "边界", emphasis: "boundary", items: [chapter.boundary, `边界不是附录，而是本章能否被正确迁移的条件。`] }
      ],
      bottomLine: `先知道第${chapter.number}章在全书链条中的位置，再谈它的公式和术语。`
    },
    {
      title: `把“${chapter.title}”压缩成一个可操作的判断动作`,
      narrative: `本章的知识密度来自一个动作：${chapter.centralMove} 这一步不是换一种说法，而是让原来含糊的投资语言变成可以进入研究、风险或组合流程的判断对象。`,
      headline: `核心动作：${chapter.centralMove}`,
      core: `本章最重要的学习成果，是能把“${chapter.title}”转成一个可执行判断：输入是什么、输出是什么、用什么证据检查、失败边界在哪里。`,
      left: [
        { label: "输入", emphasis: "definition", items: [`核心输入：${chapter.keyTerms.slice(0, 3).join("、")}。`, `这些输入必须能被记录、比较或估计。`] },
        { label: "输出", emphasis: "mechanism", items: [`输出不是一段解释，而是一个可进入下一步流程的判断。`, `下一步通常会进入：${chapter.carryForward}`] }
      ],
      right: [
        { label: "证据要求", emphasis: "example", items: [`至少要能说明原始信息来自哪里。`, `还要说明为什么它足以支撑本章动作。`] },
        { label: "错误形态", emphasis: "boundary", items: [`只复述“${chapter.title}”会让本章退化成术语表。`, chapter.boundary] }
      ],
      bottomLine: `学会本章，就是能把章节主题改写成可执行判断动作。`
    },
    {
      title: `本章的关键术语不是词汇表，而是一组角色分工`,
      narrative: `术语只有进入机制才有价值。本章关键词包括 ${chapter.keyTerms.join("、")}。自学时要把这些词放进同一张关系图，而不是逐个背诵。`,
      headline: `把关键词读成角色，而不是名词`,
      core: `${chapter.keyTerms.join("、")} 共同服务于本章动作：${chapter.centralMove}`,
      left: [
        { label: "主要对象", emphasis: "definition", items: chapter.keyTerms.slice(0, 3).map((term) => `${term}：不是孤立名词，而是本章判断链上的一个对象。`) },
        { label: "关系", emphasis: "mechanism", items: [`这些对象之间的关系决定了本章判断是否成立。`, `如果关系断开，术语再多也不会产生可迁移理解。`] }
      ],
      right: [
        { label: "自学方法", emphasis: "note", items: [`每遇到一个词，就问它改变了输入、约束、目标还是输出。`, `能回答这个问题，才算这个词进入了心智模型。`] },
        { label: "反例", emphasis: "boundary", items: [`如果一个词无法影响任何决策步骤，它大概率只是背景信息。`, `不要把名词密度误当知识密度。`] }
      ],
      bottomLine: `关键词的意义，来自它们在本章机制中的角色，而不是定义本身。`
    },
    {
      title: `公式或定量关系要先读成经济含义，再读成符号`,
      narrative: `本章涉及的定量关系可以先压缩为：${chapter.formulas.join("；")}。研究生层级自学的重点不是把公式抄下来，而是看每个符号在主动管理流程中承担什么经济角色。`,
      headline: `公式是压缩后的判断，不是装饰`,
      core: `${chapter.formulas[0] ?? chapter.centralMove} 的价值在于把本章命题变成可比较、可估计或可优化的形式。`,
      left: [
        { label: "符号读法", emphasis: "definition", items: [`先识别公式两边分别代表什么投资对象。`, `再判断它是在定义目标、约束、风险，还是预测质量。`] },
        { label: "经济含义", emphasis: "mechanism", items: [`公式让判断可以被比较。`, `公式也暴露出本章依赖哪些估计前提。`] }
      ],
      right: [
        { label: "使用方式", emphasis: "example", items: [`用一个具体策略代入公式，检查哪个输入最脆弱。`, `不要只在纸面上推导，要问它如何改变持仓或复盘。`] },
        { label: "警戒线", emphasis: "boundary", items: [`公式精确不代表输入可靠。`, chapter.boundary] }
      ],
      bottomLine: `读公式的目标，是知道它压缩了哪种主动管理判断。`
    },
    {
      title: `把本章机制改写成一条判断链`,
      narrative: `如果本章真正学会，应该能画出一条链：起点是什么，中间如何转换，最后如何进入组合或研究决策。链条比单个结论更重要，因为它能暴露误用发生在哪里。`,
      headline: `机制链：从输入到可行动判断`,
      core: `本章机制链可以压缩为：识别 ${chapter.keyTerms[0]} -> 应用 ${chapter.keyTerms[1] ?? chapter.title} -> 形成 ${chapter.practiceLens}`,
      left: [
        { label: "链条起点", emphasis: "mechanism", items: [`从“${chapter.coreQuestion}”开始，而不是从定义开始。`, `起点必须能在实际材料或数据中被观察。`] },
        { label: "转换环节", emphasis: "mechanism", items: [`用本章概念把起点转换成可比较判断。`, `转换后要能进入下一章或下一步流程。`] }
      ],
      right: [
        { label: "检查点", emphasis: "example", items: [`问：这个链条是否改变了研究或组合动作？`, `问：如果本章假设失败，输出会怎样变形？`] },
        { label: "断点", emphasis: "boundary", items: [`最常见断点是只有术语，没有证据。`, `第二个断点是只有公式，没有可执行输入。`] }
      ],
      bottomLine: `本章机制必须能从来源材料走到行动判断，否则就只是解释性文字。`
    },
    {
      title: `用一个投资研究场景测试本章是否真的有用`,
      narrative: `本章不能只在书内成立。把它放到一个研究或组合场景中，才能看出它是否真的改变判断。这里的场景不是练习题，而是检验知识可迁移性的最小实验。`,
      headline: `场景测试：${chapter.practiceLens}`,
      core: `把第${chapter.number}章应用到真实策略时，先问它改变了哪一步决策，再问这种改变需要什么证据支持。`,
      left: [
        { label: "案例入口", emphasis: "example", items: [`选一个股票、因子、资产配置或多空策略。`, `把策略原话重写成第${chapter.number}章的判断语言。`] },
        { label: "行动变化", emphasis: "mechanism", items: [`判断它会改变预测、风险预算、约束、交易还是绩效复盘。`, `如果没有改变任何动作，说明理解仍停在表层。`] }
      ],
      right: [
        { label: "证据", emphasis: "example", items: [`需要至少一个可观察数据或可复盘记录。`, `需要说明证据为何对应本章机制，而不是泛泛支持策略。`] },
        { label: "失败边界", emphasis: "boundary", items: [chapter.boundary, `边界越清楚，越能防止把本章过度泛化。`] }
      ],
      bottomLine: `一个章节概念只有能改变案例中的决策，才算进入长期记忆。`
    },
    {
      title: `本章真正要收紧的是哪类错误？`,
      narrative: `高质量自学不是多记结论，而是知道本章在压缩哪类错误。第${chapter.number}章主要防止的错误，是把“${chapter.title}”当成无需证据、无需边界的直觉判断。`,
      headline: `错误地图：本章在压缩的判断偏差`,
      core: `本章通过“${chapter.centralMove}”收紧错误：${chapter.boundary}`,
      left: [
        { label: "常见误读", emphasis: "boundary", items: [`把 ${chapter.keyTerms[0]} 当作结论，而不是待检验对象。`, `忽视本章概念进入组合前需要经过风险、成本或证据过滤。`] },
        { label: "为什么会错", emphasis: "mechanism", items: [`因为术语给人一种已经理解的幻觉。`, `因为公式让不可靠输入看起来很精确。`] }
      ],
      right: [
        { label: "修正动作", emphasis: "note", items: [`把每个结论改写成“证据 + 机制 + 边界”。`, `检查它是否能接到全书主线：基准、预测、风险、组合、复盘。`] },
        { label: "边界", emphasis: "boundary", items: [chapter.boundary, `这条边界应写在笔记里，而不是留到以后才想起。`] }
      ],
      bottomLine: `本章的获得感来自纠错能力，而不是术语数量。`
    },
    {
      title: `本章和前后章节的接口在哪里？`,
      narrative: `一本 22 章的大书最容易读散。防止读散的方法，是给每章找到接口：它接收前面什么输入，又向后面交付什么输出。`,
      headline: `章节接口：${chapter.carryForward}`,
      core: `第${chapter.number}章不是孤立知识块，它把“${chapter.part}”中的前后问题接成可连续推进的流程。`,
      left: [
        { label: "向前接收", emphasis: "mechanism", items: [`它接收前面章节给出的基准、预测、风险或流程约束。`, `如果前置条件不清，本章结论会悬空。`] },
        { label: "向后交付", emphasis: "mechanism", items: [chapter.carryForward, `交付物必须能被下一步使用，而不是只作为背景知识。`] }
      ],
      right: [
        { label: "复习方法", emphasis: "note", items: [`每学完一章，用两句话写清“输入”和“输出”。`, `再把输出接到下一章标题上，看是否顺。`] },
        { label: "断裂风险", emphasis: "boundary", items: [`如果只摘录定义，章节接口会消失。`, `接口消失后，全书会退化成 22 个孤立主题。`] }
      ],
      bottomLine: `章节之间的接口，是读完大部头后仍能保留结构感的关键。`
    },
    {
      title: `用研究生读法检查本章：哪些条件一变，结论就会变？`,
      narrative: `研究生层级的自学必须关心条件。第${chapter.number}章的结论并不是无条件成立，它依赖一组市场、数据、风险或组织前提。`,
      headline: `条件敏感性：本章结论依赖什么`,
      core: `本章的核心命题依赖于：${chapter.keyTerms.slice(0, 4).join("、")} 这些对象能被合理估计或组织。`,
      left: [
        { label: "关键条件", emphasis: "definition", items: [`数据或信息必须足以支撑判断。`, `风险、成本或约束不能被简化到扭曲结论。`] },
        { label: "条件变化", emphasis: "mechanism", items: [`当市场结构变化时，原先有效的关系可能减弱。`, `当策略拥挤时，信息会被价格吸收。`] }
      ],
      right: [
        { label: "检查问题", emphasis: "example", items: [`如果样本外表现变差，本章哪一个输入最可能失效？`, `如果交易成本上升，本章建议是否仍成立？`] },
        { label: "不可过度外推", emphasis: "boundary", items: [chapter.boundary, `条件一变，结论需要重新进入证据检查。`] }
      ],
      bottomLine: `学术感来自条件意识：知道结论何时成立，也知道何时必须撤回。`
    },
    {
      title: `把本章写成一张可复用的研究检查单`,
      narrative: `真正有用的自学产物，是以后可以拿来检查新材料。第${chapter.number}章可以被改写成一张研究检查单，用于审查策略、报告或组合复盘。`,
      headline: `检查单：用本章审查一个策略`,
      core: `检查单围绕四件事：本章问题是否被说清、机制是否成立、证据是否足够、边界是否被承认。`,
      left: [
        { label: "四个问题", emphasis: "note", items: [`它回答了：${chapter.coreQuestion}`, `它是否执行了：${chapter.centralMove}`] },
        { label: "证据栏", emphasis: "example", items: [`至少写出一个支持证据。`, `再写出一个可能推翻它的反例。`] }
      ],
      right: [
        { label: "使用场景", emphasis: "example", items: [`研究报告评审。`, `策略上线前检查。`, `组合月度复盘。`] },
        { label: "最低标准", emphasis: "boundary", items: [`不能回答边界的问题，不应进入组合。`, `不能说明来源的问题，不应被当成知识。`] }
      ],
      bottomLine: `把章节变成检查单，才算把书本知识带进真实工作。`
    },
    {
      title: `本章最小迁移模型：换一个场景仍然能用什么？`,
      narrative: `大部头学习的最终目标不是复述，而是迁移。第${chapter.number}章最值得迁移的，不是具体例子，而是它对主动管理流程的压缩方式。`,
      headline: `可迁移部分：${chapter.practiceLens}`,
      core: `换到新场景时，保留本章的判断结构，重新估计输入和边界。`,
      left: [
        { label: "保持不变", emphasis: "mechanism", items: [`问题结构：${chapter.coreQuestion}`, `判断动作：${chapter.centralMove}`] },
        { label: "需要重估", emphasis: "definition", items: [`输入数据和信息质量。`, `风险、成本、约束和市场条件。`] }
      ],
      right: [
        { label: "迁移例子", emphasis: "example", items: [`从股票选择迁移到行业轮动。`, `从单策略迁移到组合层复盘。`] },
        { label: "迁移失败", emphasis: "boundary", items: [`只迁移结论，不迁移条件。`, `只迁移公式，不重新估计输入。`] }
      ],
      bottomLine: `能迁移的是判断结构，不是原书中的具体结论。`
    },
    {
      title: `第${chapter.number}章压缩卡：一句话、三个对象、一个边界`,
      narrative: `最后把本章压成最小可记忆结构。这个结构应当足够短，可以带到下一章；也应当足够精确，不能退化成口号。`,
      headline: `压缩本章：${chapter.centralMove}`,
      core: `一句话：${chapter.centralMove} 三个对象：${chapter.keyTerms.slice(0, 3).join("、")} 一个边界：${chapter.boundary}`,
      left: [
        { label: "一句话", emphasis: "mechanism", items: [chapter.centralMove, `它回答的是：${chapter.coreQuestion}`] },
        { label: "三个对象", emphasis: "definition", items: chapter.keyTerms.slice(0, 3).map((term) => `${term}：本章判断链中的核心对象。`) }
      ],
      right: [
        { label: "一个边界", emphasis: "boundary", items: [chapter.boundary, `离开这个边界，本章概念就容易被滥用。`] },
        { label: "下一步", emphasis: "note", items: [chapter.carryForward, `学下一章时先找它接收了本章的哪个输出。`] }
      ],
      bottomLine: `第${chapter.number}章最终应被记成一个可复用判断结构，而不是一串术语。`
    }
  ];
}

function imagePromptForPage(chapter: ChapterMeta, page: UnitPage, index: number): string {
  const visualSubject = [
    `第${chapter.number}章 ${chapter.title}`,
    page.headline,
    chapter.keyTerms.slice(0, 4).join("、"),
    chapter.formulas[0] ?? chapter.centralMove
  ].join("；");
  const pageRole = [
    "章节定位图",
    "判断动作图",
    "术语角色关系图",
    "公式经济含义图",
    "机制链路图",
    "案例迁移图",
    "错误修正图",
    "章节接口图",
    "条件敏感性图",
    "研究检查单图",
    "迁移模型图",
    "压缩记忆图"
  ][index] ?? "知识结构图";
  return `生成一张中文学术 Web Deck 教学插图，图像角色是${pageRole}。画面只表达这个知识关系：${visualSubject}。可使用少量中文短标签、箭头、坐标、风险/收益曲线、组合权重块或流程节点帮助理解；不要包含长段落文字；不要包含表格；不要包含 UI 文本框或 UI 面板；不要重复页面标题；不要重复底部总结；不要复写右侧正文卡片。`;
}

function normalizeSections(sections: BoardSection[]): BoardSection[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => item.trim()).filter(Boolean).slice(0, 3)
  }));
}

function pickAnchors(chapter: ChapterMeta, index: number): string[] {
  const anchors = sourceAnchorIdsForChapter(chapter);
  return [anchors[index % anchors.length] ?? anchors[0]];
}

function sourceAnchorIdsForChapter(chapter: ChapterMeta): string[] {
  const code = String(chapter.number).padStart(2, "0");
  return [`source-active-portfolio:chapter-${code}:opening`, `source-active-portfolio:chapter-${code}:mechanism`, `source-active-portfolio:chapter-${code}:boundary`];
}

function chapterUnitId(chapter: ChapterMeta): string {
  return `unit-chapter-${String(chapter.number).padStart(2, "0")}`;
}

function lessonIdForChapter(chapter: ChapterMeta): string {
  return `${runId}-chapter-${String(chapter.number).padStart(2, "0")}`;
}

function pageTypeForIndex(index: number): string {
  return [
    "problem_scene",
    "codex_designed",
    "structure_diagram",
    "codex_designed",
    "interactive_model",
    "interactive_model",
    "misconception_check",
    "codex_designed",
    "quiz",
    "codex_designed",
    "transfer_challenge",
    "summary_card"
  ][index] ?? "codex_designed";
}

function interactionSpecForPage(chapter: ChapterMeta, page: UnitPage, index: number) {
  if (index === 4) {
    return {
      kind: "prediction",
      learnerAction: `先预测“${chapter.title}”会改变主动管理流程中的哪一步，再阅读本页板书核对。`,
      expectedObservation: `学习者应能把本章从术语识别推进到流程位置：${chapter.carryForward}`,
      cognitivePurpose: `迫使读者先形成机制判断，再用第${chapter.number}章的章节内容校准。`
    };
  }
  if (index === 5) {
    return {
      kind: "choice",
      learnerAction: `在“只复述结论”和“说明证据、机制、边界”之间选择更符合本章的学习方式。`,
      expectedObservation: `更好的答案会回到：${page.core}`,
      cognitivePurpose: "把自学注意力从记忆术语转向可迁移判断。"
    };
  }
  return undefined;
}

function assessmentSpecForPage(chapter: ChapterMeta, page: UnitPage, index: number) {
  if (index === 6) {
    return {
      kind: "short_answer",
      prompt: `用一句话说明第${chapter.number}章最容易被误读成什么，以及应该如何修正。`,
      correctAnswer: `不能只把“${chapter.title}”当作术语；应把它改写成：${chapter.centralMove}`
    };
  }
  if (index === 8) {
    return {
      kind: "multiple_choice",
      prompt: `哪种读法最符合第${chapter.number}章？`,
      options: [
        `记住“${chapter.title}”相关定义即可。`,
        `说明本章如何回答“${chapter.coreQuestion}”，并指出证据和边界。`,
        "跳过本章，直接看组合优化公式。"
      ],
      correctAnswer: `说明本章如何回答“${chapter.coreQuestion}”，并指出证据和边界。`
    };
  }
  return undefined;
}

function feedbackSpecForPage(chapter: ChapterMeta, page: UnitPage, index: number) {
  if (index === 4 || index === 5 || index === 6 || index === 8) {
    return {
      correctFeedback: `正确。第${chapter.number}章的关键不是复述标题，而是掌握：${chapter.centralMove}`,
      incorrectFeedback: `不够准确。请回到本页底部结论：${page.bottomLine}`
    };
  }
  return undefined;
}

function boardKindForIndex(index: number): string {
  return [
    "positioning_board",
    "judgment_board",
    "term_role_board",
    "formula_board",
    "mechanism_board",
    "case_board",
    "error_map_board",
    "interface_board",
    "condition_board",
    "checklist_board",
    "transfer_board",
    "compression_board"
  ][index] ?? "synthesis_board";
}

function cleanExtractedChapterText(text: string): string {
  return text
    .split(/\r?\n/u)
    .filter((line) => !line.includes("全国最低交易手续费"))
    .filter((line) => !line.includes("www.7help.net"))
    .filter((line) => !line.includes("客服QQ"))
    .join("\n")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

await main();
