---
name: session
description: Propose what to do in the current session as slices. Use when the user asks what to work on now, or after a charter is recorded.
---

# session

Proposes what to do in the current session. The session plan is a different axis from chartering: chartering records intent as file headers (isDone: false), session decides what to implement now.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Flow

1. Read the charted headers (isDone: false) and the latest products/ snapshot. Meta headers are implemented directly, not sliced.
2. Read the current code to know what exists.
3. If charted headers remain undecided (isDone: false), tell the user to run the charter skill first; let the charter skill handle it.
4. Derive slices from the charted headers and propose them using `references/slice-template.md`.
5. Discuss with the user until the slice is agreed.

## Implementation

- Implement the change the header declares; the header remains as the state record.
- After implementing a charted header, flip its PURPOSE `isDone` to `true`.
- Before committing changes, run the review skill.

## Slice guidance

- One slice is one verifiable concern; keep slices vertical and thin.
- Prioritize charted headers (isDone: false) for implementation.
- Fill Test with the test angles decided during chartering plus the command from `references/test-guide.md`; `N/A` only with a reason.
- Fill Confirm with what the user can confirm after the slice.
- Sequence slices by dependency: prerequisite slices first.

## Limits

- Implement only after the user agrees.
- Leave header comments to the charter skill.
- Rely on the chartering decision for whether tests are needed.
