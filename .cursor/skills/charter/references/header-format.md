# Header format

The header comment is the state representation of a code file. Written by the charter skill as intent (isDone: false), flipped to `true` by the session skill after implementation, and monitored by the header-gate hook.

## Format

```ts
/*
 * FEATURES: H-gate, F-auth.login
 * PURPOSE: <the file's role in one line> (isDone: false)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
```

## Field rules

- **Position**: the very top of the file, before imports, doc comments, or anything else. A block comment with exactly three `FEATURES` / `PURPOSE` / `STATUS` lines.
- **FEATURES**: comma-separated IDs.
  - Meta code: pattern IDs from `references/patterns.md` (`H-*` / `M-*`).
  - Product code: feature IDs from the latest products/ snapshot (`F-<domain>.<sub>`).
  - An ID must exist in the registry it references. Never invent an ID.
- **PURPOSE**: one line stating the file's role. `isDone` is a property of PURPOSE:
  - `false`: the stated purpose is not implemented yet. charter writes the header as intent before implementation.
  - `true`: the purpose is implemented. Flipped by the session skill after implementation.
- **STATUS**: drift flags maintained by the drift-gate checks. Never written by hand.
  - `sizeDrift`: the file's total line count exceeds the size limit (300). Refactoring is assumed, and PURPOSE will change — re-charter it.
  - `driftSuspected`: cumulative additions since the baseline commit exceed 50% of the baseline, judged only for files with 100+ lines (small files would trip the ratio). PURPOSE has likely drifted — rewrite it; refactoring is case-by-case.
  - Baseline (`baseLines`, `baseCommit`) is recorded in the STATUS line when a structure review acknowledges the file or when drift is reset.

## Rules

- Never write CONSTRAINTS or design rationale in code. Design decisions live in the product definition (products/).
- Never add a second header. If one exists, rewrite it.
- Test files, markdown, and config files carry no header.
