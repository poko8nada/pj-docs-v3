---
name: review
description: Review code, design, or documents and record the result in findings/review/. Use when the user asks for a review of code, design, or documents, or before committing changes.
---

# review

Reviews code, design, or documents and records the result as an append-only finding. The dedicated sub-agent creates the document; this skill discusses with the user and records the outcome.

## Procedure

1. Understand the request: what to review and the review scope.
2. Categorize file changes by area of concern. For each area, count the diff lines with `node scripts/diff-count.mjs <files...>` (add `--cached` for staged changes), then propose to the user with this format:
   - `<Area>: <files> — diff: <N> lines`
   - `<concern or rationale>`
   - Split any area with `diff > 500 lines` into sub-areas, and list the diff lines for each sub-area as well.
3. For each finalized area or sub-area, launch **one or more** review sub-agents **in the background.**
   - Before launching, assign each sub-agent a unique output file: list `findings/review/` and allocate `YYYY-MM-DD-<seq>.md` in order (001, 002, ...).
   - When doing so, provide a mission prompt containing only the following four fields (do not pass the diff itself, as the sub-agent will retrieve the changes using `git diff`):
     - Target: <what to review>
     - Background: <why this review>
     - Constraints: <review scope and assumptions>
     - Output: <assigned file path>
4. When the sub-agent finishes, it has created the assigned `findings/review/YYYY-MM-DD-<seq>.md` with `context` blank.
5. Read the created file and present the findings to the user.
6. Discuss with the user and obtain the outcome (adopt / reject / pending).
7. Fill the `context` field in the frontmatter with the outcome and reasoning.
8. Report the file path and the outcome.

## Rules

- Do not modify the findings content; only fill `context`.
- The document format is owned by the sub-agent. Do not get involved in it.
- If the finding is adopted, propose next steps (e.g., product update, charter the change).
