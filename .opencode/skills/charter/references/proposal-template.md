# Charter proposal template

The format for the charter proposal. Compile the proposal with this structure and present it for discussion. The proposal is refactor-first:

- For every existing file, consider splitting or restructuring (responsibility separation, one-way dependency) before additive changes.

The proposal body is written in Japanese. This file defines the format only.

## Scope

- Write an overview of what will be done.

## Files

### File list

Numbered bullets, one per file: `<index>. <file path> — new / change`. Test files are included. The entries below follow the same order.

### <index>. <file path> — new / change

- Why: <responsibility separation / one-way dependency. For existing files, why it changes, splits, or merges>
- Header: <true / false — whether the file carries a header. Test files are false>

When Header is true, append the header draft:

```
FEATURES: <IDs>
PURPOSE: <draft> (isDone: false)
```
