---
name: review
description: Review code, design, or documents and record the result in findings/review/. Use when the user asks for a review of code, design, or documents, or before committing changes.
when_to_use: 'レビューし, コミットしよ, コミットして, コミット前に, チェックし'
---

# review

Reviews code, design, or documents and records the result as an append-only finding. The dedicated sub-agent creates the document; this skill discusses with the user and records the outcome.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Procedure

1. Understand the request: what to review and the review scope.
2. Categorize file changes by area of concern. For each area, count the diff lines with `node scripts/diff-count.mjs <files...>` (add `--cached` for staged changes), then propose to the user with this format:
   - `<Area>: <files> — diff: <N> lines`
   - `<concern or rationale>`
   - Split any area with `diff > 500 lines` into sub-areas, and list the diff lines for each sub-area as well.
3. For each finalized area or sub-area, launch **one or more** review sub-agents **in the background.**
   - Before launching, assign each sub-agent a unique output file: list `findings/review/` and allocate `YYYY-MM-DD-<seq>.md` in order (001, 002, ...).
   - The seq resets daily: the first finding of today is `YYYY-MM-DD-001.md` regardless of yesterday's numbers.
   - When doing so, provide a mission prompt containing only the following four fields; the sub-agent retrieves the diff itself via `git diff`:
     - Target: <what to review>
     - Background: <why this review>
     - Constraints: <review scope and assumptions>
     - Output: <assigned file path>
4. When the sub-agent finishes, it has created the assigned `findings/review/YYYY-MM-DD-<seq>.md` with `date` only (no `outcomes`).
5. Read the created file and present the findings to the user with this format:
   - `<ID> (<severity>): <finding summary>`
   - `  - Recommendation: <recommendation>`
   - `  - Decision: adopt / reject?`
   - Present every finding; the user decides each one.
6. Discuss with the user and obtain the decision for each finding (adopt / reject). There is no pending: every finding is decided.
   - high findings are presented as "adopt (fix required)" by default; confirm with the user.
7. Fill the `outcomes` field in the frontmatter with the decisions:
   ```yaml
   outcomes:
     - id: C1
       adopted: true
       note: <reason or fix summary>
   ```
   - `adopted: true` means the finding is adopted (fix applied or planned); `false` means rejected.
   - `note`: one line explaining the decision or the applied fix.
   - List only decided findings; every finding in the body must appear in `outcomes`.
8. Report the file path and the outcome summary.

## Rules

- Fill only `outcomes`; leave the rest of the findings content unchanged.
- Leave the document format to the sub-agent.
- If a finding is adopted, propose next steps (e.g., product update, charter the change).
