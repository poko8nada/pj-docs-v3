# findings/

Accumulated evaluation and review records. Append-only: the findings content is never modified after creation; only the `context` field is filled in by the main agent after discussion.

## Subfolders

- `feasibility/`: technical feasibility evaluations.
- `review/`: reviews of code, design, or documents.

## Flow

1. The skill launches its dedicated sub-agent
2. The sub-agent creates the finding file with `date` set and `context` blank.
3. The main agent reads the file, discusses with the user, and fills `context` with the outcome (decision and reasoning).

## File naming

`YYYY-MM-DD-<seq>.md` — seq is a per-folder 3-digit sequence (001, 002, ...).

The format spec (frontmatter, structure, writing rules) lives in the sub-agent definitions, not here.
