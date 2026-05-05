# Security Policy

## Supported Versions

This project is currently in OSS alpha. Security fixes target the default branch.

## Reporting A Vulnerability

Please open a private security advisory on the hosting platform if available.
If private advisories are not available, open an issue with a minimal,
non-sensitive description and ask for a secure contact path.

Do not include:

- API keys, tokens, or credentials
- private source files
- generated courses from private documents
- personal machine paths that reveal sensitive directory names

## Data Handling Notes

AI Interactive Learning Agent is designed as a local development tool in this
alpha. MCP tools and runtime scripts may read local source files when the user
explicitly provides them. Generated artifacts are written under `runs/` and
should remain untracked unless they are intentionally public examples.
