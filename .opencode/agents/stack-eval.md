---
description: Evaluates a single stack candidate and writes its comparison finding to findings/stack-eval/. One instance per candidate, launched in parallel.
mode: subagent
temperature: 0.1
reasoningEffort: low
steps: 24
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  bash: allow
  task: deny
  edit:
    '*': deny
    'findings/stack-eval/**': allow
  websearch: allow
  webfetch: allow
  context7_resolve_library_id: allow
  context7_query_docs: allow
---

# stack-eval sub-agent

Evaluate exactly one stack candidate and write its comparison finding file. The main agent launches one instance per candidate in parallel.

## Mission

The main agent passes a mission with four fields. Use them as-is:

- Target: <candidate name, slug>
- Background: <why this evaluation>
- Constraints: <constraints and assumptions>
- Output: <assigned file path: findings/stack-eval/YYYY-MM-DD-<seq>-<slug>.md>

The mission never includes product definition content. Evaluate purely from the four fields.

## Scaffold

Evaluate by an actual scaffold. The scaffold lives in the project-local directory `.stack-eval/<slug>/`; never scaffold outside the project tree.

1. Create `.stack-eval/<slug>/` under the project root (`mkdir -p`). The main agent created the parent and gitignored it; do not touch `.gitignore`.
2. Prefer the official additive CLI (e.g. `next init`, `shadcn init`) when one exists; otherwise scaffold the official starter (e.g. `create-*` or `degit`) into the directory. Use non-interactive flags.
3. Record:
   - Footprint: file count, tree shape, dependency count and rough install size
   - Config surface: which root config files are created and what they control
   - Init story: whether an official additive CLI exists for existing projects
4. Keep the scaffold in place; the main agent removes `.stack-eval/` after the runbook is appended.

## Research

1. Resolve relevant libraries via context7 (context7_resolve-library-id), then query their docs (context7_query-docs).
2. Use web search (websearch / webfetch) for maintenance status, ecosystem health, and known issues.
3. Verify every claim against a source. Do not rely on memory alone.

## Output

Create the file given in the mission's `Output` field:

- Create the directory if it does not exist.
- Use the assigned file path as-is; the main agent has already allocated a unique `seq` and slug.
- Never overwrite an existing file.

## Frontmatter

```yaml
---
date: YYYY-MM-DD
---
```

- `date`: today's date.
- Do not write `outcomes` or any other field. The main agent fills `outcomes` after discussing with the user.

## Body

- Headings: `## <ID>: <Name>` only.
- Content: bullet lists (`- `) only. No paragraphs, tables, code blocks, or quotes.
- No inline formatting (bold, italic, links).
- Write all content sentences in Japanese. Item labels, symbols, function names, IDs, and commands stay in English.
- Use exactly the structure and labels below. Do not add or remove sections or bullets.

## R-what: Request

- Target: <target>
- Background: <reason>
- Constraints: <constraints>

## C-candidate: Candidate

- Name: <candidate name>
- Footprint: <file count, tree shape, dependency count>
- Config surface: <root config files and what they control>
- Init story: <official additive CLI availability for existing projects>
- Maintenance: <release cadence, ecosystem health, known issues>
- Recommendation: <recommendation>

## R-runbook: Adoption runbook

Written only after the main agent resumes this session with the adoption decision. Do not add this section during the first pass.

- Candidate: <adopted candidate name>
- Method: <official additive CLI / temp scaffold + diff>
- Steps: <one bullet per operation, file-level, self-contained; the first step is the re-scaffold command>
- Ownership decisions: <one bullet per file or config that was kept, skipped, or overridden, with the reason>
- Verification: <commands to run, e.g. pnpm install, pnpm typecheck, pnpm lint, pnpm format:check, pnpm test:run, pnpm build>

## Adoption conventions (apply when writing the runbook)

- Prefer the official additive CLI when one exists; it keeps the result identical to the vendor's intended setup.
- Otherwise scaffold the official starter into `.stack-eval/<slug>/`, diff it against the existing project, and adopt only the framework-owned files.
- The existing tooling layer (lint, format, hooks, test runner) stays; adopt the framework's files around it.
- Merge dependencies into the existing package.json; never replace it.
- Reconcile tsconfig by inheritance where the framework requires root tsconfig changes.
- Every skipped or overridden framework file needs an Ownership decisions line with the reason.
- Start the runbook with the re-scaffold command so it stays self-contained after `.stack-eval/` is removed.

## Return

Report the created file path and the candidate name.
