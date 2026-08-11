# products/

The product definition, stored as append-only snapshots. The latest snapshot is the current state; there is no separate PRODUCT.md.

## How it works

- Each file is a complete snapshot of the product definition (all sections).
- A new snapshot is appended on every change; existing files are never edited.
- The latest file (by date, then seq) is the current state.
- File #1 is the working document: it is edited directly until all sections are filled, then frozen as v1. From then on, snapshots are appended only.

## File naming

`YYYY-MM-DD-<seq>.md` — seq is a global 3-digit sequence (001, 002, ...).

```
2026-08-11-001.md   # v1 (frozen working document)
2026-08-20-002.md   # first change
```

`README.md` is not a snapshot.

## Frontmatter

```yaml
---
date: 2026-08-20
context: <why this change was made, in prose>
changed:
  - <section ID>
---
```

- `date`: required, YYYY-MM-DD. Must match the filename date.
- `context`: required. The situation and reasoning behind the change.
- `changed`: required for snapshots #2+. Section IDs changed in this snapshot. Absent or empty for the working document.

## Section IDs

| Layer    | Section                                  | ID                                              |
| -------- | ---------------------------------------- | ----------------------------------------------- |
| Goal     | What is this / Outcome / Non-goal        | `G-what` / `G-outcome` / `G-nongoal`            |
| Discover | Name / Look / Stack                      | `D-name` / `D-look` / `D-stack`                 |
| Build    | Roadmap / Test strategy / Deploy / Scope | `B-roadmap` / `B-test` / `B-deploy` / `B-scope` |
| Features | each feature                             | `F-<domain>.<sub>`                              |

- `D-look` applies only when the product has a frontend (`frontend: true` in D-stack; required in D-stack).
- `B-deploy` heading is `Deploy` for web apps/APIs and `Publish` for libraries/CLIs; the ID stays `B-deploy`.

## Format rules

- Content sentences are written in Japanese; items, symbols, function names, feature IDs, and commands stay in English.
- Headings: `## <ID>: <Name>` only. The ID must match the scheme above.
- Content: bullet lists (`- `) only. No paragraphs, tables, code blocks, or quotes.
- No inline formatting (bold, italic, links).
- A change snapshot contains the complete definition of every changed section (not a delta). Unchanged sections are copied verbatim from the previous snapshot.

## Validation

Pre-commit runs `scripts/validate-products.mjs`, which checks:

- Format: frontmatter fields, heading IDs, bullet-only content.
- Consistency: sections not in `changed` are identical to the previous snapshot; sections in `changed` differ.
- Naming: filename date matches frontmatter date; seq increments without gaps.
