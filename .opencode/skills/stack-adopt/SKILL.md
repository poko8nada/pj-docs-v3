---
name: stack-adopt
description: Produce an adoption runbook that adds a decided framework or config-bearing library to the existing project starter. Use when a framework is already decided and the project needs a concrete step-by-step procedure to integrate it into the existing root, not when candidates still need comparison (use feasibility for that).
---

# stack-adopt

Produces an adoption runbook that adds a decided framework or config-bearing library to the existing project starter. The runbook is the single deliverable; the main agent executes it after the user agrees.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Position

- The framework is already decided. Candidate comparison and viability evaluation belong to the feasibility skill; this skill evaluates only the integration, not the choice.
- The integration target is the existing project root: the framework is added to the starter the project already has, not scaffolded as a fresh project.
- The temp scaffold exists only to produce concrete file-level steps and is removed after the runbook is written.
- The main agent executes the runbook and records the decision in the product definition via the product skill.

## Input contract (from the main agent)

- Target: <decided framework or library>
- Background: <why this adoption>
- Constraints: <constraints and assumptions>
- Output: <assigned file path: findings/stack-adopt/YYYY-MM-DD-<seq>.md>

## Procedure

1. Allocate the batch: allocate a `seq` for today in `findings/stack-adopt/` (001, 002, ...; resets daily). Create the `.stack-adopt/` directory at the project root and ensure `.stack-adopt/` is in `.gitignore` (append if missing).
2. Allocate the output file: `findings/stack-adopt/YYYY-MM-DD-<seq>.md`.
3. Launch one `stack-adopt` sub-agent with the mission above. Tell it to read `references/tool-gotchas.md` (from this skill's directory) before scaffolding.
4. Verify before presenting: read the finding file and cross-check the runbook against the scaffold state and the existing project. Report inconsistencies to the user as part of the presentation.
5. Present the runbook to the user with this format:
   - `<Framework>: <method summary>`
   - `  - Steps: <count>`
   - `  - Ownership decisions: <count>`
   - `  - Execute?`
6. Discuss with the user and obtain the decision to execute. There is no pending: the runbook is either executed or set aside.
7. Fill the `outcomes` field in the file with the decision:
   ```yaml
   outcomes:
     - adopted: true
       note: <reason or execution summary>
   ```
   - `adopted: true` means the runbook was executed or accepted for execution; `false` means it was set aside.
   - `note`: one line explaining the decision.
8. Remove the `.stack-adopt/` directory after the runbook is written (the runbook is self-contained and re-scaffolds at execution time).
9. Report the file path and the outcome summary. Propose next steps: the main agent executes the runbook, then records the decision in the product definition via the product skill.

## Fallback (step exhaustion)

- Runbook phase exhausted: the main agent writes the adoption runbook itself from the finding file and the scaffold diff. Record the takeover in the `outcomes` note.
- The fallback always ends with verification: the runbook must be cross-checked against the scaffold before presentation, whoever wrote it.

## Rules

- Fill only `outcomes` (or take over per the fallback section); leave the rest of the runbook content unchanged.
- Leave the document format and the adoption conventions to the sub-agent except in the fallback.
- Read only the input contract; leave `products/` to the product skill.
- Execute the runbook only after the user agrees; execution is the main agent's step.

## Limits

- Not for pure dependencies without a config surface (plain `pnpm add`).
- Not for candidate comparison or viability evaluation; those go to the feasibility skill.
- Not for product definition decisions; the main agent records them via the product skill.
- Run one target per agent instance.
