---
name: charter
description: 'Turn an aligned discussion into a concrete file-level proposal, and on agreement write or rewrite the file-top header comment (FEATURES / PURPOSE / STATUS, isDone: false). Use when the user has discussed a direction and wants it concretized into files, or asks to charter the discussion. Triggers after the discussion has aligned.'
---

# charter

The entry point for turning an aligned discussion into a concrete, agreed file-level proposal. Key points:

- The discussion in chat is the means; the header comment is the deliverable.
- charter writes header comments only — it never touches implementation code.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Flow

### 1. Identify scope

- **Meta code** (H-,M-,S-): hooks, plugins, scripts. No product definition involved; use the pattern table.
- **Product code**: the future product defined in products/. Identify the feature (`F-<domain>.<sub>`) the change concerns, per `references/features-guide.md`.
- **Product definition missing or incomplete** → do not propose. Hand the discussion to the product skill and resume once it is complete. Do not invent feature IDs.
- The change maps to no product section → do not propose. Hand it to the **product skill** to add the section, then resume.

### 2. Propose (refactor-first)

Compile a proposal of which files to create or change, per `references/proposal-template.md`:

- Run `node scripts/list-headers.mjs` to retrieve the header list of the project files.
- Apply `references/patterns.md`: match each meta file to a pattern ID (H-,M-,S-). Product code matches feature IDs (F-\*) from the latest products/ snapshot.
- Base the proposal on responsibility separation (single responsibility) and one-way dependency. When a file's role has grown beyond its pattern, propose splitting or restructuring instead of additive changes.
- For existing files: propose the change including the header rewrite. For new files: propose creation with the pattern/feature it instantiates.
- Decide whether tests are needed per `references/test-guide.md` and list the test files in the proposal as their own entries (Header: none).

### 3. Discuss

Discuss the proposal until the user agrees. Never record before agreement.

### 4. Record the header

On agreement, for each proposed file:

1. Write the header comment at the top of the file per `references/header-format.md`:
   - `FEATURES`: pattern IDs (H-,M-,S-) for meta code; feature IDs (F-\*) for product code.
   - `PURPOSE`: the file's role in one line, with `(isDone: false)` — the purpose is not yet implemented.
   - `STATUS`: drift flags, all false initially.
2. If a header already exists, propose the rewrite. Never add a second header.
3. If the change implies a products/ snapshot update, do not record — hand the discussion to the product skill instead. Do not touch the code.

### 5. Hand off

- Hand implementation to the session skill.
- Header validation and drift detection are handled by the validate-headers git gate and the drift-gate plugin.

## Scope of files

- Headers apply to real code files only: `.ts/.tsx/.mts/.cts/.js/.jsx/.mjs/.cjs`.
- Excluded: test files (`*.test.*`, `*.spec.*`), markdown, config files that cannot carry comments.
- Test files never carry a header, but they are listed in the proposal as file entries (Header: none) so the need for tests is explicit.

## Limits

- Do not record before the user agrees.
- Do not touch implementation code.
- Design decisions live in the only product definition.
- Do not propose the session plan.
