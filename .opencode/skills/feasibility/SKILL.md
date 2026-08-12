---
name: feasibility
description: Evaluate the technical feasibility of a proposed approach and record the result in findings/feasibility/. Use when the user asks whether an approach is viable or wants a feasibility assessment, or when the viability of a proposed approach is uncertain.
---

# feasibility

Evaluates the technical feasibility of a proposed approach and records the result as an append-only finding. The dedicated sub-agent creates the document; this skill discusses with the user and records the outcome.

## Procedure

1. Understand the request: what to evaluate, the proposed approach, and any constraints.
2. Launch the feasibility sub-agent **in the background** via the Task tool (`subagent_type: feasibility`), passing a mission prompt with exactly three fields:
   - Target: <what to evaluate>
   - Background: <why this evaluation>
   - Constraints: <constraints and assumptions>
3. When the sub-agent finishes, it has created `findings/feasibility/YYYY-MM-DD-<seq>.md` with `context` blank.
4. Read the created file and present the findings to the user.
5. Discuss with the user and obtain the outcome (adopt / reject / pending).
6. Fill the `context` field in the frontmatter with the outcome and reasoning.
7. Report the file path and the outcome.

## Rules

- Do not modify the findings content; only fill `context`.
- The document format is owned by the sub-agent. Do not get involved in it.
- If the finding is adopted, propose next steps (e.g., product update via the product skill, charter the change via the charter skill).
