# Product Core

> 当前默认目标以 `docs/current-product-spec.zh-CN.md` 为准：学生自学型学术 Web Deck。下面的互动、反馈、teacher/playground 等能力属于可选产品面，不是默认生成要求。

The default product is a Chinese interactive learning loop:

1. Clarify source, audience, difficulty, structure, and pages per unit.
2. Prepare a source-backed course plan through `learning_agent.prepare_learning_course`.
3. Let Codex, Claude, or another capable agent author `coursePack` and `lessons`.
4. Publish and preview through `learning_agent.publish_learning_course` and `learning_agent.get_learning_preview`.
5. Learn one screen at a time with visuals, learner actions, checks, and feedback.
6. Revise through `learning_agent.revise_learning_course` and `learning_agent.apply_learning_revision`.
7. Export through `learning_agent.export_learning_course`.

The core Web Deck can be authored with different course intents:

- `student_self_study_textbook`: default. 学生自学型学术 Web Deck，内容密度、来源论证和图文讲解优先。
- `build_mental_model`: optional interactive learning path for mental model construction.
- `professor_lecture_deck`: optional professor-style university or graduate course deck, still rendered as a Web Deck. It does not generate or export PPTX or Slides files.

Internal by default:

- artifact approvals
- deterministic drafts
- source-map and concept-map review gates
- benchmark comparisons
- child unit promotion
- tutor, teacher, playground, and canvas experiments
