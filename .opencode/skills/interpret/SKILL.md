---
name: interpret
description: The entry point for user requests. Understands what the user wants, checks the project state, proposes, discusses, and records the agreed result as persistent comment blocks. Use when the user says they want to do something or asks to interpret the notes.
---

# interpret

The entry point for user requests. Understands what the user wants, checks the project state, proposes, discusses with the user, and records the agreed result as a persistent comment block in the code or meta files. The discussion is the means; the comment block is the deliverable.

## Flow

### 1. Input

- User request ("I want to do X") or state check ("interpret the notes").

### 2. State check

- **Meta request** (skills, scripts, hooks, config) → skip the product definition checks below; check the target meta file exists.
- **Product definition missing** (products/ has no snapshots) → report it and propose creating it with the product skill. Hold recording until the user agrees (REF cannot be written without it).
- **Product definition incomplete** (required sections missing, etc.) → report it and propose completing it with the product skill. REF cannot be written without the section it maps to.
- **No notes** → report it. If the user has a request, treat it as new work.
- **Notes exist** → collect the related ones.

### 3. Understand

- The goal and target of the request.
- The interpretation of the related notes.

### 4. Propose

- Meta request → propose the change to the target meta file.
- New feature → propose adding it to the product definition (product skill).
- Related notes → present the interpretation using `references/interpretation-template.md`.
- Already decided (persistent block exists) → do not re-discuss; route to the session skill.

### 5. Discuss

- Discuss with the user until the interpretation is agreed.
- If the viability of a proposed approach is uncertain (new technology, unknown library, high risk), propose running the **feasibility skill** before recording the note.

### 6. Record

On agreement, for each discussed note:

1. Write the persistent block at the note's position (next to the relevant code, or at the insertion point; if the discussion changed the location, at the agreed location):

```ts
/*
 * REF: F-<domain>.<sub>
 * CONSTRAINTS:
 *   - <制約>
 */
```

For meta requests, REF is the file path the decision concerns (self or cross reference), e.g. `REF: <file-path>`. In markdown files, use the HTML comment variant (see `references/note-format.md`).

2. Set `isDone: true` on the note line. The note line is then deleted mechanically (lefthook); the persistent block remains.

3. Create notes for agreed gaps (new files with `// NOTE: <what> // isDone: false`).

- **REF cannot be written** (note does not map to a product definition section) → do not invent a section. Propose adding it to the product definition (product skill) and hold the note undecided.

Write constraints per `references/constraints-guide.md`. Decide whether tests are needed per `references/test-guide.md`.

## Note format

The note format is defined in `references/note-format.md`. Follow it when creating or updating notes.

## Limits

- Do not record before the user agrees.
- Do not invent product definition content; read it.
- Do not propose the session plan; that is the session skill's job.
