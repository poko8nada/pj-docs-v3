# Features granularity guide

A feature is a capability unit that can be implemented and verified independently. Naming rules:

- Feature names use the `F-<domain>.<sub>` form (e.g., `F-auth.login`).
- Use functional names, not sequential numbers (F-01): functional names keep existing IDs stable across additions, reordering, and splits.
- Feature IDs referenced from code headers are leaf features and always carry the dotted form. Non-dotted names may appear only as grouping domains in the tree (e.g. `F-note` below); headers reference dotted leaf IDs only.
- Renames and removals are recorded in a snapshot via `removed` plus `changed` (see products/README.md).

## Two unit kinds

The product definition has two kinds of units, distinguished by dependency direction:

- **Features (`F-*`)** — user-visible capabilities. The depending side: they use Common units.
- **Common (`C-*`)** — shared units that multiple features depend on but that are not capabilities on their own: shared components, the shared data model, and cross-cutting concerns (auth, logging, observability, ...).

Dependency is one-way: features depend on Common; Common is independent of features. Common units may depend on other Common units, but the graph must stay acyclic.

## Granularity judgment (three questions)

1. **Product capability or implementation detail?** — A user-visible capability (or API boundary) is a feature. Functions, helpers, and DB queries are implementation details and belong inside a feature.
2. **Can it be implemented and verified independently?** — A unit that can be implemented and verified without depending on other features is one feature. Otherwise split it.
3. **Does it map to one or a few notes?** — If one feature has many notes hanging off it, it is too coarse. If notes span features, it is too fine.

## Feature tree rules

1. **Two levels by default** — `F-<domain>.<sub>`. Three levels (`F-a.b.c`) is a sign to split.
2. **A domain is a user-facing area of concern** — notes, search, sync. Cut domains by user-facing area, not implementation layer (UI / data).
3. **Only leaf features are implementation units** — headers reference dotted leaves only. Non-dotted names are tree grouping.
4. **Shared logic goes to Common, not a parent feature** — put shared units in `C-*`, not a parent feature.
5. **Cross-domain dependencies are recorded explicitly** — when a feature depends on another domain's feature, note the dependency.

## Example (notes app)

- F-note: note management
  - F-note.create: create a note
  - F-note.list: list notes
  - F-note.edit: edit a note
  - F-note.delete: delete a note
- F-search: search
  - F-search.fulltext: full-text search (depends on F-note)
- F-sync: sync
  - F-sync.manual: manual sync
- C-data: note data model (depended on by F-note.*)
- C-auth: authentication (depended on by all features)

## Bad examples

- Too coarse: `F-note` alone → create/list/edit/delete are mixed and many notes hang off it → split it.
- Too fine: `F-note.create.validate` → input validation is an implementation detail → include it in `F-note.create`.
- Wrong boundary: `F-ui.note-list` / `F-data.note` → domains cut by implementation layer, not user-facing areas → regroup by concern.
- Shared logic in a parent: adding "common note handling" to `F-note` → shared logic belongs in `C-*`.
