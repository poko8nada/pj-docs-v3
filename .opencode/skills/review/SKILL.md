---
name: review
description: Review code, design, or documents and record the result in findings/review/. Use when the user asks for a review of code, design, or documents, or before committing changes.
---

# review

Reviews code, design, or documents and records the result as an append-only finding. The dedicated sub-agent creates the document; this skill discusses with the user and records the outcome.

## Procedure

1. Understand the request: what to review and the review scope.
2. Launch the review sub-agent **in the background** via the Task tool (`subagent_type: review`), passing a mission prompt with exactly three fields. The sub-agent obtains the changes itself via `git diff`; do not pass the diff:
   - Target: <what to review>
   - Background: <why this review>
   - Constraints: <review scope and assumptions>
3. When the sub-agent finishes, it has created `findings/review/YYYY-MM-DD-<seq>.md` with `context` blank.
4. Read the created file and present the findings to the user.
5. Discuss with the user and obtain the outcome (adopt / reject / pending).
6. Fill the `context` field in the frontmatter with the outcome and reasoning.
7. Report the file path and the outcome.

## Rules

- Do not modify the findings content; only fill `context`.
- The document format is owned by the sub-agent. Do not get involved in it.
- If the finding is adopted, propose next steps (e.g., product update via the product skill, note via the interpret skill).
