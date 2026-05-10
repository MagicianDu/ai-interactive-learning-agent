# Product Core

The default product is a Chinese interactive learning loop:

1. Clarify source, audience, difficulty, structure, and pages per unit.
2. Prepare a source-backed course plan through `learning_agent.prepare_learning_course`.
3. Let Codex, Claude, or another capable agent author `coursePack` and `lessons`.
4. Publish and preview through `learning_agent.publish_learning_course` and `learning_agent.get_learning_preview`.
5. Learn one screen at a time with visuals, learner actions, checks, and feedback.
6. Revise through `learning_agent.revise_learning_course` and `learning_agent.apply_learning_revision`.
7. Export through `learning_agent.export_learning_course`.

The core Web Deck can be authored with different course intents:

- `build_mental_model`: default interactive learning path for mental model construction.
- `professor_lecture_deck`: optional professor-style university or graduate course deck, still rendered as a Web Deck. It does not generate or export PPTX or Slides files.

Internal by default:

- artifact approvals
- deterministic drafts
- source-map and concept-map review gates
- benchmark comparisons
- child unit promotion
- tutor, teacher, playground, and canvas experiments
