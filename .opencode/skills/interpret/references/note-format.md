# Note format

The single source of truth for the note format. The user writes notes manually; interpret creates and updates them as discussion outcomes. Follow this format exactly.

## Note line

Code files:

```ts
// NOTE: <やろうとしていること> // isDone: false
```

Markdown files:

```md
<!-- NOTE: <やろうとしていること> // isDone: false -->
```

- One line, next to the relevant code or at the insertion point (see Position).
- `isDone: false`: needs discussion and implementation.
- `isDone: true`: decided; the line is deleted mechanically (lefthook pre-commit). The persistent block remains.

## Persistent block

Written by interpret after the user agrees. Remains after the note line is deleted.

Code files:

```ts
/*
 * REF: F-<domain>.<sub>
 * CONSTRAINTS:
 *   - <制約>
 */
```

Markdown files:

```md
<!--
 * REF: F-<domain>.<sub>
 * CONSTRAINTS:
 *   - <制約>
 -->
```

- **REF**: which definition this decision belongs to. Required.
  - Product: the section ID in the product definition, e.g. `REF: F-auth.login`, `REF: B-deploy` (see `products/README.md` for the ID scheme).
  - Meta (skills, scripts, hooks, config): the file path the decision concerns, e.g. `REF: <file-path>`. Self-reference (the block's own file) and cross-reference (another file) are both valid.
- **CONSTRAINTS**: what must hold at this location. Written per the interpret skill's `references/constraints-guide.md`.

## Position

The note's position has meaning.

- Next to existing code: the note concerns that code.
- At an insertion point (where a function or section will be written): the note marks where the agreed change goes. The persistent block replaces the note at that position and doubles as the insertion marker; implementation writes the code below the block.
- If the discussion changes the location, the block is written at the agreed location, not the note's position.

## Lifecycle

1. **Written**: by the user (manually) or by interpret (agreed gap notes).
2. **Discussed**: by interpret (understand → propose → discuss).
3. **Recorded**: interpret writes the persistent block at the note's position and sets `isDone: true`.
4. **Deleted**: lefthook pre-commit removes the note line; the persistent block remains.
