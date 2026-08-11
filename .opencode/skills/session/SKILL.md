---
name: session
description: Propose what to do in the current session as slices. Use when the user asks what to work on now, or after interpretation is recorded.
---

# session

Proposes what to do in the current session. The session plan is a different axis from interpretation: interpretation records decisions in code, session decides what to implement now.

## Flow

1. Read the decided notes (persistent blocks with REF) and the latest products/ snapshot. Meta blocks (REF to a meta file) are implemented directly, not sliced.
2. Read the current code to know what exists.
3. If undecided notes remain (isDone: false), tell the user to run the interpret skill first; do not interpret yourself.
4. Derive slices from the persistent blocks and propose them using `references/slice-template.md`.
5. Discuss with the user until the slice is agreed.

## Implementation

- Write code below the insertion-point block (the persistent block doubles as the insertion marker); the block remains as the decision record.
- Before committing changes, run the review skill.

## Slice guidance

- One slice is one verifiable concern; keep slices vertical and thin.
- Prioritize decided notes (persistent blocks) for implementation.
- Fill Test with the test angles decided during interpretation plus the command from `references/test-guide.md`; `N/A` only with a reason.
- Fill Confirm with what the user can confirm after the slice.
- Sequence slices by dependency: prerequisite slices first.

## Limits

- Do not implement before the user agrees.
- Do not interpret or write code comments; that is the interpret skill's job.
- Do not decide whether tests are needed; that was decided during interpretation.
