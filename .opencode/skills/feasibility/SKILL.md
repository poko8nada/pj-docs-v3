---
name: feasibility
description: Evaluate the technical feasibility of a proposed approach and record the result in findings/feasibility/. Use when the user asks whether an approach is viable or wants a feasibility assessment, or when the viability of a proposed approach is uncertain.
---

# feasibility

Evaluates the technical feasibility of a proposed approach and records the result as an append-only finding. The dedicated sub-agent creates the document; this skill discusses with the user and records the outcome.

## Procedure

1. Understand the request: what to evaluate, the proposed approach, and any constraints.
2. Launch the feasibility sub-agent **in the background** via the Task tool (`subagent_type: feasibility`), passing a mission prompt with exactly four fields:
   - Target: <what to evaluate>
   - Background: <why this evaluation>
   - Constraints: <constraints and assumptions>
   - Output: <assigned file path>
   - Before launching, assign the sub-agent a unique output file: allocate `findings/feasibility/YYYY-MM-DD-<seq>.md` in order (001, 002, ...). The seq resets daily: the first finding of today is `YYYY-MM-DD-001.md` regardless of yesterday's numbers.
3. When the sub-agent finishes, it has created the assigned `findings/feasibility/YYYY-MM-DD-<seq>.md` with `date` only (no `outcomes`).
4. Read the created file and present the findings to the user with this format:
   - `<ID> (<severity>): <finding summary>`
   - `  - 推奨: <recommendation>`
   - `  - 決定: 採用 / 不採用?`
   - Present every finding; the user decides each one.
5. Discuss with the user and obtain the decision for each finding (adopt / reject). There is no pending: every finding is decided.
6. Fill the `outcomes` field in the frontmatter with the decisions:
   ```yaml
   outcomes:
     - id: F1
       adopted: true
       note: <reason or fix summary>
   ```
   - `adopted: true` means the finding is adopted (fix applied or planned); `false` means rejected.
   - `note`: one line explaining the decision or the applied fix.
   - List only decided findings; every finding in the body must appear in `outcomes`.
7. Report the file path and the outcome summary.

## Rules

- Do not modify the findings content; only fill `outcomes`.
- The document format is owned by the sub-agent. Do not get involved in it.
- If the finding is adopted, propose next steps (e.g., product update via the product skill, charter the change via the charter skill).
