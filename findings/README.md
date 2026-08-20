# findings/

Accumulated evaluation and review records. Append-only: the findings content is never modified after creation; only the `outcomes` field is filled in by the main agent after discussion.

## Subfolders

- `feasibility/`: technical feasibility evaluations.
- `review/`: reviews of code, design, or documents.
- `stack-adopt/`: adoption runbooks for decided frameworks.

## Flow

1. The skill launches its dedicated sub-agent
2. The sub-agent creates the finding file with `date` set (no `outcomes`).
3. The main agent reads the file, discusses with the user, and fills `outcomes` with the decisions (adopted / rejected per finding ID).

## File naming

`YYYY-MM-DD-<seq>.md` — seq is a per-folder 3-digit sequence (001, 002, ...) that **resets daily**: the first finding of a day is 001, the next 002, and so on. The next day starts again at 001 in a new date-prefixed file.

The format spec (frontmatter, structure, writing rules) lives in the sub-agent definitions, not here.
