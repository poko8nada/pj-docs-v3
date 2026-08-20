---
name: product
description: Manage the product definition stored in products/. Use when the product definition needs to be created, updated, or checked against the project definition.
---

# product

The product definition lives in `products/` as append-only snapshots: what the project is, what it will build, and how it is verified. The latest snapshot is the current state. Decision authority:

- The user owns every decision in it.
- The agent proposes; the user decides.

## Decision authority

- The user owns every decision recorded in the product definition.
- Agent ideas, interpretations, and recommendations are proposals until the user explicitly agrees.
- Write content only after explicit user agreement.
- When agreement is unclear, leave the section unresolved and return to discussion.

## Language

- Write content sentences in Japanese.
- Keep items, symbols, function names, feature IDs (`F-xx`), and commands in English.

## Model

The product definition has three layers. Discover is the pivot: it is anchored by Goal and drives Build, but it also refines Goal when the product definition reveals the goal was wrong.

```text
Goal ←→ Discover → Build
```

- Goal anchors Discover (initial direction).
- Discover drives Build (the product definition determines implementation and delivery).
- Discover may revise Goal (defining the product concretely can reveal the goal needs refinement).

## Procedure

### Create (no definition yet)

1. Confirm `products/` has no snapshots.
2. Read the format and guides:
   - `products/README.md` (format)
   - `references/product-template.md` (structure)
   - `references/features-guide.md` and `references/test-guide.md` (content guides)
3. Create the working document `products/YYYY-MM-DD-001.md` and build it by layer. Each layer is an agreement checkpoint: propose → discuss → obtain explicit agreement → write the agreed sections.
   - **Goal layer** (G-what / G-outcome / G-nongoal): proposes a provisional outcome and boundary. It is confirmed after Discover.
   - **Discover layer** (D-name / D-look / D-stack + features): the main work.
     - Defines the product; may revise the Goal layer.
     - D-look applies only when the product has a frontend (`frontend: true` in D-stack).
     - D-stack is a decision checkpoint: when a choice is undecided, run the stack-eval skill with constraints extracted from G-what / G-outcome / B-deploy.
     - After the runbook is executed, record the decision in D-stack.
     - Use `references/features-guide.md` for Features granularity.
     - Common units (`C-*`) are optional: add them only when multiple features share the unit (see `references/features-guide.md`).
   - **Build layer** (B-roadmap / B-test / B-deploy / B-scope): follows from Discover.
     - B-deploy heading is `Deploy` for web apps/APIs and `Publish` for libraries/CLIs (the ID stays `B-deploy`).
     - Use `references/test-guide.md` for the B-test section.
4. At the end, run the completeness check: `node scripts/check-complete.mjs` (from this skill's directory).
   - It verifies the working document has every required section ID and at least one feature, and that no snapshot #2+ exists before that.
   - Only when it passes, freeze the working document as v1.

### Update

1. Read the latest snapshot.
2. Identify the section(s) to change and their impact (other layers, note REFs, code).
3. Discuss with the user and obtain explicit agreement.
4. Create a new snapshot `products/YYYY-MM-DD-<seq>.md`:
   - Copy the previous snapshot verbatim.
   - Apply the agreed changes: replace each changed section with its complete new definition (not a delta).
   - Fill the frontmatter: `date`, `context` (why), `changed` (the section IDs that changed).
5. Report the changed sections and the new snapshot name.

## Relationship to charted headers

- Code headers reference product sections via `FEATURES: <section ID>` (e.g., `FEATURES: F-auth.login`, `FEATURES: B-deploy`).
- When a section is renamed, split, or removed, check headers that reference it and propose updates.

## Limits

- Write only agreed decisions as decisions; keep unresolved proposals as proposals.
- Leave code and notes to their owning skills.
- Change a section only after the user agrees.
- Append a new snapshot; leave existing snapshots unchanged.
