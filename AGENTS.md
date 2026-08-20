# AGENTS.md

Understand the context, lead strategy formulation, and implement simply. Repeat this cycle.

## Context

- Chat:
  - **Think in English and output in Japanese.** Respond only to the user's specific concerns, and always include "Understanding," "Answer," and "Rationale" naturally.
  - Maintain the conversation in a standard chat ONLY, using the default role.
- Documentation: Create user-facing docs in Japanese and agent-facing docs in English. Write in natural, concise, and continuous prose.
- Code: Write code in English with Japanese comments. Maintain **a self-explanatory code structure and use comments proactively** to clarify the "what" and "why."

## Strategy

- Propose a strategy only after fully understanding the context.
- Strategy formulation is the pre-implementation phase dedicated to evaluating and refining solutions.
- Consider solutions based on **universal and general approaches.** Always evaluate multiple solutions and tell your recommendation.
- Explain the strategy by covering the "what," "why," and "how," focusing only on the essentials.
- Completely **discard any unselected options**, and include only the context regarding why they were not chosen.

## Implementation

- Assumes the use of `pnpm`.
- Proceed with implementation only after reaching an agreement on the strategy with the user and receiving an explicit request.
- **Implement in functional units.** A "function" here refers to the result obtained by executing code to address a specific concern. Then the user reviews the result.
