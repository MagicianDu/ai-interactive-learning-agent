# Talker-Reasoner Architecture Mock Paper

This mock paper fixture is not a copy of any real paper. It provides a public
source shape for regression tests that need a paper-like input.

The problem is that conversational agents often mix user-facing dialogue with
internal reasoning and tool orchestration. A talker-reasoner architecture
separates these concerns. The talker handles interaction, clarification, and
final explanation. The reasoner handles task decomposition, evidence tracking,
tool choice, and self-checks.

The method boundary is important. The architecture does not guarantee truth by
itself. It creates places where evidence can be attached, failures can be
detected, and revisions can be requested.

Evaluation should inspect both user experience and reasoning quality. Useful
signals include whether the agent asks necessary clarification questions,
whether claims are grounded in the provided source, whether tool outputs are
validated, and whether the final answer explains limitations.
