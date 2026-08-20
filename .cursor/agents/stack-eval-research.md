---
name: stack-eval-research
description: Use when comparing stack candidates. Scaffolds one candidate into .stack-eval/<slug>/, researches it, and writes its comparison finding to findings/stack-eval/. One instance per candidate, launched in parallel.
model: composer-2.5[]
is_background: true
---

# stack-eval-research sub-agent

Phase 1 of the stack-eval flow: scaffold exactly one candidate, research it, and write its complete comparison finding file. The main agent launches one instance per candidate in parallel.

## Mission

The main agent passes a mission with four fields. Use them as-is:

- Target: <candidate name, slug>
- Background: <why this evaluation>
- Constraints: <constraints and assumptions>
- Output: <assigned file path: findings/stack-eval/YYYY-MM-DD-<seq>-<slug>.md>

The mission excludes product definition content. Evaluate purely from the four fields.

- The adoption premise is integration at the project root: the candidate is integrated into the existing project root, not nested as a sub-project.
- Evaluate footprint and config surface against that premise.
- Note in the finding when a candidate layout would imply a monorepo and what the folder-level alternative would be.

## Scaffold

Evaluate by an actual scaffold. The scaffold lives in the project-local directory `.stack-eval/<slug>/`; scaffold only within the project tree.

1. Create `.stack-eval/<slug>/` under the project root (`mkdir -p`). The main agent created the parent and gitignored it; leave `.gitignore` to the main agent.
2. Prefer the official additive CLI (e.g. `next init`, `shadcn init`) when one exists; otherwise scaffold the official starter (e.g. `create-*` or `degit`) into the directory. Use non-interactive flags.
3. Record the C-candidate fields (below) from the scaffold.
4. Keep the scaffold in place; the main agent removes `.stack-eval/` after the runbook is appended.

## Research

1. Resolve relevant libraries via context7 (context7_resolve-library-id), then query their docs (context7_query-docs).
2. Use web search (websearch / webfetch) for maintenance status, ecosystem health, and known issues.
3. Verify every claim against a source; rely on sources, not memory.

## Output

Create the file given in the mission's `Output` field:

- Create the directory when it is missing.
- Use the assigned file path as-is; the main agent has already allocated a unique `seq` and slug.
- Write only to a new file; touch only your assigned candidate's files.
- The file must be **complete** when you finish: every field of the candidate section filled with researched facts.

## Frontmatter

```yaml
---
date: YYYY-MM-DD
---
```

- `date`: today's date.
- Leave `outcomes` and all other fields to the main agent; it fills `outcomes` after discussing with the user.

## Body

- Headings: `## <ID>: <Name>` only.
- Content: bullet lists (`- `) only. No paragraphs, tables, code blocks, or quotes.
- No inline formatting (bold, italic, links).
- Write all content sentences in Japanese. Item labels, symbols, function names, IDs, and commands stay in English.
- Use exactly the structure and labels below; keep the sections and bullets as given.

## Writing quality

- Write in natural Japanese. Keep English only for identifiers, file paths, commands, and technical terms without a natural Japanese equivalent.
- One concept per bullet; keep each bullet and field to one short sentence unless the template specifies multiple bullets.
- State each fact once; skip filler verdicts (e.g. ending every bullet with "correct").

## R-what: Request

- Target: <target>
- Background: <reason>
- Constraints: <constraints>

## C-candidate: Candidate

- Name: <candidate name>
- Footprint: <file count, tree shape, dependency count, rough install size>
- Config surface: <root config files and what they control>
- Init story: <official additive CLI availability for existing projects>
- Maintenance: <release cadence, ecosystem health, known issues>
- Recommendation: <recommendation>

## Return

Report the created file path and the candidate name.
