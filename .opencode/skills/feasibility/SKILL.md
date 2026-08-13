---
name: feasibility
description: Evaluate the technical feasibility of a proposed approach and record the result in findings/feasibility/. Use when the user asks whether an approach is viable or wants a feasibility assessment, or when the viability of a proposed approach is uncertain.
---

# feasibility

Evaluates the technical feasibility of a proposed approach and records the result as an append-only finding. The dedicated sub-agent creates the document; this skill discusses with the user and records the outcome.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Procedure

1. Understand the request: what to evaluate, the proposed approach, and any constraints.
2. Launch the feasibility sub-agent **in the background**, passing a mission prompt with exactly four fields:
   - Target: <what to evaluate>
   - Background: <why this evaluation>
   - Constraints: <constraints and assumptions>
   - Output: <assigned file path>
   - Before launching, assign the sub-agent a unique output file: allocate `findings/feasibility/YYYY-MM-DD-<seq>.md` in order (001, 002, ...).
   - The seq resets daily: the first finding of today is `YYYY-MM-DD-001.md` regardless of yesterday's numbers.
3. When the sub-agent finishes, it has created the assigned `findings/feasibility/YYYY-MM-DD-<seq>.md` with `date` only (no `outcomes`).
4. Read the created file. Verify before presenting: cross-check its claims against the sub-agent's report and any available artifacts. Report inconsistencies to the user as part of the presentation.
5. Present the findings to the user with this format:
   - `<ID> (<severity>): <finding summary>`
   - `  - Recommendation: <recommendation>`
   - `  - Decision: adopt / reject?`
   - Present every finding; the user decides each one. The severity comes from the file's Severity field.
6. Discuss with the user and obtain the decision for each finding (adopt / reject). There is no pending: every finding is decided.
7. Fill the `outcomes` field in the frontmatter with the decisions:
   ```yaml
   outcomes:
     - id: F1
       adopted: true
       note: <reason or fix summary>
   ```
   - `adopted: true` means the finding is adopted (fix applied or planned); `false` means rejected.
   - `note`: one line explaining the decision or the applied fix.
   - List only decided findings; every finding in the body must appear in `outcomes`.
8. Report the file path and the outcome summary.

## Fallback (step exhaustion or write failure)

- Relaunch the same mission with an instruction to finish the remaining research and write the file.
- If the sub-agent still cannot write the file, the main agent reconstructs it from the sub-agent's final report.
- The reconstruction is limited to the documented format.
- Claims are cross-checked against the report and any available artifacts.
- Record the reconstruction in the `outcomes` note with the reason.

## Rules

- Do not modify the findings content; only fill `outcomes`.
- The document format is owned by the sub-agent. Do not get involved in it.
- If the finding is adopted, propose next steps (e.g., product update via the product skill, charter the change via the charter skill).
