---
name: stack-eval
description: Compare stack candidates and record the result in findings/stack-eval/ with an adoption runbook for the chosen candidate. Use when a stack area (framework or config-bearing library) needs comparison, or when a decided candidate needs an adoption runbook.
---

# stack-eval

Evaluates stack candidates (frameworks and config-bearing libraries) and records append-only findings.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Position

- One file per candidate: comparison + decision; the chosen candidate also gets an adoption runbook.
- No product awareness: the input contract is the only context; never read `products/`.
- One sub-agent per candidate, launched in parallel; each sub-agent writes its own findings file.
- The main agent executes the runbook and records the decision in the product definition via the product skill.

## Input contract (from the main agent)

- Target: <stack area + candidate list, or a decided candidate>
- Background: <why this evaluation>
- Constraints: <constraints and assumptions>

## Procedure

1. Allocate the batch: allocate a `seq` for today in `findings/stack-eval/` (001, 002, ...; resets daily). Create the `.stack-eval/` directory at the project root and ensure `.stack-eval/` is in `.gitignore` (append if missing).
2. Normalize each candidate to a slug (lowercase, hyphens) and allocate one output file per candidate: `findings/stack-eval/YYYY-MM-DD-<seq>-<slug>.md`.
3. Launch one stack-eval sub-agent per candidate **in parallel**: issue all Task tool calls in a single message. Mission per agent:
   - Target: <candidate name, slug>
   - Background: <why this evaluation>
   - Constraints: <constraints and assumptions>
   - Output: <its assigned file path>
4. When the sub-agents finish, each has created its file with `date` only (no `outcomes`) and its candidate section.
5. Read all files and present the comparison to the user with this format:
   - `<Candidate> (<footprint summary>): <profile>`
   - `  - Recommendation: <recommendation>`
   - `  - Decision: adopt / reject?`
     Present every candidate; the user decides each one.
6. Discuss with the user and obtain the decision for each candidate. There is no pending: every candidate is decided.
7. Fill the `outcomes` field in each candidate's file with its decision:
   ```yaml
   outcomes:
     - adopted: true
       note: <reason or adoption summary>
   ```
   - `adopted: true` means the candidate is adopted; `false` means rejected.
   - `note`: one line explaining the decision.
   - Each file contains a single outcome for its own candidate.
8. When a candidate is adopted, resume its sub-agent session with the adoption decision so it appends the adoption runbook to its file.
9. Remove the `.stack-eval/` directory after the runbook is appended (the runbook is self-contained and re-scaffolds at execution time).
10. Report the file paths and the outcome summary. Propose next steps: the main agent executes the runbook, then records the decision in the product definition via the product skill.

## Rules

- Do not modify the comparison content; only fill `outcomes`.
- The document format and the adoption conventions are owned by the sub-agent. Do not get involved in them.
- Do not read or reference `products/`; the input contract is the only context.
- Do not execute the runbook yourself; execution is the main agent's step after the user agrees.

## Limits

- Not for pure dependencies without a config surface (plain `pnpm add`).
- Not for product definition decisions; the main agent records them via the product skill.
- One sub-agent per candidate; never bundle multiple candidates into one agent.
