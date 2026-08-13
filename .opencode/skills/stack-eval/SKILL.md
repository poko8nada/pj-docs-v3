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
- The finding file is the single handoff artifact between phases; there is no intermediate research document.
- No product awareness: the input contract is the only context; never read `products/`.
- The main agent executes the runbook and records the decision in the product definition via the product skill.
- Two agent definitions serve one candidate: `stack-eval-research` (Phase 1) and `stack-eval-finalize` (Phase 2 and 3). Phases are missions, not definitions.
- Integration at the project root is the default: the adopted candidate is integrated into the existing project root, never nested as a sub-project (e.g. `apps/web`).
- The temp scaffold exists only for diff extraction and is removed after the runbook.
- Layer separation (e.g. frontend in `src/`, backend in `worker/`) is expressed as folders inside the single project; it is not a reason to adopt a monorepo.

## Monorepo

- By default, do not adopt a monorepo / workspace structure: package-level separation (per-package package.json / tsconfig / node_modules) is usually over-engineering for a single product.
- A monorepo is justified only when at least one concrete benefit applies:
  - frontend and backend have clearly separate lifecycles (independent deploys / independent versioning)
  - independent scaling or resource isolation is required
  - multiple products share a common base and need atomic cross-package changes
  - ownership (team) separation is required
- When none applies, folder separation within the single project suffices.

## Folder separation (single project)

Frontend and backend separation without a monorepo is expressed as folders. Two established patterns:

- `src/` + `worker/` (tool-default-first): keep the frontend tool's default layout (e.g. Vite keeps `index.html` and `src/` at the root) and add the backend as a top-level sibling (e.g. `worker/` for a Cloudflare Worker API).
- `src/client/` + `src/server/`: put both layers under a shared `src/`. This is the generic single-package convention (webpack-era) and fits when the tool has no strong root layout or both layers share one build pipeline.

Choose by the toolchain's default: prefer the pattern that requires the least reconfiguration of the tool's expected layout. Record the choice in the runbook's Ownership decisions.

## Input contract (from the main agent)

- Target: <stack area + candidate list, or a decided candidate>
- Background: <why this evaluation>
- Constraints: <constraints and assumptions>

## Procedure

1. Allocate the batch: allocate a `seq` for today in `findings/stack-eval/` (001, 002, ...; resets daily). Create the `.stack-eval/` directory at the project root and ensure `.stack-eval/` is in `.gitignore` (append if missing).
2. Normalize each candidate to a slug (lowercase, hyphens) and allocate one output file per candidate: `findings/stack-eval/YYYY-MM-DD-<seq>-<slug>.md`.
3. Phase 1 (research): launch one `stack-eval-research` sub-agent per candidate **in parallel**: issue all Task tool calls in a single message. Mission per agent:
   - Target: <candidate name, slug>
   - Background: <why this evaluation>
   - Constraints: <constraints and assumptions>
   - Output: <its assigned file path>
   - Tell each agent to read `references/tool-gotchas.md` (from this skill's directory) before scaffolding.
4. Phase 2 (verify): when each Phase 1 agent finishes, launch one `stack-eval-finalize` sub-agent for that candidate with the same mission plus `Phase: verify`.
   - Phase 2 sessions can pipeline: a candidate's Phase 2 may run while other candidates are still in Phase 1.
   - The Phase 2 agent reads the finding file and the scaffold, cross-checks claims, fixes gaps, and finalizes the candidate section.
5. Verify before presenting: read every finding file and cross-check it against the Phase 1 agent's report and the scaffold state. Report inconsistencies to the user as part of the presentation.
6. Present the comparison to the user with this format:
   - `<Candidate> (<footprint summary>): <profile>`
   - `  - Recommendation: <recommendation>`
   - `  - Decision: adopt / reject?`
   - Present every candidate; the user decides each one.
7. Discuss with the user and obtain the decision for each candidate. There is no pending: every candidate is decided.
8. Fill the `outcomes` field in each candidate's file with its decision:
   ```yaml
   outcomes:
     - adopted: true
       note: <reason or adoption summary>
   ```
   - `adopted: true` means the candidate is adopted; `false` means rejected.
   - `note`: one line explaining the decision.
   - Each file contains a single outcome for its own candidate.
9. Phase 3 (runbook): for each adopted candidate, launch one `stack-eval-finalize` sub-agent with the same mission plus `Phase: runbook` and the adoption decision, so it appends the adoption runbook to its file.
10. Remove the `.stack-eval/` directory after the runbook is appended (the runbook is self-contained and re-scaffolds at execution time).
11. Report the file paths and the outcome summary. Propose next steps: the main agent executes the runbook, then records the decision in the product definition via the product skill.

## Fallback (step exhaustion)

- Phase 1 exhausted: relaunch the same `stack-eval-research` mission with an instruction to continue the research and finish the file.
- If it still cannot complete, present the candidate with only the scaffold footprint and mark it for the user's reject consideration.
- Phase 2 exhausted: the file was already completed in Phase 1, so the main agent takes over verification only: read the file, cross-check against the scaffold, and fix format issues itself. Record the takeover in the `outcomes` note.
- Phase 2 finds no finding file: treat it as a Phase 1 failure, relaunch Phase 1, and only then run Phase 2.
- Phase 3 exhausted: the main agent writes the adoption runbook itself from the finding file and the scaffold diff. Record the takeover in the `outcomes` note.
- The fallback always ends with verification: claims must be cross-checked against the scaffold before presentation, whoever wrote them.

## Rules

- Do not modify the comparison content; only fill `outcomes` (or take over per the fallback section).
- The document format and the adoption conventions are owned by the sub-agents. Do not get involved in them except in the fallback.
- Do not read or reference `products/`; the input contract is the only context.
- Do not execute the runbook yourself; execution is the main agent's step after the user agrees.

## Limits

- Not for pure dependencies without a config surface (plain `pnpm add`).
- Not for product definition decisions; the main agent records them via the product skill.
- One candidate per agent instance; never bundle multiple candidates into one agent.
