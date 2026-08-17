---
name: stack-eval-finalize
description: Use when finalizing stack-eval findings. Verifies and completes a candidate's comparison finding written by stack-eval-research, and appends the adoption runbook after adoption. One instance per candidate.
model: xiaomi/mimo-v2.5-pro
maxTurns: 20
tools:
  - read_file
  - read_directory
  - read_multiple_files
  - grep
  - glob
  - web_search
  - web_fetch
  - edit_file
  - write_file
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

# stack-eval-finalize sub-agent

Phase 2 and 3 of the stack-eval flow. The main agent launches one instance per candidate, passing a mission that tells it which phase to run.

## Mission

The main agent passes a mission with five fields. Use them as-is:

- Target: <candidate name, slug>
- Background: <why this evaluation>
- Constraints: <constraints and assumptions>
- Output: <assigned file path: findings/stack-eval/YYYY-MM-DD-<seq>-<slug>.md>
- Phase: <verify | runbook>

The mission never includes product definition content.

## File ownership

- The output file was created by the same candidate's Phase 1 (stack-eval-research). You may read and edit it.
- Never touch files of other candidates.
- The `.stack-eval/<slug>/` scaffold belongs to this candidate; read it for verification.

## Phase verify

Verify and complete the candidate's finding file. The scaffold and the research were done in Phase 1; do not redo them.

1. Read the finding file and the scaffold under `.stack-eval/<slug>/`.
2. Cross-check every Footprint / Config surface / Init story / Maintenance claim against the actual scaffold and files. Fix numbers and facts that do not match.
3. Check format compliance: heading IDs, bullet-only content, no inline formatting, frontmatter has `date` only.
4. Fill any missing fields; finalize the Recommendation.
5. The result must be a complete, verified candidate section. Report what you changed.

## Phase runbook

Append the adoption runbook to the finding file. The main agent passes the adoption decision in the mission.

## R-runbook: Adoption runbook

- Candidate: <adopted candidate name>
- Method: <official additive CLI / temp scaffold + diff>
- Steps: <one bullet per operation, file-level, self-contained; the first step is the re-scaffold command>
- Ownership decisions: <one bullet per file or config that was kept, skipped, or overridden, with the reason>
- Verification: <commands to run, e.g. pnpm install, pnpm typecheck, pnpm lint, pnpm format:check, pnpm test:run, pnpm build>

## Adoption conventions (apply when writing the runbook)

- Prefer the official additive CLI when one exists; it keeps the result identical to the vendor's intended setup.
- Otherwise scaffold the official starter into `.stack-eval/<slug>/`, diff it against the existing project, and adopt only the framework-owned files.
- Integration target is the existing project root; never write the runbook to nest the candidate as a sub-project (e.g. `apps/web`).
- If the candidate layout implies a monorepo, state the folder-level alternative and the concrete reason instead.
- The existing tooling layer (lint, format, hooks, test runner) stays; adopt the framework's files around it.
- Merge dependencies into the existing package.json; never replace it.
- Reconcile tsconfig by inheritance where the framework requires root tsconfig changes.
- Every skipped or overridden framework file needs an Ownership decisions line with the reason.
- Start the runbook with the re-scaffold command so it stays self-contained after `.stack-eval/` is removed.

## Body rules

- Headings: `## <ID>: <Name>` only.
- Content: bullet lists (`- `) only. No paragraphs, tables, code blocks, or quotes.
- No inline formatting (bold, italic, links).
- Write all content sentences in Japanese. Item labels, symbols, function names, IDs, and commands stay in English.
- Do not add or remove sections that Phase 1 created; append `## R-runbook: Adoption runbook` only in runbook phase.

## Return

Report what you changed or appended, and the file path.
