---
name: feasibility
description: Evaluate whether something is technically feasible and record the result in findings/feasibility/. Use whenever the user asks "is this viable?" — a proposed approach, a framework or library candidate, an implementation decision, or any uncertain technical choice. The evaluation is research-based and source-verified, using context7 and web search only.
---

# feasibility

Evaluates whether something is technically feasible and records the result as an append-only finding. The dedicated sub-agent creates the document; this skill discusses with the user and records the outcome.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Position

- Feasibility is a general evaluation skill: the same format, thinking, and research method apply to any "is this viable?" question.
- Use cases include a proposed approach, a framework or library candidate, an implementation decision, and stack evaluation before adoption.
- Evaluation is research-based: context7 and web search only, no scaffolding. Scaffolding belongs to the stack-adopt skill, which produces the adoption runbook for the decided framework.
- One finding file per evaluated target: a single approach gets one file; a stack comparison gets one file per candidate.

## Procedure

1. Understand the request: what to evaluate, the proposed approach or candidate list, and any constraints.
2. Launch the feasibility sub-agent **in the background**, passing a mission prompt with exactly four fields:
   - Target: <what to evaluate>
   - Background: <why this evaluation>
   - Constraints: <constraints and assumptions>
   - Output: <assigned file path>
   - Before launching, assign the sub-agent a unique output file: allocate `findings/feasibility/YYYY-MM-DD-<seq>.md` in order (001, 002, ...).
   - The seq resets daily: the first finding of today is `YYYY-MM-DD-001.md` regardless of yesterday's numbers.
   - For a stack comparison, launch one sub-agent per candidate in parallel: issue all Task tool calls in a single message.
3. When the sub-agent finishes, it has created the assigned `findings/feasibility/YYYY-MM-DD-<seq>.md` with `date` only (no `outcomes`).
4. Read the created file. Verify before presenting: cross-check its claims against the sub-agent's report and any available artifacts. Report inconsistencies to the user as part of the presentation.
5. Present the findings to the user with this format:
   - `<ID> (<severity>): <finding summary>`
   - `  - Recommendation: <recommendation>`
   - `  - Decision: adopt / reject?`
   - Present every finding; the user decides each one. The severity comes from the file's Severity field.
   - For a stack comparison, present each candidate's verdict and let the user decide which to adopt.
6. Discuss with the user and obtain the decision for each finding (adopt / reject) or candidate. There is no pending: every finding is decided.
7. Fill the `outcomes` field in the frontmatter with the decisions:
   ```yaml
   outcomes:
     - id: F1
       adopted: true
       note: <reason or fix summary>
   ```
   - `adopted: true` means the finding is adopted (fix applied or planned) or the candidate is chosen; `false` means rejected.
   - `note`: one line explaining the decision or the applied fix.
   - List only decided findings; every finding in the body must appear in `outcomes`.
8. Report the file path and the outcome summary. If a candidate was adopted, propose next steps: the stack-adopt skill produces the adoption runbook for the decided framework.

## Fallback (step exhaustion or write failure)

- Relaunch the same mission with an instruction to finish the remaining research and write the file.
- If the sub-agent still cannot write the file, the main agent reconstructs it from the sub-agent's final report.
- The reconstruction is limited to the documented format.
- Claims are cross-checked against the report and any available artifacts.
- Record the reconstruction in the `outcomes` note with the reason.

## Rules

- Fill only `outcomes`; leave the rest of the findings content unchanged.
- Leave the document format to the sub-agent.
- If the finding is adopted, propose next steps (e.g., stack-adopt for the runbook, product update via the product skill, charter the change via the charter skill).
