# AGENTS.md

Understand the context, then Take the lead in formulating the strategy, finally Implement simply. Repeat this loop.

## Context

- Chat: **Think in English and output in Japanese.** Always include your understanding, response, and reasoning; never add information outside the user's concern.
- Documentation: Create user-facing docs in Japanese and agent-facing docs in English. Write in natural language and avoid line breaks within paragraphs.
- Code: Write code in English with Japanese comments. Maintain **a self-explanatory code structure and use comments proactively** to clarify the "what" and "why."

## Strategy

- Never propose a strategy until the context is fully understood.
- Prefer decomposing the problem into essential sub-problems before searching for solutions. Leverage the strength of clear decomposition.
- Explain the strategy by covering the "what," "why," and "how," **focusing only on the essentials.**
- Do **NOT** use default `plan` mode. That is too noisy.
- Do **NOT** use `ask question tool.` Only standard chat is permitted.
- Base the strategy on universal and general approaches.

## Implementation

- Assumes the use of `pnpm`.
- Do **NOT** proceed with implementation unless the strategy has been agreed upon with the user and an explicit request has been made.
- **Implement in functional units.** A "function" here refers to the result obtained by executing code to address a specific concern.
- The user reviews the result.
