# Self-Study Golden Samples

This file records learner-accepted self-study Web Deck samples. Use them as the minimum bar for future book/topic authoring runs.

## Accepted Samples

### `self-study-agentic-design-overview-v3`

- Preview route: `#/preview/self-study-agentic-design-overview-v3`
- Scope: one 10-page overview unit for `Agentic Design Patterns`
- Learner feedback: "有了明显提升，阅读下来有知识的获得感。"
- Acceptance signal: the deck reads like a student-facing compressed textbook, not a teacher lecture deck or page template.

Page title pattern:

1. Agent 不是模型，而是带目标的执行回路
2. 全书九章其实在回答同一个控制问题
3. 中间产物是 Prompt Chaining 的真正控制点
4. Routing 让输入先选路，而不是让一个提示处理所有事
5. Parallelization 的价值是多视角覆盖，不只是跑得更快
6. Reflection 有用的前提是评审标准足够具体
7. Tool Use 把语言决定接到外部世界的可验证观察
8. Planning 和 Memory 解决的是长任务里的状态连续性
9. Multi-Agent 只有在交付物可合并时才值得使用
10. 读完整本书前，先记住这条设计判断链

### `self-study-agentic-design-prompt-chaining-v1`

- Preview route: `#/preview/self-study-agentic-design-prompt-chaining-v1`
- Scope: one 10-page focused topic unit for `Prompt Chaining`
- Learner feedback: "可以，有获得感。"
- Acceptance signal: the deck turns one chapter into a knowledge chain with concrete mechanisms, examples, boundaries, and source-grounded claims.

Page title pattern:

1. 复杂任务失败时，常见问题不是模型不聪明，而是任务没有被拆开
2. Chain 成立的前提是后一步真的需要前一步的产物
3. 中间产物要像接口，而不是像一段随意解释
4. 结构化输出是 Prompt Chaining 的止损阀
5. Prompt Chaining 常和并行处理拼在一起，而不是互相替代
6. 工具调用让 Prompt Chain 从文本流程变成可执行流程
7. 线性 chain 适合管道，但复杂 agent 往往需要图或状态机
8. 选择 chain 前先问：这是依赖链，还是任务清单？
9. 一个好的 Prompt Chain 要把验证点放在步骤之间
10. 记住 Prompt Chaining 的设计判断：拆、传、验、再组合

### `self-study-agentic-design-tool-use-v1`

- Preview route: `#/preview/self-study-agentic-design-tool-use-v1`
- Scope: one 10-page focused topic unit for `Tool Use / Function Calling`
- Learner feedback: "内容可以。"
- Acceptance signal: the deck explains Tool Use as an external-world action and observation loop, with clear boundaries between model proposal, runtime execution, and observation feedback.

Page title pattern:

1. LLM 只有接上工具，才从“会说”变成“能做”
2. Function Calling 不是执行工具，而是生成可执行请求
3. Tool Definition 是模型理解外部能力的接口说明
4. Tool Use 的控制链路有六个状态：描述、决定、生成、执行、观察、再处理
5. 工具结果必须回到模型上下文，否则行动不会进入推理
6. 工具调用把风险从“回答错”扩展到“做错事”
7. 不是所有外部能力都适合直接暴露给模型
8. Tool Use 接外部世界，Chaining 管内部依赖
9. 设计工具型 agent 时，先定义可观察的动作边界
10. 记住 Tool Use 的判断：模型提议，系统执行，结果再进入模型

## Quality Contract

Future self-study textbook authoring should preserve these properties:

- Page titles are learner-facing propositions or questions, not authoring roles such as `先看失败`, `直观模型`, `结构与术语`, or `迁移总结`.
- Every page adds one independent knowledge judgment; the same board structure cannot be repeated with only the topic name changed.
- The page body explains mechanism, example/evidence, and boundary in student-facing language.
- Source grounding is visible through `sourceAnchorIds` and `knowledgeBoard.sourceTrace`, but source anchors do not replace explanation.
- A topic unit should read like a compressed textbook chapter for self-study, not speaker notes for a professor.

## Productized Overview Plus Topics Flow

When a learner asks for a long source as `student_self_study_textbook` with selected core topics:

- Produce one course pack, not one temporary run per topic.
- `coursePack.units` should contain `unit-overview` plus one topic unit for every selected topic.
- `unitPages` is the page budget for each unit. A request like `unitPages=10` and three topics should plan about 40 pages: 10 overview pages plus 10 pages for each topic.
- The default 100-page self-study reminder is for open-ended whole-book expansion. If the learner already selected topics or chapters and did not explicitly request a total page count, do not redistribute those selected units into 100 pages.
- Codex/Claude should author every planned unit in one bundle and then call `learning_agent.publish_learning_course` once for the complete course.

## Regression Hooks

- `evaluateSelfStudyTextbookRubric` rejects authoring scaffold language, repeated `knowledgeBoard` content, repeated page-role title patterns, and single page-role titles.
- The accepted title patterns above are covered by `self-study-textbook-rubric.test.ts` so future rubric changes do not accidentally reject the current golden direction.
