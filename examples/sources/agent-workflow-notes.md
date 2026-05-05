# Agent Workflow Patterns

This mock source is intentionally short and permissively reusable. It exists so
the open-source demo can exercise source-backed course generation without
depending on private books, papers, or local file paths.

An agent workflow is a loop that turns a learner request into observable
intermediate artifacts. The loop usually contains four stages:

1. Observe the current task, source, and constraints.
2. Plan the next useful artifact.
3. Act by writing, validating, or revising that artifact.
4. Review the result before moving to the next step.

Tool use does not make an agent reliable by itself. A tool call only means an
action happened. The system still needs evidence, validation, feedback, and
recovery behavior.

Multi-agent work is useful when a task can be split into clear roles. A source
analyst, curriculum planner, interaction designer, lesson writer, and critic can
improve coverage when each role owns a concrete artifact. More agents are not
automatically better; unclear roles increase coordination cost.

For learning products, the most important output is not a summary. The output
should help learners build a transferable mental model through examples,
visual structure, learner action, feedback, misconception checks, and transfer
tasks.
