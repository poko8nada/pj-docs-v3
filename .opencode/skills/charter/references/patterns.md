# Pattern table (H-_ / M-_ / S-\_)

The registry of reusable roles for meta code. Rules:

- When chartering meta code, match each file to the pattern(s) it instantiates and put the IDs in the header `FEATURES` line.
- A file may carry multiple IDs only when it genuinely instantiates more than one role.
- If no pattern fits, propose a new pattern in this table before chartering the file.

## H-\* — Harness and hook code

- **H-chain — coordinator**: Coordinates a sequence of processing units. Holds no judgment or transformation logic of its own; it only passes inputs and outputs along. Dependency is one-way: chain → units.
- **H-handler — single-responsibility unit**: A processing unit with a single responsibility. Receives a hook/event context and returns a response or log. Does not handle multiple hook kinds.
- **H-gate — condition gate**: Evaluates conditions and returns allow/deny only. Never mutates files or state (zero side effects).
- **H-mutator — rewriter**: Rewrites files or state. Does not judge; judgment and mutation are separated responsibilities.
- **H-verifier — post-completion verifier**: Runs verification after work completes and reports the result. Scoped to a single concern per instance.
- **H-state — state store**: Persists and restores session state. Does not judge or mutate beyond its own store.
- **H-reporter — recorder/notifier**: Records or reports results and changes. Observation only; zero side effects.
- **H-transformer — in-memory converter**: Converts an input to another form in memory and passes it on. Never writes files (boundary vs H-mutator).

## M-\* — Meta scripts and tools

- **M-validate — static validation**: Static validation. Read-only; never modifies its inputs.
- **M-transform — conversion/generation**: Converts or generates output files from inputs without modifying the inputs in place.
- **M-report — result presentation**: Presents detected results for humans. No side effects beyond producing output.
- **M-sync — synchronization**: Aligns state between two targets. Exactly one target is the source of truth.
- **M-scaffold — template generation**: Creates artifacts from templates or scaffolds.
- **M-audit — full scan/discovery**: Scans the whole target to find violations or issues. Discovery is the goal (contrast M-report, whose goal is presenting findings).
- **M-migrate — format migration**: Migrates existing data or files to a new format.

## S-\* — Skill scripts

Skill scripts are tools a skill runs against its own workspace (`<skill>/scripts/`), in contrast to M-\* scripts which are project-wide (`scripts/`). S-\* patterns describe the operation the script performs on its target state.

- **S-serve — dev process launcher**: Starts and keeps a long-lived development process (e.g. a dev server) for the skill's workspace.
- **S-build — artifact builder**: Generates output artifacts from the skill's workspace into a shared output location (e.g. findings/).
- **S-reset — state restorer**: Resets the skill's disposable workspace state to its defaults without touching saved results.
- **S-report — metric reporter**: Tallies a defined metric (e.g. diff line counts) for given inputs and reports it for humans. Read-only; no side effects.
- **S-verify — compliance verifier**: Checks whether a target satisfies defined criteria and reports the result. Read-only.
- **S-sync — target synchronizer**: Aligns state between two targets. Exactly one target is the source of truth.
- **S-source — skill source module**: Skill-owned source that S-\* scripts execute but which is not itself an operation: workspace runtime (Vite entry, client-side chrome, build config) and shared script modules (e.g. `_paths.mjs`).
